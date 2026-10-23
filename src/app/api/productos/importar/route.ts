/**
 * POST /api/productos/importar — alta masiva de stock desde CSV.
 *
 * Dos fases en la misma ruta:
 *   · `{ csv }`                      → vista previa: no escribe nada.
 *   · `{ csv, confirmar: true }`     → importa las filas válidas que caben.
 *
 * Reglas que no se negocian:
 *  · **Solo Profesional.** Es la función que justifica el plan de Starter
 *    (5 anuncios se publican a mano) a Plus (15). El tope se comprueba aquí,
 *    no en la vista.
 *  · **El cupo manda.** Si el pack permite 15 y ya hay 12 activos, se importan
 *    3 y se dice cuántos han quedado fuera. Nunca se publica por encima del
 *    cupo saltándose el paywall.
 *  · **Nada se actualiza ni se borra.** Solo altas. Reimportar el mismo CSV
 *    duplica, y la UI lo advierte antes de confirmar.
 *  · **La moderación se recalcula en el servidor**, igual que en `/api/publicar`.
 *    Un CSV no es una vía para saltarse el filtro de contenido.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { verificarContenido } from '@/lib/moderacion'
import { revalidarListadosPublicos } from '@/lib/revalidar'
import { cupoDeUsuario, estadoPlanUsuario, sbAdmin } from '@/lib/planes-servidor'
import { parseCsv, validarImportacion, MAX_FILAS } from '@/lib/importar-csv'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 300_000
/** Un CSV de 100 filas no debería tardar, pero no queremos 100 inserts sueltos. */
const TAMANO_LOTE = 25

/** Igual que en `/api/publicar`: crea la categoría si aún no existe. */
async function resolverCategoriaId(sb: any, nombre: string): Promise<number | null> {
  try {
    const { data } = await sb.from('categorias').select('id').eq('nombre', nombre).maybeSingle()
    if (data?.id != null) return data.id as number
    const { data: creada } = await sb.from('categorias').insert({ nombre }).select('id').maybeSingle()
    if (creada?.id != null) return creada.id as number
    const { data: trasCarrera } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle()
    return (trasCarrera?.id as number) ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const userId = auth.user.id as string

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) {
    return NextResponse.json({ ok: false, error: 'Pega el contenido del CSV.' }, { status: 400 })
  }
  if (csv.length > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `El archivo es demasiado grande (máx. ${Math.round(MAX_BYTES / 1024)} KB).` },
      { status: 413 },
    )
  }

  const confirmar = body?.confirmar === true

  // ── Plan: solo Profesional ──────────────────────────────────────────────
  const estado = await estadoPlanUsuario(userId)
  if (estado.plan !== 'plus') {
    return NextResponse.json(
      {
        ok: false,
        codigo: 'PLAN',
        error:
          'La importación desde CSV está incluida en el plan Profesional. En el plan gratuito puedes publicar tu camper desde el formulario.',
      },
      { status: 403 },
    )
  }

  // ── Cupo disponible ──────────────────────────────────────────────────────
  const { resumen } = await cupoDeUsuario(userId)
  const restantes = resumen.restantes == null ? Infinity : Math.max(0, resumen.restantes)

  // ── Parseo y validación (idénticos en previa y en confirmación) ──────────
  const parseado = parseCsv(csv, MAX_FILAS)
  if (parseado.cabeceras.length === 0 || parseado.filas.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'El CSV no tiene filas. La primera línea deben ser las cabeceras.' },
      { status: 400 },
    )
  }

  const resultado = validarImportacion(parseado, {
    maxFotos: resumen.fotosMax,
    maxFilas: MAX_FILAS,
  })

  if (resultado.mapa.faltan.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        codigo: 'CABECERAS',
        error: `Faltan columnas obligatorias: ${resultado.mapa.faltan.join(', ')}.`,
        cabeceras: parseado.cabeceras,
        desconocidas: resultado.mapa.desconocidas,
      },
      { status: 400 },
    )
  }

  const validas = resultado.filas.filter((f) => f.errores.length === 0)
  const importables = validas.slice(0, Math.max(0, restantes))
  const sinCupo = validas.length - importables.length

  const resumenPrevio = {
    total: resultado.filas.length,
    validas: resultado.validas,
    invalidas: resultado.invalidas,
    recortadas: resultado.recortadas,
    importables: importables.length,
    sinCupo,
    restantes: resumen.restantes,
    cupo: resumen.max,
    fotosMax: resumen.fotosMax,
    desconocidas: resultado.mapa.desconocidas,
    filas: resultado.filas,
  }

  if (!confirmar) {
    return NextResponse.json({ ok: true, previa: true, ...resumenPrevio })
  }

  // ── Fase 2: importar ─────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('producto:importar', userId, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas importaciones seguidas. Espera unos minutos.' },
      { status: 429 },
    )
  }

  if (importables.length === 0) {
    return NextResponse.json(
      { ok: false, codigo: 'CUPO', error: 'No cabe ningún anuncio más con tu plan actual.', ...resumenPrevio },
      { status: 403 },
    )
  }

  const sb = sbAdmin()
  const categoriaId = await resolverCategoriaId(sb, 'camper')

  const errores: { linea: number; error: string }[] = []
  const insertados: { id: string; slug: string; titulo: string }[] = []

  for (let i = 0; i < importables.length; i += TAMANO_LOTE) {
    const lote = importables.slice(i, i + TAMANO_LOTE)

    const filas = lote.map((f) => {
      const moderacion = verificarContenido(`${f.titulo} ${f.descripcion || ''}`)
      return {
        linea: f.linea,
        registro: {
          user_id: userId,
          titulo: f.titulo,
          descripcion: f.descripcion,
          precio: f.precio,
          precio_eur: f.precio,
          precio_usd: f.precio,
          marca: f.marca,
          modelo: f.modelo,
          estado: f.estado,
          subcategoria: f.subcategoria,
          ubicacion_estado: f.ubicacion_estado,
          ubicacion_ciudad: f.ubicacion_ciudad,
          imagenes: f.imagenes,
          imagen_url: f.imagenes[0] || null,
          especificaciones: f.especificaciones,
          categoria_id: categoriaId,
          metodos_contacto: {},
          activo: true,
          destacado: false,
          destacado_hasta: null,
          boosteado_en: null,
          vendedor_verificado: false,
          visitas: 0,
          vendido: false,
          vendido_fecha: null,
          comprador_id: null,
          estado_moderacion: moderacion.nivel === 'sospechoso' ? 'pendiente' : 'aprobado',
          motivo_moderacion:
            moderacion.nivel === 'sospechoso'
              ? `Contenido sospechoso: ${moderacion.palabras.join(', ')}`
              : null,
        },
        prohibido: moderacion.nivel === 'prohibido',
        palabras: moderacion.palabras,
      }
    })

    const permitidas = filas.filter((f) => {
      if (!f.prohibido) return true
      errores.push({
        linea: f.linea,
        error: `Contenido no permitido: ${f.palabras.join(', ')}.`,
      })
      return false
    })
    if (permitidas.length === 0) continue

    let { data, error } = await sb
      .from('productos')
      .insert(permitidas.map((f) => f.registro))
      .select('id, slug, titulo')

    // Base sin la migración 025: reintentar sin `especificaciones` antes que
    // perder el lote entero.
    if (error && /especificaciones/i.test(error.message || '')) {
      const sinSpecs = permitidas.map((f) => {
        const { especificaciones: _omitida, ...resto } = f.registro
        return resto
      })
      ;({ data, error } = await sb.from('productos').insert(sinSpecs).select('id, slug, titulo'))
    }

    if (error) {
      // Un lote puede fallar entero por una fila rara: se reintenta una a una
      // para no perder las buenas.
      console.warn('[productos/importar] lote falló, reintento individual:', error.message)
      for (const fila of permitidas) {
        const { data: una, error: errorUna } = await sb
          .from('productos')
          .insert(fila.registro)
          .select('id, slug, titulo')
          .single()
        if (errorUna || !una) {
          errores.push({ linea: fila.linea, error: errorUna?.message || 'No se pudo guardar.' })
        } else {
          insertados.push(una)
        }
      }
      continue
    }

    for (const fila of data || []) insertados.push(fila)
  }

  if (insertados.length > 0) {
    // Portada, catálogo, buscador y landings por provincia.
    const provincias = new Set(
      importables.map((f) => `${f.ubicacion_estado || ''}|${f.ubicacion_ciudad || ''}`),
    )
    revalidarListadosPublicos({
      ubicacionEstado: [...provincias][0]?.split('|')[0] || null,
      ubicacionCiudad: [...provincias][0]?.split('|')[1] || null,
      subcategoria: importables[0]?.subcategoria || null,
    })
  }

  return NextResponse.json({
    ok: true,
    previa: false,
    importados: insertados.length,
    omitidos: resultado.invalidas + sinCupo + errores.length,
    sinCupo,
    invalidas: resultado.invalidas,
    restantes: resumen.restantes == null ? null : Math.max(0, restantes - insertados.length),
    anuncios: insertados,
    errores: errores.slice(0, 20),
    avisos: resultado.filas.flatMap((f) => f.avisos.map((a) => `Línea ${f.linea}: ${a}`)).slice(0, 20),
  })
}
