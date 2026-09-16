'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileJson, Package, Users, CreditCard, Star, History, ShieldCheck, AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import { Badge, Button, Card, formatNumber } from './AdminUi'
import { apiJson } from './admin-utils'

type ContextType = 'csv' | 'json'

export default function AdminExportar({ notify }: { notify: (msg: string) => void }) {
  const [exportando, setExportando] = useState<string | null>(null)
  const [tipo, setTipo] = useState<ContextType>('csv')
  const [rango, setRango] = useState<'7' | '30' | '90' | 'all'>('all')

  function descargar(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function toCSV(headers: string[], rows: Array<Record<string, any>>) {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  }

  function toJSON(rows: any) {
    return JSON.stringify(rows, null, 2)
  }

  function dateRange() {
    if (rango === 'all') return null
    return new Date(Date.now() - Number(rango) * 86400000).toISOString()
  }

  async function fetchExportar(dataset: 'productos' | 'resenas' | 'solicitudes' | 'denuncias'): Promise<any[]> {
    const res = await fetch('/api/admin/exportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset, since: dateRange() }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudieron exportar los datos')
    return json.rows || []
  }

  async function exportarProductos() {
    setExportando('productos')
    try {
      const rows = await fetchExportar('productos')
      const headers = ['id', 'slug', 'user_id', 'titulo', 'precio_usd', 'categoria_id', 'subcategoria', 'marca', 'estado', 'ubicacion_estado', 'ubicacion_ciudad', 'activo', 'vendido', 'estado_moderacion', 'destacado', 'visitas', 'creado_en']
      descargar(`productos_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(headers, rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} publicaciones exportadas`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarUsuarios() {
    setExportando('usuarios')
    try {
      const res = await apiJson<{ usuarios: any[] }>('/api/admin/usuarios')
      const rows = res.usuarios || []
      const headers = ['id', 'nombre', 'email', 'telefono', 'estado', 'ciudad', 'credito_balance', 'verificado', 'nivel_confianza', 'creado_en']
      descargar(`usuarios_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(headers, rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} usuarios exportados`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarTransacciones() {
    setExportando('transacciones')
    try {
      const res = await apiJson<{ transacciones: any[] }>('/api/admin/transacciones?limit=500')
      const rows = res.transacciones || []
      descargar(`transacciones_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(['id', 'user_id', 'tipo', 'monto', 'precio_usd', 'metodo_pago', 'estado', 'creado_en'], rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} transacciones exportadas`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarResenas() {
    setExportando('resenas')
    try {
      const rows = await fetchExportar('resenas')
      descargar(`resenas_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(['id', 'producto_id', 'vendedor_id', 'comprador_id', 'puntuacion', 'comentario', 'creado_en'], rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} reseñas exportadas`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarAuditoria() {
    setExportando('auditoria')
    try {
      const res = await apiJson<{ data: any[] }>('/api/admin/auditoria?limite=500&dias=365')
      const rows = res.data || []
      descargar(`auditoria_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(['id', 'tabla_afectada', 'operacion', 'usuario_id', 'fecha_registro'], rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} eventos de auditoría exportados`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarVerificaciones() {
    setExportando('verificaciones')
    try {
      const rows = await fetchExportar('solicitudes')
      descargar(`verificaciones_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(['id', 'user_id', 'estado', 'pago_movil_telefono', 'pago_movil_cedula', 'pago_movil_banco', 'rechazo_motivo', 'creada_en', 'revisada_en'], rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} solicitudes exportadas`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  async function exportarDenuncias() {
    setExportando('denuncias')
    try {
      const rows = await fetchExportar('denuncias')
      descargar(`denuncias_${Date.now()}.${tipo}`, tipo === 'csv' ? toCSV(['id', 'producto_id', 'reportante_id', 'motivo', 'descripcion', 'estado', 'creada_en'], rows) : toJSON(rows), tipo === 'csv' ? 'text/csv' : 'application/json')
      notify(`✅ ${formatNumber(rows.length)} denuncias exportadas`)
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setExportando(null)
  }

  const exportedOptions = [
    { id: 'productos', label: 'Publicaciones', desc: 'Toda la oferta del marketplace', icon: Package, action: exportarProductos },
    { id: 'usuarios', label: 'Usuarios', desc: 'Perfiles y balances', icon: Users, action: exportarUsuarios },
    { id: 'transacciones', label: 'Transacciones', desc: 'Créditos y pagos', icon: CreditCard, action: exportarTransacciones },
    { id: 'resenas', label: 'Reseñas', desc: 'Reputación y feedback', icon: Star, action: exportarResenas },
    { id: 'auditoria', label: 'Auditoría', desc: 'Historial de cambios', icon: History, action: exportarAuditoria },
    { id: 'verificaciones', label: 'Verificaciones', desc: 'Solicitudes de vendedores', icon: ShieldCheck, action: exportarVerificaciones },
    { id: 'denuncias', label: 'Denuncias', desc: 'Reportes de moderación', icon: AlertTriangle, action: exportarDenuncias },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Exportar datos</h2>
          <p className="text-sm text-gray-500">Descarga respaldos y reportes operativos en CSV o JSON</p>
        </div>
        <div className="flex gap-2">
          <div className="flex h-9 items-center rounded-xl border border-gray-200 bg-white px-1">
            <button onClick={() => setTipo('csv')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tipo === 'csv' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}><FileSpreadsheet size={13} className="mr-1 inline" /> CSV</button>
            <button onClick={() => setTipo('json')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tipo === 'json' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}><FileJson size={13} className="mr-1 inline" /> JSON</button>
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600">
            <ChevronDown size={13} />
            <select value={rango} onChange={(e) => setRango(e.target.value as any)} className="bg-transparent outline-none">
              <option value="all">Todo</option>
              <option value="7">Última semana</option>
              <option value="30">Último mes</option>
              <option value="90">Últimos 90 días</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {exportedOptions.map((opt) => (
          <Card key={opt.id} bodyClassName="p-4" className="group">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary"><opt.icon size={18} /></span>
              {exportando === opt.id && <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />}
            </div>
            <p className="mt-3 font-bold text-gray-800">{opt.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={opt.action} disabled={exportando !== null}>
              <Download size={14} /> {exportando === opt.id ? 'Exportando…' : `Exportar ${tipo.toUpperCase()}`}
            </Button>
          </Card>
        ))}
      </div>

      <Badge tone="blue" className="ml-1">Los rangos aplican según la fecha de registro del dato.</Badge>
    </div>
  )
}
