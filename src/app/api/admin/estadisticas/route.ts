import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { sbAdmin } from '@/lib/planes-servidor'
import {
  agregarVisitas,
  bucketsDelRango,
  porcentajeVariacion,
  rangoAnterior,
  resolverRango,
  serieDeFechas,
  serieDiasSemana,
  serieHoras,
  agruparFuentes,
  type ActividadPeriodo,
  type EstadoPlataforma,
  type FilaRanking,
  type FilaVisitaAgregable,
  type InformeAudiencia,
  type PuntoSerie,
  type Rango,
  type ResumenVisitas,
  type TipoPagina,
} from '@/lib/analitica'

/**
 * Informe de audiencia para el panel admin.
 *
 * Se apoya en la RPC `analitica_visitas` (migración 202609290001) para agrupar
 * en Postgres. Si la migración no está aplicada, el endpoint **no falla**: lee
 * las filas y agrupa con las mismas funciones de `src/lib/analitica.ts`, y
 * marca la respuesta con `degradado: true` para que el panel lo avise. Es el
 * patrón del resto del panel: una pestaña nueva nunca debe romper el sitio.
 *
 * Las métricas de negocio (registros, publicaciones, mensajes, favoritos,
 * cupones, créditos) viven en sus tablas; sus totales se cuentan con
 * `count: exact` y sus series se montan con las fechas de las filas del
 * periodo (tablas pequeñas: un año de altas no llega a las 5.000 filas).
 */

export const dynamic = 'force-dynamic'

const MAX_FILAS = 5000
const MAX_PAGINAS_VISITAS = 8
const PAGINA_SUPABASE = 1000

type Cliente = SupabaseClient

const iso = (fecha: Date) => fecha.toISOString()

async function contarPeriodo(
  sb: Cliente,
  tabla: string,
  columna: string,
  desde: Date,
  hasta: Date,
  filtros: Record<string, string | number | boolean> = {},
): Promise<number> {
  let query = sb.from(tabla).select('id', { count: 'exact', head: true }).gte(columna, iso(desde)).lt(columna, iso(hasta))
  for (const [campo, valor] of Object.entries(filtros)) query = query.eq(campo, valor)
  const { count, error } = await query
  if (error) return 0
  return count || 0
}

async function contarTotal(
  sb: Cliente,
  tabla: string,
  filtros: Record<string, string | number | boolean> = {},
): Promise<number> {
  let query = sb.from(tabla).select('id', { count: 'exact', head: true })
  for (const [campo, valor] of Object.entries(filtros)) query = query.eq(campo, valor)
  const { count, error } = await query
  if (error) return 0
  return count || 0
}

async function fechasDe(
  sb: Cliente,
  tabla: string,
  columna: string,
  desde: Date,
  hasta: Date,
  extra?: (query: any) => any,
): Promise<{ fechas: string[]; truncado: boolean; total: number }> {
  let query = sb
    .from(tabla)
    .select(columna)
    .gte(columna, iso(desde))
    .lt(columna, iso(hasta))
    .order(columna, { ascending: true })
    .limit(MAX_FILAS)
  if (extra) query = extra(query)
  const { data, error } = await query
  if (error) return { fechas: [], truncado: false, total: 0 }
  const fechas = ((data || []) as any[]).map((f) => f[columna]).filter(Boolean)
  return { fechas, truncado: fechas.length >= MAX_FILAS, total: fechas.length }
}

/** Series y totales de las tablas de negocio. */
async function informeActividad(sb: Cliente, rango: Rango): Promise<{ actividad: ActividadPeriodo; truncado: boolean }> {
  const [perfiles, productos, mensajes, favoritos, cupones, transacciones, resenas, denuncias] = await Promise.all([
    fechasDe(sb, 'perfiles', 'creado_en', rango.desde, rango.hasta),
    fechasDe(sb, 'productos', 'creado_en', rango.desde, rango.hasta),
    fechasDe(sb, 'mensajes', 'creado_en', rango.desde, rango.hasta),
    fechasDe(sb, 'favoritos', 'creado_en', rango.desde, rango.hasta),
    fechasDe(sb, 'cupones_usos', 'usado_en', rango.desde, rango.hasta),
    fechasDe(
      sb,
      'transacciones_creditos',
      'creado_en',
      rango.desde,
      rango.hasta,
      (q: any) => q.eq('estado', 'aprobado'),
    ),
    fechasDe(sb, 'resenas', 'creado_en', rango.desde, rango.hasta),
    fechasDe(sb, 'denuncias', 'creada_en', rango.desde, rango.hasta),
  ])

  const [{ count: profesionales }, { data: importes }] = await Promise.all([
    sb
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .gte('creado_en', iso(rango.desde))
      .lt('creado_en', iso(rango.hasta))
      .neq('tipo_vendedor', 'particular'),
    sb
      .from('transacciones_creditos')
      .select('monto')
      .eq('estado', 'aprobado')
      .eq('tipo', 'compra')
      .gte('creado_en', iso(rango.desde))
      .lt('creado_en', iso(rango.hasta))
      .limit(MAX_FILAS),
  ])

  const importeCreditos = ((importes || []) as any[]).reduce((suma, fila) => suma + Number(fila.monto || 0), 0)

  return {
    truncado: [perfiles, productos, mensajes, favoritos, cupones, transacciones, resenas, denuncias].some((r) => r.truncado),
    actividad: {
      registros: perfiles.total,
      registrosSerie: serieDeFechas(perfiles.fechas, rango),
      nuevosProfesionales: profesionales || 0,
      publicaciones: productos.total,
      publicacionesSerie: serieDeFechas(productos.fechas, rango),
      mensajes: mensajes.total,
      mensajesSerie: serieDeFechas(mensajes.fechas, rango),
      favoritos: favoritos.total,
      favoritosSerie: serieDeFechas(favoritos.fechas, rango),
      cupones: cupones.total,
      cuponesSerie: serieDeFechas(cupones.fechas, rango),
      creditosAprobados: transacciones.total,
      creditosSerie: serieDeFechas(transacciones.fechas, rango),
      importeCreditos,
      resenas: resenas.total,
      resenasSerie: serieDeFechas(resenas.fechas, rango),
      denuncias: denuncias.total,
      denunciasSerie: serieDeFechas(denuncias.fechas, rango),
    },
  }
}

/** Estado actual de la plataforma (no depende del rango, salvo donde se indica). */
async function informeEstado(sb: Cliente, rango: Rango): Promise<EstadoPlataforma> {
  const [
    usuariosTotal,
    usuariosVerificados,
    anunciosTotales,
    anunciosActivos,
    anunciosVendidos,
    anunciosPublicadosPeriodo,
    anunciosVendidosPeriodo,
    usuariosActivos,
  ] = await Promise.all([
    contarTotal(sb, 'perfiles'),
    contarTotal(sb, 'perfiles', { verificado: true }),
    contarTotal(sb, 'productos'),
    contarTotal(sb, 'productos', { activo: true }),
    contarTotal(sb, 'productos', { vendido: true }),
    contarPeriodo(sb, 'productos', 'creado_en', rango.desde, rango.hasta),
    contarPeriodo(sb, 'productos', 'vendido_en', rango.desde, rango.hasta, { vendido: true }),
    contarPeriodo(sb, 'perfiles', 'ultima_actividad', rango.desde, rango.hasta),
  ])

  // Planes: se leen los perfiles con la columna de pack (paginado, tope 5.000).
  const perfiles: any[] = []
  for (let pagina = 0; pagina < 5; pagina += 1) {
    const { data, error } = await sb
      .from('perfiles')
      .select('id, plan_anuncios, plan_hasta, tipo_vendedor, creado_en')
      .order('creado_en', { ascending: false })
      .range(pagina * PAGINA_SUPABASE, pagina * PAGINA_SUPABASE + PAGINA_SUPABASE - 1)
    if (error || !data || data.length === 0) break
    perfiles.push(...data)
    if (data.length < PAGINA_SUPABASE) break
  }

  const ahora = Date.now()
  const vigente = (p: any) =>
    ['starter', 'plus', 'unlimited'].includes(p.plan_anuncios) &&
    (!p.plan_hasta || new Date(p.plan_hasta).getTime() >= ahora)

  const conteoPlanes = new Map<string, number>()
  let conPack = 0
  for (const p of perfiles) {
    if (!vigente(p)) continue
    conPack += 1
    conteoPlanes.set(p.plan_anuncios, (conteoPlanes.get(p.plan_anuncios) || 0) + 1)
  }

  // Mes de prueba global: profesionales sin pack, dentro de su ventana de días.
  let diasGratis = 30
  let mesGratisActivo = true
  const { data: ajustes } = await sb
    .from('plataforma_ajustes')
    .select('valor')
    .eq('clave', 'planes')
    .maybeSingle()
  if (ajustes?.valor) {
    const valor = ajustes.valor as Record<string, unknown>
    mesGratisActivo = valor.mes_gratis_activo !== false
    diasGratis = Number(valor.dias_gratis) > 0 ? Number(valor.dias_gratis) : 30
  }
  const usuariosEnPrueba = mesGratisActivo
    ? perfiles.filter(
        (p) =>
          p.tipo_vendedor !== 'particular' &&
          !vigente(p) &&
          p.creado_en &&
          new Date(p.creado_en).getTime() + diasGratis * 86400000 >= ahora,
      ).length
    : 0

  const packsPorPlan = ['starter', 'plus', 'unlimited'].map((plan) => ({
    plan,
    usuarios: conteoPlanes.get(plan) || 0,
  }))

  return {
    usuariosTotal,
    usuariosVerificados,
    usuariosConPack: conPack,
    usuariosEnPrueba,
    packsPorPlan,
    usuariosActivos,
    anunciosTotales,
    anunciosActivos,
    anunciosVendidos,
    anunciosPublicadosPeriodo,
    anunciosVendidosPeriodo,
    anunciosConVisitasPeriodo: 0,
    porcentajeAnunciosConVisitas: null,
  }
}

/** Normaliza lo que devuelve la RPC al tipo del panel. */
function resumenDesdeRpc(datos: any, rango: Rango): ResumenVisitas {
  const buckets = bucketsDelRango(rango)
  const porClave = new Map<string, PuntoSerie>()
  for (const punto of (datos?.serie || []) as any[]) {
    porClave.set(String(punto.clave), {
      clave: String(punto.clave),
      etiqueta: '',
      corta: '',
      visitas: 0,
      visitantes: 0,
      sesiones: 0,
    })
  }
  const serie: PuntoSerie[] = buckets.map((b) => {
    const encontrado = (datos?.serie || []).find((p: any) => String(p.clave) === b.clave)
    return {
      ...b,
      visitas: Number(encontrado?.visitas) || 0,
      visitantes: Number(encontrado?.visitantes) || 0,
      sesiones: Number(encontrado?.sesiones) || 0,
    }
  })

  const ranking = (lista: any[] | undefined): FilaRanking[] =>
    (lista || []).map((f) => ({
      clave: String(f.clave ?? f.host ?? ''),
      visitas: Number(f.visitas) || 0,
      visitantes: Number(f.visitantes) || 0,
    }))

  const visitas = Number(datos?.visitas) || 0
  const visitantes = Number(datos?.visitantes) || 0
  const muestras = Number(datos?.duracionMuestras) || 0
  const nuevos = typeof datos?.nuevos === 'number' ? Number(datos.nuevos) : null

  return {
    visitas,
    visitantes,
    sesiones: Number(datos?.sesiones) || 0,
    nuevos,
    recurrente: nuevos == null ? null : Math.max(0, visitantes - nuevos),
    paginasPorVisita: visitantes ? Math.round((visitas / visitantes) * 10) / 10 : null,
    duracionMedia: muestras ? Math.round((Number(datos?.duracionTotal) || 0) / muestras) : null,
    serie,
    dispositivos: ranking(datos?.dispositivos),
    idiomas: ranking(datos?.idiomas),
    fuentes: ranking(datos?.fuentes),
    topPaginas: (datos?.topPaginas || []).map((p: any) => ({
      clave: String(p.clave ?? p.ruta),
      visitas: Number(p.visitas) || 0,
      visitantes: Number(p.visitantes) || 0,
      tipo: (p.tipo || 'otro') as TipoPagina,
    })),
    // La RPC solo devuelve las horas y los días con datos: se rellenan los
    // huecos para que las gráficas tengan siempre 24 y 7 barras.
    horas: serieHoras(
      (datos?.horas || []).map((h: any) => ({ hora: Number(h.hora) || 0, visitas: Number(h.visitas) || 0 })),
    ),
    diasSemana: serieDiasSemana(
      (datos?.diasSemana || []).map((d: any) => ({ dow: Number(d.dow) || 0, visitas: Number(d.visitas) || 0 })),
    ),
  }
}

async function visitasDelRango(
  sb: Cliente,
  rango: Rango,
): Promise<{ resumen: ResumenVisitas; degradado: boolean; topProductos: any[]; sinVisitas: any[]; truncado: boolean }> {
  try {
    const { data, error } = await sb.rpc('analitica_visitas', {
      p_desde: iso(rango.desde),
      p_hasta: iso(rango.hasta),
      p_granularidad: rango.granularidad,
    })
    if (!error && data) {
      const resumen = resumenDesdeRpc(data, rango)
      return {
        resumen,
        degradado: false,
        topProductos: (data as any).topProductos || [],
        sinVisitas: (data as any).productosSinVisitas || [],
        truncado: false,
      }
    }
    if (error && !/does not exist|schema cache|function/i.test(error.message || '')) {
      console.error('[admin/estadisticas] rpc:', error.message)
    }
  } catch (e: any) {
    console.error('[admin/estadisticas] rpc excepción:', e?.message)
  }

  // Plan B: agrupar en JavaScript. Se marca `degradado` para que el panel
  // avise de que falta aplicar la migración.
  const filas: FilaVisitaAgregable[] = []
  let truncado = false
  for (let pagina = 0; pagina < MAX_PAGINAS_VISITAS; pagina += 1) {
    const { data, error } = await sb
      .from('visitas_pagina')
      .select('creado_en, visitante_id, sesion_id, duracion_segundos, dispositivo, idioma, referrer_host, ruta, tipo')
      .gte('creado_en', iso(rango.desde))
      .lt('creado_en', iso(rango.hasta))
      .order('creado_en', { ascending: true })
      .range(pagina * PAGINA_SUPABASE, pagina * PAGINA_SUPABASE + PAGINA_SUPABASE - 1)
    if (error || !data || data.length === 0) break
    filas.push(...(data as FilaVisitaAgregable[]))
    if (data.length < PAGINA_SUPABASE) break
    truncado = true
  }

  return {
    resumen: agregarVisitas(filas, rango),
    degradado: true,
    topProductos: [],
    sinVisitas: [],
    truncado,
  }
}

/** Anuncios con visitas en el periodo: alimenta el % de anuncios «vivos». */
async function anunciosConVisitas(sb: Cliente, rango: Rango): Promise<number> {
  const { data, error } = await sb
    .from('visitas_pagina')
    .select('producto_id')
    .gte('creado_en', iso(rango.desde))
    .lt('creado_en', iso(rango.hasta))
    .not('producto_id', 'is', null)
    .limit(MAX_FILAS)
  if (error) return 0
  return new Set(((data || []) as any[]).map((f) => f.producto_id)).size
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const params = request.nextUrl.searchParams
    const rango = resolverRango({
      preset: params.get('preset'),
      desde: params.get('desde'),
      hasta: params.get('hasta'),
      granularidad: params.get('granularidad'),
    })
    const anterior = rangoAnterior(rango)

    const sb = sbAdmin()

    const [visitas, actividad, estado, visitasPrevias, registrosPrevios, publicacionesPrevias, mensajesPrevios, conVisitas] =
      await Promise.all([
        visitasDelRango(sb, rango),
        informeActividad(sb, rango),
        informeEstado(sb, rango),
        visitasDelRango(sb, { ...rango, desde: anterior.desde, hasta: anterior.hasta }),
        contarPeriodo(sb, 'perfiles', 'creado_en', anterior.desde, anterior.hasta),
        contarPeriodo(sb, 'productos', 'creado_en', anterior.desde, anterior.hasta),
        contarPeriodo(sb, 'mensajes', 'creado_en', anterior.desde, anterior.hasta),
        anunciosConVisitas(sb, rango),
      ])

    const porcentajeConVisitas =
      estado.anunciosActivos > 0 ? Math.round((conVisitas / estado.anunciosActivos) * 1000) / 10 : null

    const informe: InformeAudiencia = {
      generadoEn: new Date().toISOString(),
      rango: {
        preset: rango.preset,
        etiqueta: rango.etiqueta,
        desde: iso(rango.desde),
        hasta: iso(rango.hasta),
        granularidad: rango.granularidad,
        buckets: bucketsDelRango(rango),
        dias: Math.max(1, Math.round((rango.hasta.getTime() - rango.desde.getTime()) / 86400000)),
      },
      visitas: visitas.resumen,
      actividad: actividad.actividad,
      estado: {
        ...estado,
        anunciosConVisitasPeriodo: conVisitas,
        porcentajeAnunciosConVisitas: porcentajeConVisitas,
      },
      comparativa: {
        visitas: visitas.degradado ? null : visitasPrevias.resumen.visitas,
        visitantes: visitas.degradado ? null : visitasPrevias.resumen.visitantes,
        registros: registrosPrevios,
        publicaciones: publicacionesPrevias,
        mensajes: mensajesPrevios,
      },
      filasTruncadas: visitas.truncado || actividad.truncado,
      degradado: visitas.degradado,
      ...(visitas.degradado
        ? {
            aviso:
              'Falta aplicar la migración 202609290001_analitica_visitas.sql: las visitas se están agrupando al vuelo y los «nuevos vs recurrentes» no se pueden calcular.',
          }
        : {}),
    }

    return NextResponse.json({
      ok: true,
      informe,
      topProductos: visitas.topProductos,
      productosSinVisitas: visitas.sinVisitas,
      fuentesAgrupadas: agruparFuentes(visitas.resumen.fuentes),
      variacion: {
        visitas: porcentajeVariacion(visitas.resumen.visitas, visitasPrevias.resumen.visitas),
        visitantes: porcentajeVariacion(visitas.resumen.visitantes, visitasPrevias.resumen.visitantes),
        registros: porcentajeVariacion(actividad.actividad.registros, registrosPrevios),
        publicaciones: porcentajeVariacion(actividad.actividad.publicaciones, publicacionesPrevias),
        mensajes: porcentajeVariacion(actividad.actividad.mensajes, mensajesPrevios),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
