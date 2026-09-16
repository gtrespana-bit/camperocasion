'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Package, Pause, Play, Star, Zap, Trash2, Eye, ExternalLink, CheckSquare, Square,
  Filter, ChevronLeft, ChevronRight, Search, Loader2,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { productUrl } from '@/lib/product-url'
import { Badge, Button, Card, Confirm, Empty, Loading, Modal, RefreshButton, SearchInput, Segmented, formatDate, formatDateTime, formatMoney, formatNumber, timeAgo } from './AdminUi'
import { apiJson, type Producto, type Perfil } from './admin-utils'

type TabKey = 'todas' | 'activas' | 'pausadas' | 'pendientes' | 'vendidas' | 'destacadas' | 'rechazadas'
type SortKey = 'creado_en' | 'precio_usd' | 'visitas' | 'titulo'

const PAGE_SIZE = 20

function EstadoBadge({ p }: { p: Producto }) {
  if (p.vendido) return <Badge tone="green">Vendida</Badge>
  if (p.estado_moderacion === 'pendiente') return <Badge tone="yellow">Pendiente</Badge>
  if (p.estado_moderacion === 'rechazado') return <Badge tone="red">Rechazada</Badge>
  if (!p.activo) return <Badge tone="gray">Pausada</Badge>
  return <Badge tone="green">Activa</Badge>
}

export default function AdminPublicaciones({ notify }: { notify: (msg: string) => void }) {
  const [items, setItems] = useState<Producto[]>([])
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState<TabKey>('todas')
  const [sortBy, setSortBy] = useState<SortKey>('creado_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Producto | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [bulkAction, setBulkAction] = useState<'activar' | 'pausar' | 'eliminar' | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/admin/productos', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudieron cargar las publicaciones')
      const productos = (json.productos || []) as Producto[]
      setItems(productos)
      const userIds = Array.from(new Set(productos.map((p) => p.user_id).filter(Boolean))).slice(0, 100)
      if (userIds.length) {
        try {
          const res = await apiJson<{ ok: boolean; perfiles: Perfil[] }>('/api/admin/perfiles-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds }),
          })
          const m: Record<string, Perfil> = {}
          ;(res.perfiles || []).forEach((p) => (m[p.id] = p))
          setPerfiles(m)
        } catch {
          // sin perfiles no es fatal
        }
      }
      setSelected(new Set())
      setPage(1)
    } catch (e: any) {
      notify('❌ ' + (e?.message || 'Error cargando publicaciones'))
    }
    setLoading(false)
    setRefreshing(false)
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = [...items]
    if (tab === 'activas') list = list.filter((p) => p.activo && p.estado_moderacion === 'aprobado' && !p.vendido)
    if (tab === 'pausadas') list = list.filter((p) => !p.activo && !p.vendido)
    if (tab === 'pendientes') list = list.filter((p) => p.estado_moderacion === 'pendiente')
    if (tab === 'vendidas') list = list.filter((p) => p.vendido)
    if (tab === 'destacadas') list = list.filter((p) => p.destacado)
    if (tab === 'rechazadas') list = list.filter((p) => p.estado_moderacion === 'rechazado')
    if (busqueda) {
      const q = busqueda.toLowerCase()
      list = list.filter((p) =>
        (p.titulo || '').toLowerCase().includes(q) ||
        (p.ubicacion_ciudad || '').toLowerCase().includes(q) ||
        (p.subcategoria || '').toLowerCase().includes(q) ||
        (p.marca || '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      const av = a[sortBy] ?? ''
      const bv = b[sortBy] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [items, busqueda, tab, sortBy, sortDir])

  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const tabs = [
    { id: 'todas' as const, label: `Todas (${items.length})` },
    { id: 'activas' as const, label: `Activas (${items.filter((p) => p.activo && p.estado_moderacion === 'aprobado' && !p.vendido).length})` },
    { id: 'pendientes' as const, label: `Pendientes (${items.filter((p) => p.estado_moderacion === 'pendiente').length})` },
    { id: 'vendidas' as const, label: `Vendidas (${items.filter((p) => p.vendido).length})` },
    { id: 'pausadas' as const, label: `Pausadas (${items.filter((p) => !p.activo && !p.vendido).length})` },
    { id: 'destacadas' as const, label: `Destacadas (${items.filter((p) => p.destacado).length})` },
    { id: 'rechazadas' as const, label: `Rechazadas (${items.filter((p) => p.estado_moderacion === 'rechazado').length})` },
  ]

  async function toggleActivo(p: Producto, activo: boolean) {
    if (!p.id) return
    setActionId(p.id)
    try {
      await apiJson('/api/admin/toggle-activo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, activo }) })
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo } : x)))
      notify(activo ? '✅ Publicación activada' : '⏸️ Publicación pausada')
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setActionId(null)
  }

  async function toggleDestacado(p: Producto) {
    if (!p.id) return
    setActionId(p.id)
    const next = !p.destacado
    try {
      await apiJson('/api/admin/toggle-destacado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, destacado: next }) })
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, destacado: next, destacado_hasta: next ? new Date(Date.now() + 48 * 3600000).toISOString() : null } : x)))
      notify(next ? '⭐ Destacada por 48h' : '☆ Destacado quitado')
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setActionId(null)
  }

  async function boost(p: Producto) {
    if (!p.id) return
    setActionId(p.id)
    try {
      await apiJson('/api/admin/boost-producto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id }) })
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, boosteado_en: new Date().toISOString() } : x)))
      notify('⚡ Publicación boosted')
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setActionId(null)
  }

  async function eliminar(id: string) {
    setActionId(id)
    try {
      await apiJson('/api/admin/eliminar-producto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id }) })
      setItems((prev) => prev.filter((x) => x.id !== id))
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
      notify('🗑️ Publicación eliminada')
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setActionId(null)
  }

  async function runBulk() {
    if (!bulkAction || selected.size === 0) return
    setBusy(true)
    let ok = 0
    let fail = 0
    const ids = Array.from(selected)
    for (const id of ids) {
      const p = items.find((x) => x.id === id)
      if (!p) continue
      try {
        if (bulkAction === 'activar') await apiJson('/api/admin/toggle-activo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, activo: true }) })
        else if (bulkAction === 'pausar') await apiJson('/api/admin/toggle-activo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, activo: false }) })
        else if (bulkAction === 'eliminar') await apiJson('/api/admin/eliminar-producto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id }) })
        ok += 1
      } catch {
        fail += 1
      }
    }
    setBulkAction(null)
    setSelected(new Set())
    setBusy(false)
    await load(true)
    notify(bulkAction === 'eliminar' ? `🗑️ ${ok} publicaciones eliminadas${fail ? ` · ${fail} fallaron` : ''}` : `✅ ${ok} publicaciones actualizadas${fail ? ` · ${fail} fallaron` : ''}`)
  }

  const counts = { total: items.length, visible: filtered.length }

  if (loading) return <Loading label="Cargando publicaciones…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Publicaciones</h2>
          <p className="text-sm text-gray-500">{counts.visible} de {counts.total} publicaciones cargadas</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-2">
              <span className="text-xs font-bold text-brand-primary">{selected.size} seleccionadas</span>
              <Button size="xs" variant="success" onClick={() => setBulkAction('activar')}>Activar</Button>
              <Button size="xs" variant="outline" onClick={() => setBulkAction('pausar')}>Pausar</Button>
              <Button size="xs" variant="danger" onClick={() => setBulkAction('eliminar')}>Eliminar</Button>
              <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Quitar</Button>
            </div>
          )}
          <RefreshButton onClick={() => load(true)} loading={refreshing} />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented items={tabs} value={tab} onChange={(v) => { setTab(v); setPage(1) }} />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={busqueda} onChange={(v) => { setBusqueda(v); setPage(1) }} placeholder="Buscar título, ciudad, marca…" className="w-full lg:w-72" />
          {(['creado_en', 'precio_usd', 'visitas', 'titulo'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { const next = sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'; setSortBy(f); setSortDir(next) }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${sortBy === f ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f === 'creado_en' ? 'Fecha' : f === 'precio_usd' ? 'Precio' : f === 'visitas' ? 'Visitas' : 'Título'} {sortBy === f ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <Card bodyClassName="p-0">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3"><button onClick={() => { setSelected((prev) => selected.size === pageItems.length ? new Set() : new Set(pageItems.map((p) => p.id))) }} className="flex items-center gap-1 font-semibold">{selected.size === pageItems.length && pageItems.length ? <CheckSquare size={14} /> : <Square size={14} />} All</button></th>
                <th className="px-3 py-3 font-semibold">Publicación</th>
                <th className="px-3 py-3 font-semibold">Vendedor</th>
                <th className="px-3 py-3 text-right font-semibold">Precio</th>
                <th className="px-3 py-3 text-center font-semibold">Visitas</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 font-semibold">Registro</th>
                <th className="px-3 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageItems.map((p) => (
                <tr key={p.id} className="transition hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}>
                      {selected.has(p.id) ? <CheckSquare size={17} className="text-brand-primary" /> : <Square size={17} className="text-gray-300" />}
                    </button>
                  </td>
                  <td className="max-w-sm px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        {p.imagen_url ? <Image src={p.imagen_url} alt="" width={48} height={48} className="object-cover" /> : <span className="text-lg">📦</span>}
                      </div>
                      <div className="min-w-0">
                        <button onClick={() => setDetail(p)} className="block max-w-xs truncate text-left font-semibold text-gray-800 hover:text-brand-primary">{p.titulo || 'Sin título'}</button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                          {p.subcategoria && <span>{p.subcategoria}</span>}
                          {p.ubicacion_ciudad && <span>· {p.ubicacion_ciudad}</span>}
                          {p.destacado && <Badge tone="brand">⭐</Badge>}
                          {p.boosteado_en && <Badge tone="green">⚡</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-700">{perfiles[p.user_id]?.nombre || '—'}</p>
                    <p className="text-xs text-gray-400">{perfiles[p.user_id]?.email || ''}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-brand-primary">{formatMoney(p.precio_usd)}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{formatNumber(p.visitas)}</td>
                  <td className="px-3 py-3"><EstadoBadge p={p} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{formatDate(p.creado_en)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setDetail(p)} title="Ver detalle" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"><Eye size={15} /></button>
                      <button onClick={() => toggleActivo(p, !p.activo)} disabled={actionId === p.id} title={p.activo ? 'Pausar' : 'Activar'} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">{p.activo ? <Pause size={15} /> : <Play size={15} />}</button>
                      <button onClick={() => toggleDestacado(p)} disabled={actionId === p.id} title="Destacar" className="rounded-lg p-1.5 text-yellow-500 transition hover:bg-yellow-50"><Star size={15} /></button>
                      <button onClick={() => boost(p)} disabled={actionId === p.id} title="Boostear" className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-emerald-50"><Zap size={15} /></button>
                      <a href={productUrl(p)} target="_blank" rel="noopener noreferrer" title="Ver sitio" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"><ExternalLink size={15} /></a>
                      <button onClick={() => eliminar(p.id)} disabled={actionId === p.id} title="Eliminar" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile/card list */}
        <div className="divide-y divide-gray-50 lg:hidden">
          {pageItems.map((p) => (
            <div key={p.id} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  {p.imagen_url ? <Image src={p.imagen_url} alt="" width={56} height={56} className="object-cover" /> : <span className="text-xl">📦</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <button onClick={() => setDetail(p)} className="block w-full truncate text-left font-semibold text-gray-800">{p.titulo}</button>
                  <p className="text-xs text-gray-500">{perfiles[p.user_id]?.nombre || '—'} · {formatDate(p.creado_en)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><EstadoBadge p={p} /></div>
                </div>
                <button onClick={() => setSelected((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}>
                  {selected.has(p.id) ? <CheckSquare size={18} className="text-brand-primary" /> : <Square size={18} className="text-gray-300" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-brand-primary">{formatMoney(p.precio_usd)}</span>
                <div className="flex gap-1">
                  <button onClick={() => setDetail(p)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Eye size={16} /></button>
                  <button onClick={() => toggleActivo(p, !p.activo)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">{p.activo ? <Pause size={16} /> : <Play size={16} />}</button>
                  <button onClick={() => toggleDestacado(p)} className="rounded-lg p-2 text-yellow-500 hover:bg-yellow-50"><Star size={16} /></button>
                  <button onClick={() => boost(p)} className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-50"><Zap size={16} /></button>
                  <button onClick={() => eliminar(p.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {pageItems.length === 0 && <Empty icon="📦" title="No hay publicaciones" subtitle="Ajusta los filtros o trata de nuevo." />}
      </Card>

      {/* pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /> Anterior</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente <ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.titulo || 'Publicación'} subtitle={detail ? `${formatDateTime(detail.creado_en)} · ${formatNumber(detail.visitas)} visitas` : ''} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                {detail.imagen_url ? <Image src={detail.imagen_url} alt="" width={400} height={400} className="object-cover" /> : <span className="text-4xl">📦</span>}
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <EstadoBadge p={detail} />
                  {detail.destacado && <Badge tone="brand">⭐ Destacado</Badge>}
                  {detail.boosteado_en && <Badge tone="green">⚡ Boosted</Badge>}
                </div>
                <p className="text-3xl font-black text-brand-primary">{formatMoney(detail.precio_usd)}</p>
                {detail.marca && <p className="text-sm text-gray-600"><strong>Marca:</strong> {detail.marca}</p>}
                {detail.modelo && <p className="text-sm text-gray-600"><strong>Modelo:</strong> {detail.modelo}</p>}
                {detail.subcategoria && <p className="text-sm text-gray-600"><strong>Categoría:</strong> {detail.subcategoria}</p>}
                <p className="text-sm text-gray-600"><strong>Ubicación:</strong> {detail.ubicacion_ciudad || '—'}{detail.ubicacion_estado ? `, ${detail.ubicacion_estado}` : ''}</p>
                <p className="text-sm text-gray-600"><strong>Estado del artículo:</strong> {detail.estado || '—'}</p>
              </div>
            </div>
            {detail.descripcion && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Descripción</h4>
                <p className="whitespace-pre-line rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{detail.descripcion}</p>
              </div>
            )}
            {detail.motivo_moderacion && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">⚠️ Motivo de moderación: {detail.motivo_moderacion}</div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <Button size="sm" variant={detail.activo ? 'outline' : 'success'} onClick={() => toggleActivo(detail, !detail.activo)}>{detail.activo ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Activar</>}</Button>
              <Button size="sm" variant="secondary" onClick={() => toggleDestacado(detail)} disabled={actionId === detail.id}><Star size={14} /> {detail.destacado ? 'Quitar destacado' : 'Destacar 48h'}</Button>
              <Button size="sm" variant="secondary" onClick={() => boost(detail)} disabled={actionId === detail.id}><Zap size={14} /> Boost</Button>
              <a href={productUrl(detail)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"><Eye size={14} /> Ver en sitio</a>
              <Button size="sm" variant="danger" onClick={() => { eliminar(detail.id); setDetail(null) }} disabled={actionId === detail.id}><Trash2 size={14} /> Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>

      <Confirm
        open={!!bulkAction}
        onClose={() => setBulkAction(null)}
        onConfirm={runBulk}
        loading={busy}
        title={bulkAction === 'eliminar' ? 'Eliminar publicaciones' : 'Aplicar cambio masivo'}
        message={`Se aplicará "${bulkAction === 'activar' ? 'activar' : bulkAction === 'pausar' ? 'pausar' : 'eliminar'}" a ${selected.size} publicaciones.${bulkAction === 'eliminar' ? ' Esta acción no se puede deshacer.' : ''}`}
        confirmLabel={bulkAction === 'eliminar' ? 'Eliminar' : 'Aplicar'}
        danger={bulkAction === 'eliminar'}
      />
    </div>
  )
}
