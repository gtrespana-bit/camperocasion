'use client'

/**
 * Gestoría del cambio de nombre — leads del panel (plan §4.2).
 *
 * El lead se contacta a mano (teléfono/email) y se tramita con la gestoría
 * partner. Aquí solo se marca el embudo (nueva → en gestión → cerrada) y se
 * dejan notas de coordinación. FIFO: nadie sin contactar más de lo justo.
 */

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Phone, RefreshCw } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { ETIQUETAS_ESTADO_GESTORIA, normalizarEstadoGestoria, type EstadoGestoria } from '@/lib/gestoria'
import { apiJson } from './components/admin-utils'

interface Lead {
  id: string
  nombre: string
  email: string
  telefono: string
  provincia: string | null
  matricula: string | null
  mensaje: string | null
  estado: string
  notas_admin: string | null
  creado_en: string
  producto: { id: string; titulo: string | null; slug: string | null } | null
}

type Filtro = 'todas' | EstadoGestoria

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'nueva', label: 'Nuevas' },
  { id: 'en_gestion', label: 'En gestión' },
  { id: 'cerrada', label: 'Cerradas' },
  { id: 'todas', label: 'Todas' },
]

const SIGUIENTE: Record<EstadoGestoria, { id: string; label: string; tono: string }[]> = {
  nueva: [
    { id: 'gestionar', label: 'Contactar / en gestión', tono: 'bg-brand-primary hover:bg-brand-dark text-white' },
    { id: 'cerrar', label: 'Cerrar', tono: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  en_gestion: [
    { id: 'cerrar', label: 'Cerrar', tono: 'bg-green-600 hover:bg-green-700 text-white' },
    { id: 'reabrir', label: 'Volver a nueva', tono: 'bg-amber-600 hover:bg-amber-700 text-white' },
  ],
  cerrada: [{ id: 'reabrir', label: 'Reabrir', tono: 'bg-amber-600 hover:bg-amber-700 text-white' }],
}

const fecha = (valor?: string | null) => {
  if (!valor) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
  } catch {
    return valor
  }
}

export default function AdminGestoria({ notify }: { notify: (msg: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pendienteMigracion, setPendienteMigracion] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/gestoria?estado=${filtro}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json.pendienteMigracion) {
        setPendienteMigracion(true)
        return
      }
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudieron cargar los leads')
        return
      }
      setLeads(json.leads || [])
    } catch {
      setError('No se pudieron cargar los leads')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function accion(lead: Lead, id: string) {
    let notas: string | null = null
    if (id === 'cerrar') {
      const entrada = window.prompt('Nota de cierre (resultado, si quieres dejarla):')
      if (entrada === null) return
      notas = entrada.trim() || null
    }
    if (id === 'reabrir' && !lead.notas_admin) {
      const entrada = window.prompt('Motivo de la reapertura (nota):')
      if (entrada === null) return
      notas = entrada.trim() || null
    }

    setTrabajando(lead.id)
    try {
      await apiJson('/api/admin/gestoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: id, leadId: lead.id, notas: notas ?? undefined }),
      })
      notify('Lead actualizado')
      await cargar()
    } catch (e: any) {
      notify(e?.message || 'No se pudo actualizar el lead')
    } finally {
      setTrabajando(null)
    }
  }

  if (pendienteMigracion) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-bold text-amber-900 mb-1">Migración de gestoría pendiente</h3>
        <p className="text-sm text-amber-800">
          Aplica{' '}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/202609170002_inspecciones_gestoria.sql</code>{' '}
          para activar la captación de leads.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filtro === f.id ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={cargar}
          className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          aria-label="Recargar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-brand-primary" size={24} aria-hidden="true" />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 p-6 text-center">
          No hay leads en esta vista.
        </p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const estado = normalizarEstadoGestoria(lead.estado)
            const etiqueta = ETIQUETAS_ESTADO_GESTORIA[estado]
            return (
              <div key={lead.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {lead.nombre}
                      {lead.provincia ? <span className="font-normal text-gray-500"> · {lead.provincia}</span> : null}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                      <a href={`tel:${lead.telefono.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-brand-primary hover:underline">
                        <Phone size={11} aria-hidden="true" /> {lead.telefono}
                      </a>
                      <a href={`mailto:${lead.email}`} className="text-brand-primary hover:underline">
                        {lead.email}
                      </a>
                      {lead.matricula ? <span className="font-mono">{lead.matricula}</span> : null}
                    </p>
                    {lead.producto && (
                      <LocalLink
                        href={`/producto/${lead.producto.slug || lead.producto.id}`}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-primary mt-1"
                      >
                        Anuncio: {lead.producto.titulo} <ExternalLink size={10} aria-hidden="true" />
                      </LocalLink>
                    )}
                    {lead.mensaje && <p className="text-xs text-gray-600 mt-2 italic">«{lead.mensaje}»</p>}
                    {lead.notas_admin && <p className="text-[11px] text-gray-400 mt-1">Notas: {lead.notas_admin}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">Recibido {fecha(lead.creado_en)}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${etiqueta.tono}`}>
                    {etiqueta.label}
                  </span>
                </div>
                {SIGUIENTE[estado].length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {SIGUIENTE[estado].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => accion(lead, a.id)}
                        disabled={trabajando === lead.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${a.tono}`}
                      >
                        {trabajando === lead.id ? <Loader2 size={12} className="animate-spin inline mr-1" aria-hidden="true" /> : null}
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
