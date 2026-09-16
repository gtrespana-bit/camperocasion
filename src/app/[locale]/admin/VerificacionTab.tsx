'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'

/**
 * Tab de verificación de identidad del vendedor (España).
 *
 * Columnas/tablas con nombre legado `pago_movil_*` / `cedulas` se mantienen por
 * compatibilidad con la BD existente: aquí se usan como alias de
 * teléfono / DNI-NIE / banco y documentos de identidad (DNI/NIE).
 */

export default function VerificacionTab({ notify }: { notify: (msg: string) => void }) {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState<'pendiente' | 'todas' | 'aprobada' | 'rechazada'>('pendiente')
  const [rechazoModal, setRechazoModal] = useState<string | null>(null)
  const [rechazoMotivo, setRechazoMotivo] = useState('')
  const [stats, setStats] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 })

  const cargar = useCallback(async () => {
    setCargando(true)

    const params = filtro !== 'todas' ? `?estado=${encodeURIComponent(filtro)}` : ''
    const res = await fetch(`/api/admin/solicitudes-verificacion${params}`, { cache: 'no-store' })
    const result = await res.json().catch(() => ({}))
    setCargando(false)
    if (!res.ok || !result.ok) {
      notify('Error: ' + (result.error || 'No se pudieron cargar las solicitudes'))
      return
    }
    const sols = result.solicitudes || []

    const userIds = (sols || []).map((s: any) => s.user_id).filter(Boolean)
    let perfilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const res2 = await fetch('/api/admin/perfiles-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })
      const result2 = await res2.json()
      if (result2.ok && result2.perfiles) {
        result2.perfiles.forEach((p: any) => { perfilesMap[p.id] = p })
      }
    }

    const combinado = (sols || []).map((s: any) => ({
      ...s,
      perfil: perfilesMap[s.user_id] || {},
    }))

    setSolicitudes(combinado)
    setStats({
      pendientes: combinado.filter((s: any) => s.estado === 'pendiente').length,
      aprobadas: combinado.filter((s: any) => s.estado === 'aprobada').length,
      rechazadas: combinado.filter((s: any) => s.estado === 'rechazada').length,
      total: combinado.length,
    })
  }, [filtro, notify])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function abrirCedula(path: string) {
    const preview = window.open('', '_blank')
    if (!preview) {
      notify('El navegador bloqueó la ventana del documento')
      return
    }
    preview.opener = null

    try {
      const response = await fetch(`/api/admin/cedula?path=${encodeURIComponent(path)}`, {
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.signedUrl) {
        preview.close()
        notify(result.error || 'No se pudo abrir el documento')
        return
      }
      preview.location.replace(result.signedUrl)
    } catch {
      preview.close()
      notify('No se pudo abrir el documento')
    }
  }

  async function aprobarSol(id: string, userId: string, sol: any) {
    const res = await fetch('/api/admin/solicitudes-verificacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'aprobar',
        id,
        userId,
        pago_movil_telefono: sol.pago_movil_telefono || '',
        pago_movil_cedula: sol.pago_movil_cedula || '',
        pago_movil_banco: sol.pago_movil_banco || '',
      }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result.ok) {
      notify('Error aprobando: ' + (result.error || 'No se pudo aprobar'))
      return
    }

    notify('Vendedor verificado correctamente')
    try {
      fetch('/api/email-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {})
    } catch {}
    cargar()
  }

  async function rechazarSol(id: string) {
    if (!rechazoMotivo.trim()) { notify('Escribe motivo de rechazo'); return }
    const res = await fetch('/api/admin/solicitudes-verificacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rechazar', id, motivo: rechazoMotivo }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result.ok) { notify('Error: ' + (result.error || 'No se pudo rechazar')); return }
    setRechazoMotivo('')
    setRechazoModal(null)
    notify('Solicitud rechazada')
    cargar()
  }

  if (cargando) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-primary" /></div>

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              filtro === f ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            {f === 'pendiente' && `Pendientes (${stats.pendientes})`}
            {f === 'aprobada' && `Aprobadas (${stats.aprobadas})`}
            {f === 'rechazada' && `Rechazadas (${stats.rechazadas})`}
            {f === 'todas' && `Todas (${stats.total})`}
          </button>
        ))}
      </div>

      {solicitudes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-2">{filtro === 'pendiente' ? '✅' : '📋'}</p>
          <p className="font-medium">Sin solicitudes {filtro !== 'todas' ? filtro : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudes.map(sol => {
            const perfil = sol.perfil || {}
            const datosCoinciden =
              sol.pago_movil_telefono && perfil.pago_movil_telefono &&
              sol.pago_movil_telefono === perfil.pago_movil_telefono &&
              sol.pago_movil_cedula && perfil.pago_movil_cedula &&
              sol.pago_movil_cedula === perfil.pago_movil_cedula

            return (
              <div key={sol.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-bold text-lg">{perfil.nombre || 'Sin nombre'}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        sol.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        sol.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sol.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-500">Datos de la solicitud (DNI/NIE):</p>
                        <p><strong>Tel.:</strong> {sol.pago_movil_telefono || '-'}</p>
                        <p><strong>DNI/NIE:</strong> {sol.pago_movil_cedula || '-'}</p>
                        <p><strong>Banco:</strong> {sol.pago_movil_banco || '-'}</p>
                        {sol.mensaje && <p><strong>Mensaje:</strong> {sol.mensaje}</p>}
                      </div>
                      <div>
                        <p className="text-gray-500">Datos del perfil:</p>
                        <p><strong>Tel.:</strong> {perfil.pago_movil_telefono || 'No registrado'}</p>
                        <p><strong>DNI/NIE:</strong> {perfil.pago_movil_cedula || 'No registrado'}</p>
                        <p><strong>Banco:</strong> {perfil.pago_movil_banco || 'No registrado'}</p>
                      </div>
                    </div>

                    <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      datosCoinciden ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {datosCoinciden ? 'Datos coinciden con el perfil' : 'Datos no coinciden — revisar DNI/NIE'}
                    </div>

                    {sol.rechazo_motivo && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <strong>Motivo de rechazo anterior:</strong> {sol.rechazo_motivo}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      Solicitada: {new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sol.creada_en))}
                    </p>
                  </div>

                  {/* Bucket `cedulas` = documentos DNI/NIE (nombre legado, privado, URL firmada 5 min) */}
                  {(sol.cedula_foto_frente_url || sol.cedula_foto_dorso_url) && (
                    <div className="flex-shrink-0 min-w-28">
                      <p className="text-xs text-gray-500 mb-1.5">DNI/NIE:</p>
                      <div className="flex flex-col gap-1.5">
                        {sol.cedula_foto_frente_url && (
                          <button
                            type="button"
                            onClick={() => abrirCedula(sol.cedula_foto_frente_url)}
                            className="text-left text-xs font-semibold text-brand-primary hover:underline"
                          >
                            Ver frente
                          </button>
                        )}
                        {sol.cedula_foto_dorso_url && (
                          <button
                            type="button"
                            onClick={() => abrirCedula(sol.cedula_foto_dorso_url)}
                            className="text-left text-xs font-semibold text-brand-primary hover:underline"
                          >
                            Ver dorso
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {sol.estado === 'pendiente' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => aprobarSol(sol.id, sol.user_id, sol)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-sm flex items-center gap-1 transition"
                      >
                        <ShieldCheck size={16} /> Verificar
                      </button>
                      <button
                        onClick={() => setRechazoModal(sol.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm transition"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rechazoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn">
            <h3 className="text-lg font-bold mb-3">Motivo de rechazo</h3>
            <textarea
              value={rechazoMotivo}
              onChange={e => setRechazoMotivo(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 resize-none text-sm"
              placeholder="Por qué se rechaza..."
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRechazoModal(null); setRechazoMotivo('') }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
              <button onClick={() => rechazarSol(rechazoModal)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
