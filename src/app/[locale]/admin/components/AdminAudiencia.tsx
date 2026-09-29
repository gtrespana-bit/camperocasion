'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, BarChart3, Clock, Download, Eye, FileText, Gift,
  Heart, MessageSquare, Monitor, Smartphone, Tablet,
  UserPlus, Users, Package, Globe, MousePointerClick,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { productUrl } from '@/lib/product-url'
import {
  Badge, Button, Card, Empty, Loading, RefreshButton, Segmented, StatCard,
  formatDate, formatNumber, timeAgo,
} from './AdminUi'
import { apiJson } from './admin-utils'
import {
  PRESETS_RANGO,
  formatearDuracion,
  type Bucket,
  type FilaRanking,
  type Granularidad,
  type InformeAudiencia,
  type PresetRango,
  type ResumenVisitas,
} from '@/lib/analitica'

type Respuesta = {
  ok: boolean
  informe: InformeAudiencia
  topProductos: any[]
  productosSinVisitas: any[]
  fuentesAgrupadas: { clave: string; etiqueta: string; visitas: number; visitantes: number }[]
  variacion: {
    visitas: number | null
    visitantes: number | null
    registros: number | null
    publicaciones: number | null
    mensajes: number | null
  }
}

function Barras({
  datos,
  color,
  altura = 96,
}: {
  datos: { etiqueta: string; corta: string; valor: number }[]
  color: string
  altura?: number
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: altura + 26 }}>
      {datos.map((d, i) => (
        <div key={`${d.etiqueta}-${i}`} className="flex min-w-[14px] flex-1 flex-col items-center gap-1" title={`${d.etiqueta}: ${d.valor}`}>
          <div
            className={`w-full rounded-t ${color}`}
            style={{ height: `${Math.max(3, (d.valor / maximo) * altura)}px` }}
          />
          <span className="text-[9px] leading-tight text-gray-400">{datos.length <= 32 ? d.corta : ''}</span>
        </div>
      ))}
    </div>
  )
}

function ListaRanking({
  titulo,
  icono,
  filas,
  vacio = 'Sin datos en el periodo.',
  sufijo = 'visitas',
}: {
  titulo: string
  icono: React.ReactNode
  filas: (FilaRanking & { etiqueta?: string; url?: string | null })[]
  vacio?: string
  sufijo?: string
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.visitas))
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        {icono} {titulo}
      </h4>
      {filas.length === 0 ? (
        <p className="text-sm text-gray-500">{vacio}</p>
      ) : (
        <div className="space-y-2">
          {filas.map((f, i) => (
            <div key={`${f.clave}-${i}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                {f.url ? (
                  <LocalLink href={f.url} className="truncate font-medium text-gray-700 hover:text-brand-primary">
                    {f.etiqueta || f.clave}
                  </LocalLink>
                ) : (
                  <span className="truncate font-medium text-gray-700">{f.etiqueta || f.clave}</span>
                )}
                <span className="flex-shrink-0 font-bold text-gray-900">{formatNumber(f.visitas)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-primary/70" style={{ width: `${(f.visitas / maximo) * 100}%` }} />
              </div>
              <p className="text-[10px] text-gray-400">
                {formatNumber(f.visitas)} {sufijo} · {formatNumber(f.visitantes)} visitantes únicos
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ICONO_DISPOSITIVO: Record<string, React.ReactNode> = {
  movil: <Smartphone size={13} />,
  tablet: <Tablet size={13} />,
  escritorio: <Monitor size={13} />,
  desconocido: <Monitor size={13} />,
}

const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/**
 * Pestaña «Audiencia»: visitas del sitio + vida de la plataforma
 * (registros, publicaciones, mensajes, favoritos, canjes y packs) clasificada
 * por día, semana o mes.
 *
 * Los datos de visitas solo incluyen a quien aceptó la medición: la política de
 * cookies del sitio promete que no se mide a quien rechaza, y aquí se cumple.
 */
export default function AdminAudiencia({ notify }: { notify: (msg: string) => void }) {
  const [preset, setPreset] = useState<PresetRango>('30d')
  const [granularidad, setGranularidad] = useState<Granularidad>('dia')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [personalizado, setPersonalizado] = useState(false)
  const [data, setData] = useState<Respuesta | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams()
        if (personalizado && desde && hasta) {
          params.set('preset', 'personalizado')
          params.set('desde', desde)
          params.set('hasta', hasta)
        } else {
          params.set('preset', preset)
        }
        params.set('granularidad', granularidad)
        const res = await apiJson<Respuesta>(`/api/admin/estadisticas?${params.toString()}`)
        setData(res)
      } catch (e: any) {
        notify('❌ ' + e.message)
      }
      setLoading(false)
      setRefreshing(false)
    },
    [preset, granularidad, desde, hasta, personalizado, notify],
  )

  useEffect(() => {
    load()
  }, [load])

  const informe = data?.informe
  const visitas: ResumenVisitas | undefined = informe?.visitas

  const serieChart = useMemo(() => {
    if (!visitas) return []
    return visitas.serie.map((p) => ({ etiqueta: p.etiqueta, corta: p.corta, valor: p.visitas }))
  }, [visitas])

  const visitantesChart = useMemo(() => {
    if (!visitas) return []
    return visitas.serie.map((p) => ({ etiqueta: p.etiqueta, corta: p.corta, valor: p.visitantes }))
  }, [visitas])

  const filasTabla = useMemo(() => {
    if (!informe || !visitas) return []
    const a = informe.actividad
    return visitas.serie.map((punto: Bucket & { visitas: number; visitantes: number; sesiones: number }, i) => ({
      periodo: punto.etiqueta,
      corta: punto.corta,
      visitantes: punto.visitantes,
      visitas: punto.visitas,
      sesiones: punto.sesiones,
      registros: a.registrosSerie[i] ?? 0,
      publicaciones: a.publicacionesSerie[i] ?? 0,
      mensajes: a.mensajesSerie[i] ?? 0,
      favoritos: a.favoritosSerie[i] ?? 0,
      cupones: a.cuponesSerie[i] ?? 0,
      creditos: a.creditosSerie[i] ?? 0,
      resenas: a.resenasSerie?.[i] ?? 0,
      denuncias: a.denunciasSerie?.[i] ?? 0,
    }))
  }, [informe, visitas])

  function exportarCsv() {
    if (!informe || !visitas) return
    const cabecera = [
      'Periodo', 'Visitantes', 'Visitas', 'Sesiones', 'Registros', 'Anuncios publicados',
      'Mensajes', 'Favoritos', 'Cupones canjeados', 'Compras de créditos', 'Reseñas', 'Denuncias',
    ]
    const lineas = filasTabla.map((f) => [
      f.periodo, f.visitantes, f.visitas, f.sesiones, f.registros, f.publicaciones,
      f.mensajes, f.favoritos, f.cupones, f.creditos, f.resenas, f.denuncias,
    ])
    const csv = [cabecera, ...lineas]
      .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `audiencia-${informe.rango.desde.slice(0, 10)}_${informe.rango.hasta.slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
    notify('CSV generado')
  }

  if (loading) return <Loading label="Calculando audiencia…" />

  if (!informe || !visitas) {
    return <Empty icon="📊" title="Sin datos" subtitle="No se pudo calcular el informe. Prueba a refrescar." />
  }

  const { actividad, estado, comparativa } = informe
  const sinVisitasSinDatos = visitas.visitas === 0

  return (
    <div className="space-y-5">
      {/* ── Controles ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">Audiencia y actividad</h2>
            <p className="text-sm text-gray-500">
              {informe.rango.etiqueta} · {informe.rango.dias} días ·{' '}
              {informe.rango.granularidad === 'dia' ? 'por día' : informe.rango.granularidad === 'semana' ? 'por semana' : 'por mes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportarCsv} disabled={filasTabla.length === 0}>
              <Download size={14} /> CSV
            </Button>
            <RefreshButton onClick={() => load(true)} loading={refreshing} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            items={PRESETS_RANGO.map((p) => ({ id: p.id, label: p.label }))}
            value={personalizado ? ('personalizado' as PresetRango) : preset}
            onChange={(valor) => {
              if (valor === 'personalizado') return
              setPersonalizado(false)
              setPreset(valor)
            }}
            className="flex-wrap"
          />
          <button
            type="button"
            onClick={() => setPersonalizado((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              personalizado ? 'border-brand-primary bg-brand-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Rango personalizado
          </button>
          <Segmented
            items={[
              { id: 'dia' as const, label: 'Día' },
              { id: 'semana' as const, label: 'Semana' },
              { id: 'mes' as const, label: 'Mes' },
            ]}
            value={granularidad}
            onChange={setGranularidad}
          />
        </div>

        {personalizado && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs">
            <label className="flex items-center gap-2">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1" />
            </label>
            <label className="flex items-center gap-2">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1" />
            </label>
            <Button
              size="xs"
              onClick={() => load(true)}
              disabled={!desde || !hasta || desde > hasta}
            >
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {(informe.degradado || informe.aviso || informe.filasTruncadas) && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            {informe.aviso && <p>{informe.aviso}</p>}
            {informe.filasTruncadas && (
              <p>El periodo es tan grande que algunas series se han cortado; los totales sí son exactos.</p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Las visitas solo cuentan a quien ha aceptado la medición en el aviso de cookies, sin IP ni datos personales.
      </p>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Visitantes únicos"
          value={formatNumber(visitas.visitantes)}
          icon={Users}
          accent="bg-blue-50 text-blue-600"
          trend={comparativa.visitantes != null ? { value: `${(data?.variacion.visitantes ?? 0) >= 0 ? '+' : ''}${data?.variacion.visitantes ?? 0}%`, positive: (data?.variacion.visitantes ?? 0) >= 0 } : undefined}
          helper={comparativa.visitantes != null ? `periodo anterior: ${formatNumber(comparativa.visitantes)}` : 'sin comparativa'}
        />
        <StatCard
          label="Páginas vistas"
          value={formatNumber(visitas.visitas)}
          icon={Eye}
          accent="bg-brand-primary/10 text-brand-primary"
          trend={comparativa.visitas != null ? { value: `${(data?.variacion.visitas ?? 0) >= 0 ? '+' : ''}${data?.variacion.visitas ?? 0}%`, positive: (data?.variacion.visitas ?? 0) >= 0 } : undefined}
          helper={comparativa.visitas != null ? `periodo anterior: ${formatNumber(comparativa.visitas)}` : 'sin comparativa'}
        />
        <StatCard
          label="Sesiones"
          value={formatNumber(visitas.sesiones)}
          icon={Activity}
          accent="bg-purple-50 text-purple-600"
          helper={visitas.paginasPorVisita != null ? `${visitas.paginasPorVisita} páginas por visitante` : undefined}
        />
        <StatCard
          label="Tiempo medio por página"
          value={formatearDuracion(visitas.duracionMedia)}
          icon={Clock}
          accent="bg-emerald-50 text-emerald-600"
          helper={visitas.nuevos != null ? `${formatNumber(visitas.nuevos)} nuevos · ${formatNumber(visitas.recurrente || 0)} recurrentes` : undefined}
        />
        <StatCard
          label="Registros"
          value={formatNumber(actividad.registros)}
          icon={UserPlus}
          accent="bg-amber-50 text-amber-600"
          trend={data ? { value: `${(data.variacion.registros ?? 0) >= 0 ? '+' : ''}${data.variacion.registros ?? 0}%`, positive: (data.variacion.registros ?? 0) >= 0 } : undefined}
          helper={`${formatNumber(actividad.nuevosProfesionales)} profesionales o camperizadores`}
        />
        <StatCard
          label="Anuncios publicados"
          value={formatNumber(actividad.publicaciones)}
          icon={Package}
          accent="bg-orange-50 text-orange-600"
          trend={data ? { value: `${(data.variacion.publicaciones ?? 0) >= 0 ? '+' : ''}${data.variacion.publicaciones ?? 0}%`, positive: (data.variacion.publicaciones ?? 0) >= 0 } : undefined}
          helper={`${formatNumber(estado.anunciosVendidosPeriodo)} vendidos en el periodo`}
        />
        <StatCard
          label="Mensajes"
          value={formatNumber(actividad.mensajes)}
          icon={MessageSquare}
          accent="bg-cyan-50 text-cyan-600"
          trend={data ? { value: `${(data.variacion.mensajes ?? 0) >= 0 ? '+' : ''}${data.variacion.mensajes ?? 0}%`, positive: (data.variacion.mensajes ?? 0) >= 0 } : undefined}
          helper="contactos entre compradores y vendedores"
        />
        <StatCard
          label="Favoritos guardados"
          value={formatNumber(actividad.favoritos)}
          icon={Heart}
          accent="bg-pink-50 text-pink-600"
          helper={`${formatNumber(actividad.cupones)} cupones canjeados`}
        />
      </div>

      {/* ── Evolución ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          title="Visitas por periodo"
          subtitle="Páginas vistas (barras) y visitantes únicos por encima"
          className="xl:col-span-2"
          bodyClassName="p-5"
        >
          {sinVisitasSinDatos ? (
            <Empty
              icon="👣"
              title="Todavía no hay visitas registradas"
              subtitle="La medición empieza en cuanto alguien navegue con el aviso de cookies aceptado. Si acabas de desplegar la migración, dale unas horas."
            />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                  <span>Páginas vistas</span>
                  <span className="text-gray-800">{formatNumber(visitas.visitas)} en total</span>
                </div>
                <Barras datos={serieChart} color="bg-gradient-to-t from-brand-primary/80 to-brand-primary" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                  <span>Visitantes únicos</span>
                  <span className="text-gray-800">{formatNumber(visitas.visitantes)} en total</span>
                </div>
                <Barras datos={visitantesChart} color="bg-gradient-to-t from-blue-500 to-blue-400" altura={64} />
              </div>
            </div>
          )}
        </Card>

        <Card title="De dónde viene la gente" subtitle="Fuentes de tráfico del periodo" bodyClassName="p-5">
          <div className="space-y-3">
            {(data?.fuentesAgrupadas || []).slice(0, 8).map((f) => {
              const total = (data?.fuentesAgrupadas || []).reduce((s, x) => s + x.visitas, 0) || 1
              return (
                <div key={f.clave}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{f.etiqueta}</span>
                    <span className="text-gray-500">
                      {formatNumber(f.visitas)} · {Math.round((f.visitas / total) * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${(f.visitas / total) * 100}%` }} />
                  </div>
                </div>
              )
            })}
            {(data?.fuentesAgrupadas || []).length === 0 && <p className="text-sm text-gray-500">Sin datos de origen todavía.</p>}
          </div>
        </Card>
      </div>

      {/* ── Tabla por periodo ─────────────────────────────────── */}
      <Card
        title="Detalle por periodo"
        subtitle="Todo lo que ha pasado en cada día, semana o mes del rango elegido"
        bodyClassName="p-0"
        actions={
          <span className="text-xs text-gray-400">
            {filasTabla.length} {informe.rango.granularidad === 'dia' ? 'días' : informe.rango.granularidad === 'semana' ? 'semanas' : 'meses'}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Periodo</th>
                <th className="px-3 py-3 text-right font-semibold">Visitantes</th>
                <th className="px-3 py-3 text-right font-semibold">Visitas</th>
                <th className="px-3 py-3 text-right font-semibold">Sesiones</th>
                <th className="px-3 py-3 text-right font-semibold">Registros</th>
                <th className="px-3 py-3 text-right font-semibold">Anuncios</th>
                <th className="px-3 py-3 text-right font-semibold">Mensajes</th>
                <th className="px-3 py-3 text-right font-semibold">Favoritos</th>
                <th className="px-3 py-3 text-right font-semibold">Cupones</th>
                <th className="px-3 py-3 text-right font-semibold">Créditos</th>
                <th className="px-3 py-3 text-right font-semibold">Reseñas</th>
                <th className="px-3 py-3 text-right font-semibold">Denuncias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filasTabla.map((f) => (
                <tr key={f.periodo} className="hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-800">{f.corta || f.periodo}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-blue-600">{formatNumber(f.visitantes)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{formatNumber(f.visitas)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.sesiones)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{formatNumber(f.registros)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{formatNumber(f.publicaciones)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.mensajes)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.favoritos)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.cupones)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.creditos)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.resenas)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{formatNumber(f.denuncias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filasTabla.length === 0 && <Empty icon="📅" title="Sin periodos en el rango" />}
        </div>
      </Card>

      {/* ── Rankings y dispositivos ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Páginas más vistas" bodyClassName="p-5">
          <ListaRanking
            titulo="Rutas del sitio"
            icono={<MousePointerClick size={15} className="text-brand-primary" />}
            filas={visitas.topPaginas.map((p) => ({ ...p, etiqueta: p.clave, url: p.tipo === 'home' ? '/' : p.clave }))}
          />
        </Card>

        <Card title="Anuncios más vistos" bodyClassName="p-5">
          <ListaRanking
            titulo="Fichas de producto"
            icono={<Package size={15} className="text-orange-500" />}
            filas={(data?.topProductos || []).map((p: any) => ({
              clave: p.productoId || p.slug,
              etiqueta: p.titulo || p.slug,
              visitas: Number(p.visitas) || 0,
              visitantes: Number(p.visitantes) || 0,
              url: productUrl({ id: p.productoId, slug: p.slug }),
            }))}
            vacio="Ningún anuncio ha recibido visitas en el periodo."
            sufijo="visitas"
          />
        </Card>

        <Card title="Dispositivos, idioma y horarios" bodyClassName="p-5">
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Monitor size={15} className="text-gray-500" /> Dispositivo
              </h4>
              <div className="space-y-1.5">
                {visitas.dispositivos.map((d) => (
                  <div key={d.clave} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                      {ICONO_DISPOSITIVO[d.clave] || <Monitor size={13} />}
                      {d.clave === 'movil' ? 'Móvil' : d.clave === 'tablet' ? 'Tablet' : d.clave === 'escritorio' ? 'Escritorio' : d.clave}
                    </span>
                    <span className="text-gray-500">{formatNumber(d.visitas)}</span>
                  </div>
                ))}
                {visitas.dispositivos.length === 0 && <p className="text-xs text-gray-400">Sin datos.</p>}
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Globe size={15} className="text-gray-500" /> Idioma
              </h4>
              <div className="space-y-1.5">
                {visitas.idiomas.map((i) => (
                  <div key={i.clave} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{i.clave === 'en' ? 'Inglés' : i.clave === 'es' ? 'Español' : i.clave}</span>
                    <span className="text-gray-500">{formatNumber(i.visitas)}</span>
                  </div>
                ))}
                {visitas.idiomas.length === 0 && <p className="text-xs text-gray-400">Sin datos.</p>}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-gray-900">Horas con más visitas</h4>
              <div className="flex h-16 items-end gap-[3px]">
                {visitas.horas.map((h) => {
                  const maximo = Math.max(1, ...visitas.horas.map((x) => x.visitas))
                  return (
                    <div key={h.hora} className="flex-1" title={`${h.hora}:00 · ${h.visitas} visitas`}>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-indigo-500/70 to-indigo-400"
                        style={{ height: `${Math.max(2, (h.visitas / maximo) * 58)}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-gray-400">
                <span>00h</span><span>12h</span><span>23h</span>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-gray-900">Días de la semana</h4>
              <div className="space-y-1">
                {visitas.diasSemana.map((d) => {
                  const maximo = Math.max(1, ...visitas.diasSemana.map((x) => x.visitas))
                  return (
                    <div key={d.dow} className="flex items-center gap-2 text-[11px]">
                      <span className="w-16 text-gray-500">{NOMBRE_DIA[d.dow - 1] || d.dow}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-brand-primary/70" style={{ width: `${(d.visitas / maximo) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-gray-500">{formatNumber(d.visitas)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Estado de la plataforma + anuncios fríos ──────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Estado de la plataforma" subtitle="Datos de ahora mismo, no del periodo" bodyClassName="p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Usuarios registrados', valor: estado.usuariosTotal },
              { label: 'Usuarios verificados', valor: estado.usuariosVerificados },
              { label: 'Anuncios publicados (total)', valor: estado.anunciosTotales },
              { label: 'Anuncios activos', valor: estado.anunciosActivos },
              { label: 'Anuncios vendidos', valor: estado.anunciosVendidos },
              { label: 'Usuarios activos en el periodo', valor: estado.usuariosActivos },
              { label: 'Usuarios con pack de pago', valor: estado.usuariosConPack },
              { label: 'En mes de prueba', valor: estado.usuariosEnPrueba },
              { label: 'Vendidos en el periodo', valor: estado.anunciosVendidosPeriodo },
              { label: 'Reseñas en el periodo', valor: actividad.resenas },
              { label: 'Denuncias en el periodo', valor: actividad.denuncias },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                <p className="text-lg font-black text-gray-900">{formatNumber(k.valor)}</p>
                <p className="text-[11px] text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold">Packs activos:</span>
            {estado.packsPorPlan.map((p) => (
              <Badge key={p.plan} tone={p.plan === 'starter' ? 'blue' : p.plan === 'plus' ? 'brand' : 'purple'}>
                {p.plan === 'starter' ? 'Starter' : p.plan === 'plus' ? 'Plus' : 'Unlimited'} · {p.usuarios}
              </Badge>
            ))}
            {estado.porcentajeAnunciosConVisitas != null && (
              <span className="ml-1">
                · {estado.porcentajeAnunciosConVisitas}% de los anuncios activos recibió visitas ({formatNumber(estado.anunciosConVisitasPeriodo)})
              </span>
            )}
          </div>
        </Card>

        <Card
          title="Anuncios activos sin ninguna visita"
          subtitle="Los que necesitan una vuelta: precio, fotos o destacarlo"
          bodyClassName="p-0"
          actions={
            (data?.productosSinVisitas || []).length > 0 ? (
              <Badge tone="orange">{(data?.productosSinVisitas || []).length}</Badge>
            ) : undefined
          }
        >
          <div className="divide-y divide-gray-50">
            {(data?.productosSinVisitas || []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-sm">📦</span>
                <div className="min-w-0 flex-1">
                  <LocalLink href={productUrl({ id: p.id, slug: p.slug })} className="block truncate text-sm font-semibold text-gray-800 hover:text-brand-primary">
                    {p.titulo}
                  </LocalLink>
                  <p className="text-xs text-gray-500">Publicado {timeAgo(p.creadoEn)} · sin visitas en el periodo</p>
                </div>
                <Badge tone="gray">{formatDate(p.creadoEn)}</Badge>
              </div>
            ))}
            {(data?.productosSinVisitas || []).length === 0 && (
              <Empty icon="✅" title="Ningún anuncio se ha quedado sin visitas" subtitle="Buen trabajo: todos los activos reciben tráfico." />
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
        <BarChart3 size={14} className="text-brand-primary" />
        <span>
          Informe generado {timeAgo(informe.generadoEn)} · periodo anterior: registros {formatNumber(comparativa.registros)},
          anuncios {formatNumber(comparativa.publicaciones)}, mensajes {formatNumber(comparativa.mensajes)}.
        </span>
      </div>
    </div>
  )
}
