import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { validateProductData, sanitizeObject } from '@/lib/validation'
import { verificarContenidoCampos } from '@/lib/moderacion'
import { requireUser } from '@/lib/require-auth'
import { revalidarListadosPublicos } from '@/lib/revalidar'
import { mensajeCupoLleno } from '@/lib/planes-anuncios'
import { cupoDeUsuario } from '@/lib/planes-servidor'
import { esErrorColumnaAusente } from '@/lib/postgrest'
import { notificarAdminTelegram } from '@/lib/telegram-admin'

// La migración 025 (`productos.especificaciones`) es un prerrequisito del
// deploy. Si una base no la tiene, se avisa una vez por instancia: publicar
// sin specs degrada los filtros técnicos y hay que poder encontrar esos
// anuncios después con una query de limpieza.
let avisoMigracion025Enviado = false
const MARCA_MIGRACION_025 = '[MIGRACION_025]'

/**
 * Devuelve el id de una categoría por nombre, creándola si no existe.
 *
 * Nunca lanza: si algo falla, devuelve null y el producto se guarda sin
 * categoria_id (mejor eso que perder la publicación entera del usuario).
 */
async function resolverCategoriaId(
  // `any`: el proyecto no genera tipos de la DB, así que el cliente es
  // SupabaseClient<any> y los genéricos por defecto infieren `never`.
  sb: any,
  nombre: string
): Promise<number | null> {
  try {
    const { data: existente } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle()

    if (existente?.id != null) return existente.id as number

    // No existe: crearla. `nombre` es UNIQUE, así que ante una carrera entre
    // dos publicaciones simultáneas el insert falla y releemos la fila ganadora.
    const { data: creada } = await sb
      .from('categorias')
      .insert({ nombre })
      .select('id')
      .maybeSingle()

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
  try {
    // El user_id SIEMPRE sale de la sesión verificada (getUser valida el JWT).
    // Antes venía del body: cualquiera podía publicar como otro usuario y
    // evadir el rate limit cambiando el userId.
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const userId = auth.user.id

    const body = await req.json()
    // Descartamos userId/user_id del body: el user_id SIEMPRE sale de la
    // sesión verificada arriba. Si los dejáramos pasar, 'userId' (columna que
    // no existe en 'productos') se colaría en el INSERT y PostgREST fallaría con
    // "Could not find the 'userId' column of 'productos' in the schema cache".
    // `categoria` es la CLAVE de categoriasData ('repuestos', 'vehiculos'...),
    // no una columna de `productos`: se extrae aquí y se traduce a categoria_id
    // más abajo. Si se colara en el INSERT, PostgREST fallaría con
    // "Could not find the 'categoria' column of 'productos'".
    const {
      // Estos valores se calculan en el servidor y nunca se aceptan del cliente.
      moderacionAlerta: _bodyModeracion,
      estado_moderacion: _bodyEstadoModeracion,
      motivo_moderacion: _bodyMotivoModeracion,
      activo: _bodyActivo,
      destacado: _bodyDestacado,
      destacado_hasta: _bodyDestacadoHasta,
      boosteado_en: _bodyBoosteadoEn,
      vendedor_verificado: _bodyVendedorVerificado,
      visitas: _bodyVisitas,
      vendido: _bodyVendido,
      vendido_en: _bodyVendidoEn,
      comprador_id: _bodyCompradorId,
      userId: _bodyUserId,
      user_id: _bodyUserIdSnake,
      categoria: categoriaKey,
      ...productoData
    } = body

    // Validar datos del producto
    const validation = validateProductData({ userId, ...productoData })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Sanitizar strings para prevenir XSS
    const sanitizedData: Record<string, unknown> = sanitizeObject(productoData)

    // Canonizar precio: el front puede mandar precio / precio_eur / precio_usd (legado).
    // Las TRES columnas son numeric(12,2) y el trigger `trg_sync_producto_precio`
    // (migración 202609170001) mantiene los alias. Escribimos las tres a mano
    // porque `aplicarFiltrosBase()` y la búsqueda fulltext SIGUEN leyendo
    // `precio_usd`: dejar de escribirlo rompería el filtro por precio en las
    // bases donde el trigger aún no está aplicado. No es un "legado peligroso":
    // es un alias documentado en euros, no dólares.
    const precioEntrada = (sanitizedData['precio'] ?? sanitizedData['precio_eur'] ?? sanitizedData['precio_usd']) as unknown
    if (precioEntrada != null) {
      const n = Number(String(precioEntrada).replace(',', '.'))
      if (Number.isFinite(n)) {
        sanitizedData['precio'] = n
        sanitizedData['precio_eur'] = n
        sanitizedData['precio_usd'] = n
      }
    }

    // La moderación es una regla de seguridad: se recalcula en el servidor y
    // no se confía en `estado_moderacion` ni en una alerta enviada por el
    // navegador.
    // Cada campo por separado Y la concatenación: un término partido entre
    // título y descripción no debe colarse (y viceversa, la concatenación no
    // debe crear falsos positivos). `verificarContenidoCampos` ya normaliza
    // homoglifos, zero-width, leetspeak y separadores artificiales.
    const moderacion = verificarContenidoCampos(sanitizedData.titulo, sanitizedData.descripcion)
    if (moderacion.nivel === 'prohibido') {
      return NextResponse.json(
        { error: 'La publicación contiene contenido que viola nuestras normas.', palabras: moderacion.palabras },
        { status: 400 },
      )
    }
    sanitizedData.estado_moderacion = moderacion.nivel === 'sospechoso' ? 'pendiente' : 'aprobado'
    sanitizedData.motivo_moderacion = moderacion.nivel === 'sospechoso'
      ? `Contenido sospechoso: ${moderacion.palabras.join(', ')}`
      : null
    sanitizedData.activo = true
    sanitizedData.destacado = false
    sanitizedData.destacado_hasta = null
    sanitizedData.boosteado_en = null
    sanitizedData.vendedor_verificado = false
    sanitizedData.visitas = 0
    sanitizedData.vendido = false
    sanitizedData.vendido_en = null
    sanitizedData.comprador_id = null

    // getClientIp prioriza la cabecera que Vercel reescribe (no la que el
    // cliente puede añadir). checkRateLimit aplica el bucket usuario + IP.
    const ip = getClientIp(req)
    const rl = await checkRateLimit('producto:create', userId, { ip })
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiadas publicaciones. Espera ${Math.ceil(rl.resetIn / 60000)} min`, resetIn: rl.resetIn },
        { status: 429 }
      )
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    {
      const { resumen: cupo } = await cupoDeUsuario(userId)
      if (!cupo.puedePublicar) {
        return NextResponse.json(
          { error: mensajeCupoLleno(cupo), codigo: 'CUPO', ...cupo },
          { status: 403 },
        )
      }
      const fotos = Array.isArray(sanitizedData.imagenes) ? sanitizedData.imagenes.length : 0
      if (fotos > cupo.fotosMax) {
        return NextResponse.json(
          { error: `Tu pack permite ${cupo.fotosMax} fotos por anuncio.`, codigo: 'FOTOS' },
          { status: 403 },
        )
      }
    }

    // Resolver categoria_id en el servidor (ver nota en publicar/page.tsx).
    // Se usa maybeSingle() en vez de single(): 0 filas es un caso esperado y
    // NO debe devolver 406. Si la categoría no existe todavía en la tabla, se
    // crea sobre la marcha con el service role — así 'repuestos' y
    // 'materiales' dejan de guardarse con categoria_id NULL.
    if (typeof categoriaKey === 'string' && categoriaKey.trim()) {
      const nombre = categoriaKey.trim().toLowerCase()
      const categoriaId = await resolverCategoriaId(sb, nombre)
      if (categoriaId !== null) sanitizedData.categoria_id = categoriaId
    }

    let { data, error } = await sb.from('productos').insert({ ...sanitizedData, user_id: userId }).select().single()

    // Fallback ESTRICTO (auditoría 2026-10-27, punto 3): antes se reintentaba
    // con cualquier error que mencionara "especificaciones", lo que podía
    // duplicar un INSERT tras un error de trigger y escondía fallos reales.
    // Ahora solo se reintenta con el PGRST204 exacto de "columna desconocida".
    // El anuncio queda MARCADO en `motivo_moderacion` para poder encontrarlo
    // con SQL y arreglarlo cuando se aplique la migración 025; además se alerta
    // al admin (ya no es un fallback silencioso).
    if (error && esErrorColumnaAusente(error, 'especificaciones')) {
      console.error(
        '[publicar] Falta la columna productos.especificaciones (migración 025 sin aplicar). ' +
        'Se publica SIN ficha técnica, marcando el anuncio.',
        error.message,
      )
      const { especificaciones: _omitida, ...sinSpecs } = sanitizedData
      sinSpecs.motivo_moderacion = `${MARCA_MIGRACION_025} ${
        sinSpecs.motivo_moderacion ? String(sinSpecs.motivo_moderacion) : 'especificaciones no guardadas'
      }`
      ;({ data, error } = await sb.from('productos').insert({ ...sinSpecs, user_id: userId }).select().single())

      if (!error && !avisoMigracion025Enviado) {
        avisoMigracion025Enviado = true
        await notificarAdminTelegram(
          '⚠️ MIGRACIÓN 025 PENDIENTE\n\n' +
          'La base de datos no tiene productos.especificaciones. /api/publicar ' +
          'está publicando anuncios sin ficha técnica (marcados con [MIGRACION_025] ' +
          'en motivo_moderacion). Aplica supabase/migrations/025_categorias_faltantes_y_especificaciones.sql.',
        )
      }
    } else if (error && /especificaciones/i.test(error.message || '')) {
      // Error real relacionado con la columna: NO reintentamos (podría crear un
      // anuncio duplicado). Se devuelve 500 con el mensaje de PostgREST.
      console.error('[publicar] Error con `especificaciones` no reconocido como columna ausente:', error.message)
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // El anuncio aparece ya en portada, catálogo, buscador (es/en)
    // y, si procede, en las landings ISR de su provincia y
    // provincia+subcategoría.
    revalidarListadosPublicos({
      ubicacionCiudad: data.ubicacion_ciudad,
      ubicacionEstado: data.ubicacion_estado,
      subcategoria: data.subcategoria,
    })

    // Alerta de moderación (auditoría 2026-10-27, punto 8).
    // Se usa el helper con timeout de 5 s + 1 reintento en vez de un
    // fire-and-forget sin señal. Si aun así falla, NO se pierde la señal: el
    // anuncio ya está grabado con estado_moderacion='pendiente' y aparece en
    // el panel de administración. Telegram es solo el aviso rápido.
    if (moderacion.nivel === 'sospechoso') {
      const enviado = await notificarAdminTelegram(
        `ALERTA MODERACIÓN — SOSPECHOSO\n\n` +
        `Título: ${String(sanitizedData.titulo || '').slice(0, 200)}\n` +
        `Usuario: ${auth.user.email || userId}\n` +
        `Palabras: ${moderacion.palabras.join(', ')}`,
        { reintentos: 1 },
      )
      if (!enviado) {
        console.error(
          '[publicar] Telegram no entregó la alerta de moderación; el anuncio sigue pendiente en el panel.',
          { producto: data?.id, palabras: moderacion.palabras },
        )
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
