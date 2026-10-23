/**
 * GET /api/rendimiento?dias=7|30|90
 *
 * Métricas del vendedor para la pestaña «Rendimiento» del panel.
 *
 * Dos decisiones que importan:
 *
 *  1. **El plan se aplica en el servidor, no en la vista.** Si el pack no
 *     incluye una capacidad (contactos por anuncio, mercado, serie, export),
 *     esos datos no salen de aquí. Ocultarlos solo en React dejaría el detalle
 *     completo a un `fetch` de distancia, y las métricas de un taller son
 *     información suya, no un adorno.
 *
 *  2. **Si la RPC aún no está migrada, el panel sigue funcionando.** La
 *     migración 202610230001 añade `rendimiento_vendedor()`; mientras no esté
 *     aplicada, se devuelve lo que ya había (visitas acumuladas de
 *     `productos`) marcando `parcial: true`. Mejor un panel pobre que un error.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { sbAdmin, estadoPlanUsuario } from '@/lib/planes-servidor'
import {
  antiguedad,
  capacidades,
  nivelPlan,
  compararVentas,
  diagnosticoAnuncio,
  normalizarPeriodo,
  periodoPermitido,
  rellenarSerie,
  tasaContacto,
} from '@/lib/rendimiento'

export const dynamic = 'force-dynamic'

const DIA_MS = 86400000

type FilaMetrica = {
  productoId: string
  visitas: number
  favoritos: number
  contactos: number
}

function diasDesde(fechaIso: string | null | undefined, ahora: Date): number {
  if (!fechaIso) return 0
  const t = new Date(fechaIso).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((ahora.getTime() - t) / DIA_MS))
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const userId = auth.user.id as string

  const ahora = new Date()
  const pedido = normalizarPeriodo(new URL(req.url).searchParams.get('dias'))
  const estado = await estadoPlanUsuario(userId)
  const plan = estado.plan

  // El periodo de 90 días es de Plus en adelante. Si se pide sin permiso se
  // devuelve 30 y se marca el bloqueo para que la UI enseñe el upsell.
  const permitido = periodoPermitido(pedido, plan)
  const periodo = permitido ? pedido : 30
  const caps = capacidades(plan)

  const sb = sbAdmin()

  // ── 1. Agregados por periodo (RPC) ────────────────────────────────────────
  let datos: any = null
  let parcial = false
  const rpc = await sb.rpc('rendimiento_vendedor', {
    p_user_id: userId,
    p_dias: periodo,
  })
  if (rpc.error) {
    parcial = true
    console.warn('[rendimiento] RPC no disponible:', rpc.error.message)
  } else {
    datos = rpc.data
  }

  // ── 2. Anuncios del vendedor ──────────────────────────────────────────────
  const { data: filas } = await sb
    .from('productos')
    .select(
      'id, slug, titulo, imagen_url, precio_usd, precio, activo, vendido, pausado_por_plan, creado_en, visitas, categoria_id, subcategoria',
    )
    .eq('user_id', userId)
    .order('creado_en', { ascending: false })
    .limit(300)

  const productos = (filas || []) as any[]
  const metricas = new Map<string, FilaMetrica>()
  for (const fila of (datos?.anuncios || []) as FilaMetrica[]) {
    if (fila?.productoId) metricas.set(String(fila.productoId), fila)
  }

  const anuncios = productos.map((p) => {
    const m = metricas.get(p.id)
    const visitasPeriodo = m ? Number(m.visitas) || 0 : 0
    const favoritos = m ? Number(m.favoritos) || 0 : 0
    const contactos = m ? Number(m.contactos) || 0 : 0
    const dias = diasDesde(p.creado_en, ahora)

    // Sin RPC solo hay visitas acumuladas: se usan como aproximación honesta
    // y se marca `parcial` para que la UI lo advierta.
    const visitas = parcial ? Number(p.visitas) || 0 : visitasPeriodo

    const diag = diagnosticoAnuncio({
      visitas,
      favoritos,
      contactos,
      diasPublicado: dias,
      activo: p.activo,
      vendido: p.vendido,
      pausadoPorPlan: p.pausado_por_plan,
    })

    const precio = Number(p.precio ?? p.precio_usd) || null

    return {
      id: p.id,
      slug: p.slug,
      titulo: p.titulo,
      imagen: p.imagen_url,
      precio,
      activo: Boolean(p.activo),
      vendido: Boolean(p.vendido),
      pausadoPorPlan: Boolean(p.pausado_por_plan),
      categoriaId: p.categoria_id,
      creadoEn: p.creado_en,
      diasPublicado: dias,
      antiguedad: antiguedad(dias),
      visitas,
      favoritos: caps.porAnuncio ? favoritos : null,
      contactos: caps.porAnuncio ? contactos : null,
      tasaContacto: caps.porAnuncio ? tasaContacto(contactos, visitas) : null,
      /** Visitadísimo y sin consultas: el aviso que de verdad mueve el precio. */
      sinContactos: caps.porAnuncio ? visitas >= 30 && contactos === 0 && !p.vendido && p.activo : false,
      diagnostico: caps.diagnostico ? diag : null,
    }
  })

  // ── 3. Totales ────────────────────────────────────────────────────────────
  const resumen = datos?.resumen || {}
  const totales = {
    visitas: parcial
      ? anuncios.reduce((s, a) => s + (a.visitas || 0), 0)
      : Number(resumen.visitas) || 0,
    favoritos: caps.porAnuncio ? Number(resumen.favoritos) || 0 : null,
    contactos: caps.porAnuncio ? Number(resumen.contactos) || 0 : null,
    activos: Number(resumen.activos) || anuncios.filter((a) => a.activo && !a.vendido).length,
    publicados:
      Number(resumen.publicados) ||
      anuncios.filter((a) => diasDesde(a.creadoEn, ahora) <= periodo).length,
    vendidos: Number(resumen.vendidos) || 0,
    tasaContacto: caps.porAnuncio
      ? tasaContacto(Number(resumen.contactos) || 0, Number(resumen.visitas) || 0)
      : null,
  }

  // ── 4. Serie diaria ───────────────────────────────────────────────────────
  const serie = caps.serie
    ? rellenarSerie(periodo, (datos?.serie || []) as { dia: string; visitas: number }[], ahora)
    : null

  // ── 5. Mercado de su categoría ────────────────────────────────────────────
  // Se compara con la categoría donde tiene más anuncios: mezclar furgonetas
  // y repuestos en una sola mediana no diría nada.
  const porCategoria = new Map<number, number>()
  for (const p of productos) {
    if (p.categoria_id == null) continue
    porCategoria.set(p.categoria_id, (porCategoria.get(p.categoria_id) || 0) + 1)
  }
  const categoriaPrincipal =
    [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const mercadoCrudo = (datos?.mercado || []) as {
    categoriaId: number
    activos: number
    precioMediana: number | null
    vendidos: number
    diasMediana: number | null
  }[]
  const mercadoPropio = mercadoCrudo.find((m) => Number(m.categoriaId) === Number(categoriaPrincipal))
  const medianaPrecio = Number(mercadoPropio?.precioMediana) || null

  const ventas = datos?.ventas || {}
  const comparativa = compararVentas({
    diasMios: ventas.diasMediana,
    diasMercado: caps.mercado ? mercadoPropio?.diasMediana : null,
    ventasPropias: ventas.vendidos,
    ventasMercado: mercadoPropio?.vendidos,
  })

  const mercado = caps.mercado
    ? {
        categoriaId: categoriaPrincipal,
        activos: Number(mercadoPropio?.activos) || 0,
        vendidos: Number(mercadoPropio?.vendidos) || 0,
        precioMediana: medianaPrecio,
        diasMediana:
          mercadoPropio?.diasMediana != null ? Math.round(Number(mercadoPropio.diasMediana)) : null,
        ...comparativa,
      }
    : null

  // El precio de cada anuncio frente a la mediana de su categoría: es el
  // consejo más accionable de todo el panel, y es de Plus.
  if (caps.precioVsMercado && medianaPrecio) {
    for (const a of anuncios) {
      if (a.categoriaId !== categoriaPrincipal || !a.precio) continue
      const diff = Math.round(((a.precio - medianaPrecio) / medianaPrecio) * 100)
      ;(a as any).precioVsMercado = diff
    }
  }

  return NextResponse.json({
    ok: true,
    parcial,
    plan,
    nivel: nivelPlan(plan),
    periodo,
    periodoBloqueado: !permitido,
    capacidades: caps,
    resumen: totales,
    serie,
    anuncios,
    mercado,
    actualizadoEn: ahora.toISOString(),
  })
}
