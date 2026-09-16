'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, X, Eye, ShieldCheck, ShieldAlert } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import LocalLink from '@/components/LocalLink'
import { productUrl } from '@/lib/product-url'
import { Badge, Button, Card, Empty, Loading, Modal, RefreshButton, SearchInput, Segmented, formatDate, formatMoney, timeAgo } from './AdminUi'
import { apiJson, type Denuncia, type Producto } from './admin-utils'

export default function AdminModeracion({
  notify,
  adminEmail,
}: {
  notify: (msg: string) => void
  adminEmail: string
}) {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [pendientes, setPendientes] = useState<Producto[]>([])
  const [revisados, setRevisados] = useState<Denuncia[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'denuncias' | 'pendientes'>('denuncias')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ product: Producto | null; denuncia: Denuncia | null } | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      // Denuncias (activas + revisadas) vía endpoint server-side (service_role):
      // la tabla está protegida por RLS y el embed `reportante:perfiles` no es
      // válido desde el cliente.
      const res = await fetch('/api/admin/denuncias', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudieron cargar las denuncias')

      const [{ data: pends }] = await Promise.all([
        supabase
          .from('productos')
          .select('id, slug, user_id, titulo, descripcion, precio_usd, imagen_url, subcategoria, marca, ubicacion_ciudad, activo, vendido, estado_moderacion, motivo_moderacion, visitas, creado_en')
          .eq('estado_moderacion', 'pendiente')
          .order('creado_en', { ascending: false }),
      ])

      setDenuncias((json.denuncias || []) as Denuncia[])
      setPendientes((pends || []) as Producto[])
      setRevisados((json.revisados || []) as Denuncia[])
    } catch (e: any) {
      notify('❌ ' + (e?.message || 'Error cargando moderación'))
    }
    setLoading(false)
    setRefreshing(false)
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  async function updateDenuncia(id: string, action: 'ignorar' | 'bloquear') {
    const res = await fetch('/api/admin/denuncias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo actualizar la denuncia')
  }

  async function ignorarDenuncia(id: string) {
    setBusyId(id)
    try {
      await updateDenuncia(id, 'ignorar')
      notify('✅ Denuncia descartada')
      setDenuncias((prev) => prev.filter((d) => d.id !== id))
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusyId(null)
  }

  async function bloquearDenuncia(d: Denuncia) {
    if (!d.id || !d.producto_id) return
    setBusyId(d.id)
    try {
      await updateDenuncia(d.id, 'bloquear')
      await apiJson('/api/admin/moderar-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: d.producto_id, action: 'rechazar', adminEmail }),
      })
      notify('🚫 Producto bloqueado')
      setDenuncias((prev) => prev.filter((x) => x.id !== d.id))
      await load(true)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusyId(null)
  }

  async function aprobarProducto(id: string) {
    setBusyId(id)
    try {
      await apiJson('/api/admin/moderar-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, action: 'aprobar', adminEmail }),
      })
      notify('✅ Publicación aprobada')
      setPendientes((prev) => prev.filter((p) => p.id !== id))
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusyId(null)
  }

  async function rechazarProducto(id: string) {
    setBusyId(id)
    try {
      await apiJson('/api/admin/moderar-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, action: 'rechazar', adminEmail }),
      })
      notify('🚫 Publicación rechazada')
      setPendientes((prev) => prev.filter((p) => p.id !== id))
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusyId(null)
  }

  const filteredDenuncias = useMemo(() => {
    if (!query) return denuncias
    const q = query.toLowerCase()
    return denuncias.filter((d) =>
      (d.producto?.titulo || '').toLowerCase().includes(q) ||
      (d.motivo || '').toLowerCase().includes(q) ||
      (d.reportante?.nombre || '').toLowerCase().includes(q),
    )
  }, [denuncias, query])

  const filteredPendientes = useMemo(() => {
    if (!query) return pendientes
    const q = query.toLowerCase()
    return pendientes.filter((p) =>
      (p.titulo || '').toLowerCase().includes(q) ||
      (p.subcategoria || '').toLowerCase().includes(q) ||
      (p.ubicacion_ciudad || '').toLowerCase().includes(q),
    )
  }, [pendientes, query])

  if (loading) return <Loading label="Cargando cola de moderación…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700"><ShieldAlert size={22} /></span>
          <div>
            <h2 className="text-xl font-black text-gray-900">Moderación</h2>
            <p className="text-sm text-gray-500">{denuncias.length} denuncias activas · {pendientes.length} publicaciones por revisar</p>
          </div>
        </div>
        <RefreshButton onClick={() => load(true)} loading={refreshing} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented items={[
          { id: 'denuncias' as const, label: `🚨 Denuncias (${denuncias.length})` },
          { id: 'pendientes' as const, label: `⏳ Pendientes (${pendientes.length})` },
        ]} value={tab} onChange={setTab} />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar en la cola…" className="w-full sm:w-72" />
      </div>

      {tab === 'denuncias' && (
        <div className="space-y-3">
          {filteredDenuncias.length === 0 && <Empty icon="✅" title="Sin denuncias activas" subtitle="Todo el contenido reportado se ha resuelto." />}
                  {filteredDenuncias.map((d) => (
            <Card key={d.id} bodyClassName="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 items-start gap-4">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={18} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setDetail({ product: null, denuncia: d })} className="font-bold text-gray-800 hover:text-brand-primary">{d.producto?.titulo || 'Producto desconocido'}</button>
                      <Badge tone="red">{d.motivo || 'Reporte'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{d.reportante?.nombre || 'Desconocido'} reportó {timeAgo(d.creada_en)}</p>
                    {d.descripcion && <p className="mt-2 text-sm text-gray-600">{d.descripcion}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { if (d.producto_id) window.open(`/producto/${d.producto_id}`, '_blank') }}><Eye size={14} /> Ver</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => ignorarDenuncia(d.id)}><X size={14} /> Ignorar</Button>
                  <Button size="sm" variant="danger" disabled={busyId === d.id} onClick={() => bloquearDenuncia(d)}><ShieldCheck size={14} /> Bloquear</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'pendientes' && (
        <div className="space-y-3">
          {filteredPendientes.length === 0 && <Empty icon="🎉" title="Sin publicaciones por revisar" subtitle="La cola de moderación está limpia." />}
          {filteredPendientes.map((p) => (
            <Card key={p.id} bodyClassName="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <button className="flex flex-1 items-start gap-4 text-left" onClick={() => setDetail({ product: p, denuncia: null })}>
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                    {p.imagen_url ? <Image src={p.imagen_url} alt="" width={56} height={56} className="object-cover" /> : <span className="text-xl">📦</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 hover:text-brand-primary">{p.titulo}</p>
                    <p className="mt-0.5 text-sm font-bold text-brand-primary">{formatMoney(p.precio_usd)}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{p.subcategoria || '—'}</span>
                      <span>· {p.ubicacion_ciudad || 'VE'}</span>
                      <span>· {formatDate(p.creado_en)}</span>
                    </div>
                    {p.motivo_moderacion && <p className="mt-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700">⚠️ {p.motivo_moderacion}</p>}
                  </div>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDetail({ product: p, denuncia: null })}><Eye size={14} /> Detalle</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(productUrl(p), '_blank')}><ExternalLinkIcon /> Ver sitio</Button>
                  <Button size="sm" variant="success" disabled={busyId === p.id} onClick={() => aprobarProducto(p.id)}><Check size={14} /> Aprobar</Button>
                  <Button size="sm" variant="danger" disabled={busyId === p.id} onClick={() => rechazarProducto(p.id)}><X size={14} /> Rechazar</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* revisadas */}
      <Card title="Denuncias resueltas recientes" subtitle="Historial de moderación" bodyClassName="p-0">
        <div className="divide-y divide-gray-50">
          {revisados.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-500">Aún no hay denuncias resueltas.</p>}
          {revisados.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${d.estado === 'resuelta' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{d.estado === 'resuelta' ? <Check size={15} /> : <X size={15} />}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-700">{d.motivo || 'Reporte'}</p>
                  <p className="text-xs text-gray-400">{formatDate(d.creada_en)} · {d.estado}</p>
                </div>
              </div>
              <Badge tone={d.estado === 'resuelta' ? 'green' : 'gray'}>{d.estado}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.product?.titulo || detail?.denuncia?.producto?.titulo || 'Detalle'} subtitle="Revisión de contenido" size="lg">
        {detail && (
          <div className="space-y-5">
            {detail.product && (
              <>
                {detail.product.imagen_url && <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gray-100"><Image src={detail.product.imagen_url} alt="" width={640} height={400} className="object-cover" /></div>}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-4">
                  <div><span className="text-gray-400">Precio</span><p className="font-bold text-brand-primary">{formatMoney(detail.product.precio_usd)}</p></div>
                  <div><span className="text-gray-400">Categoría</span><p className="font-semibold">{detail.product.subcategoria || '—'}</p></div>
                  <div><span className="text-gray-400">Ubicación</span><p className="font-semibold">{detail.product.ubicacion_ciudad || '—'}</p></div>
                  <div><span className="text-gray-400">Visitas</span><p className="font-semibold">{detail.product.visitas || 0}</p></div>
                </div>
                {detail.product.descripcion && <p className="whitespace-pre-line rounded-xl bg-gray-50 p-4 text-sm text-gray-600">{detail.product.descripcion}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="success" disabled={busyId === detail.product.id} onClick={() => { aprobarProducto(detail.product!.id); setDetail(null) }}><Check size={14} /> Aprobar</Button>
                  <Button size="sm" variant="danger" disabled={busyId === detail.product.id} onClick={() => { rechazarProducto(detail.product!.id); setDetail(null) }}><X size={14} /> Rechazar</Button>
                  <a href={productUrl(detail.product)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">Ver sitio</a>
                </div>
              </>
            )}
            {detail.denuncia && (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
                  <div><span className="text-gray-400">Motivo</span><p className="font-semibold">{detail.denuncia.motivo || '—'}</p></div>
                  <div><span className="text-gray-400">Reportante</span><p className="font-semibold">{detail.denuncia.reportante?.nombre || '—'}</p></div>
                  <div className="col-span-2"><span className="text-gray-400">Producto</span><p className="font-semibold">{detail.denuncia.producto?.titulo || '—'}</p></div>
                </div>
                {detail.denuncia.descripcion && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">{detail.denuncia.descripcion}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" disabled={busyId === detail.denuncia.id} onClick={() => { ignorarDenuncia(detail.denuncia!.id); setDetail(null) }}><X size={14} /> Ignorar</Button>
                  <Button size="sm" variant="danger" disabled={busyId === detail.denuncia.id} onClick={() => { bloquearDenuncia(detail.denuncia!); setDetail(null) }}><ShieldCheck size={14} /> Bloquear publicación</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
  )
}
