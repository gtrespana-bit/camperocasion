'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tag, Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { Badge, Button, Card, Empty, Loading, Modal, RefreshButton, formatNumber } from './AdminUi'
import { apiJson } from './admin-utils'

type Categoria = {
  id: number
  nombre: string
  count?: number
}

export default function AdminCategorias({ notify }: { notify: (msg: string) => void }) {
  const [items, setItems] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nueva, setNueva] = useState('')
  const [edit, setEdit] = useState<Categoria | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [deleteCat, setDeleteCat] = useState<Categoria | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; categorias: Categoria[] }>('/api/admin/categorias')
      setItems(res.categorias || [])
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setLoading(false)
    setRefreshing(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  const totalProducts = useMemo(() => items.reduce((s, c) => s + (c.count || 0), 0), [items])

  async function agregar() {
    if (!nueva.trim()) return
    setBusy(true)
    try {
      await apiJson('/api/admin/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nueva.trim() }) })
      notify('✅ Categoría añadida')
      setNueva('')
      await load(true)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusy(false)
  }

  async function guardarEdicion() {
    if (!edit || !nombreEdit.trim()) return
    setBusy(true)
    try {
      await apiJson(`/api/admin/categorias?id=${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombreEdit.trim() }) })
      notify('✅ Categoría actualizada')
      setEdit(null)
      await load(true)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusy(false)
  }

  async function borrar() {
    if (!deleteCat) return
    setBusy(true)
    try {
      await apiJson(`/api/admin/categorias?id=${deleteCat.id}`, { method: 'DELETE' })
      notify('🗑️ Categoría eliminada')
      setDeleteCat(null)
      await load(true)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusy(false)
  }

  if (loading) return <Loading label="Cargando categorías…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Categorías</h2>
          <p className="text-sm text-gray-500">{items.length} categorías · {formatNumber(totalProducts)} publicaciones asignadas</p>
        </div>
        <RefreshButton onClick={() => load(true)} loading={refreshing} />
      </div>

      <Card title="Añadir categoría" subtitle="Las categorías organizan todo el marketplace" bodyClassName="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder="Nombre de la nueva categoría (ej: mascotas)"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          <Button onClick={agregar} disabled={busy || !nueva.trim()}><Plus size={15} /> Añadir</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((c) => (
          <Card key={c.id} bodyClassName="p-4" className="group">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary"><Tag size={18} /></span>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => { setEdit(c); setNombreEdit(c.nombre) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-primary"><Pencil size={14} /></button>
                <button onClick={() => setDeleteCat(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-bold capitalize text-gray-800">{c.nombre}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{formatNumber(c.count)} publicaciones</span>
              <Badge tone="gray">ID {c.id}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {items.length === 0 && <Empty icon="🗂️" title="Aún no hay categorías" subtitle="Crea la primera para organizar el marketplace." />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar categoría" size="sm" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={guardarEdicion} disabled={busy || !nombreEdit.trim()}><Pencil size={14} /> Guardar</Button></>}>
        <input value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold capitalize outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" />
      </Modal>

      <Modal open={!!deleteCat} onClose={() => setDeleteCat(null)} title="Eliminar categoría" size="sm" footer={<><Button variant="outline" onClick={() => setDeleteCat(null)}>Cancelar</Button><Button variant="danger" onClick={borrar} disabled={busy || !!deleteCat?.count}><Trash2 size={14} /> Eliminar</Button></>}>
        {deleteCat && (
          <div className="space-y-3 text-sm">
            <p className="font-bold text-gray-800">¿Eliminar la categoría <span className="capitalize">{deleteCat.nombre}</span>?</p>
            {deleteCat.count ? (
              <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">No se puede eliminar porque tiene {deleteCat.count} publicaciones asignadas. Primero mueve o elimina esas publicaciones.</p>
            ) : (
              <p className="text-sm text-gray-600">Esta categoría está vacía y puede eliminarse de forma segura.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
