'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { BadgeCheck, Upload, X, Shield, Camera, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import Image from 'next/image'

const bancos = [
  'CaixaBank', 'BBVA', 'Santander', 'Banco Santander', 'Banco Sabadell',
  'Banc Sabadell', 'Bankinter', 'ING', 'OpenBank', 'Ibercaja',
  'Unicaja', 'Caja Rural', 'Kutxabank', 'Bancoppel', 'Sabadell',
]

export default function SolicitarVerificacion() {
  const { user } = useAuth()
  const [estado, setEstado] = useState<'sin_solicitud' | 'pendiente' | 'aprobada' | 'rechazada'>('sin_solicitud')
  const [solicitudActual, setSolicitudActual] = useState<any>(null)
  const [rechazoMotivo, setRechazoMotivo] = useState('')

  // Form
  const [pagoMovilTelefono, setPagoMovilTelefono] = useState('')
  const [pagoMovilCedula, setPagoMovilCedula] = useState('')
  const [pagoMovilBanco, setPagoMovilBanco] = useState('')
  const [frenteFile, setFrenteFile] = useState<File | null>(null)
  const [dorsoFile, setDorsoFile] = useState<File | null>(null)
  const [frentePreview, setFrentePreview] = useState('')
  const [dorsoPreview, setDorsoPreview] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)

  const cargarEstadoVerificacion = useCallback(async () => {
    // Ver perfil (columnas verificado)
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('verificado, verificado_desde')
      .eq('id', user?.id)
      .single()

    if (perfil?.verificado) {
      setEstado('aprobada')
      return
    }

    // Ver solicitud activa
    const { data: sol } = await supabase
      .from('solicitudes_verificacion')
      .select('id, user_id, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, mensaje, estado, creada_en')
      .eq('user_id', user?.id)
      .eq('estado', 'pendiente')
      .single()

    if (sol) {
      setEstado('pendiente')
      setSolicitudActual(sol)
      return
    }

    // Ver solicitud rechazada
    const { data: solRech } = await supabase
      .from('solicitudes_verificacion')
      .select('id, user_id, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, mensaje, estado, creada_en, rechazo_motivo')
      .eq('user_id', user?.id)
      .eq('estado', 'rechazada')
      .order('creada_en', { ascending: false })
      .limit(1)
      .single()

    if (solRech) {
      setEstado('rechazada')
      setRechazoMotivo(solRech.rechazo_motivo || '')
      setSolicitudActual(solRech)
    }
  }, [user])

  useEffect(() => {
    if (user) cargarEstadoVerificacion()
  }, [user, cargarEstadoVerificacion])

  function handleFrenteFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no puede superar 5MB'); return }
    setFrenteFile(file)
    setFrentePreview(URL.createObjectURL(file))
  }

  function handleDorsoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no puede superar 5MB'); return }
    setDorsoFile(file)
    setDorsoPreview(URL.createObjectURL(file))
  }

  async function handleEnviar() {
    setError('')
    setEnviando(true)

    if (!pagoMovilTelefono || !pagoMovilCedula || !pagoMovilBanco) {
      setError('Completa los datos de Pago Movil')
      setEnviando(false)
      return
    }
    if (!frenteFile || !dorsoFile) {
      setError('Sube fotos de ambos lados del DNI')
      setEnviando(false)
      return
    }

    try {
      setSubiendo(true)
      // Subir fotos del DNI
      const userId = user?.id
      const ts = Date.now()

      const frentePath = `${userId}/${ts}_frente.jpg`
      const dorsoPath = `${userId}/${ts}_dorso.jpg`

      const [upF, upD] = await Promise.all([
        supabase.storage.from('cedulas').upload(frentePath, frenteFile),
        supabase.storage.from('cedulas').upload(dorsoPath, dorsoFile),
      ])

      if (upF.error || upD.error) {
        throw new Error(upF.error?.message || upD.error?.message || 'Error subiendo fotos')
      }

      setSubiendo(false)

      const { error: dbError } = await supabase.from('solicitudes_verificacion').insert({
        user_id: userId,
        pago_movil_telefono: pagoMovilTelefono,
        pago_movil_cedula: pagoMovilCedula,
        pago_movil_banco: pagoMovilBanco,
        cedula_foto_frente_url: upF.data?.path || '',
        cedula_foto_dorso_url: upD.data?.path || '',
        mensaje: mensaje.trim() || null,
      })

      if (dbError) throw dbError

      // Alert Telegram
      fetch('/api/verificacion-alerta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: user?.email || user?.id, cedula: pagoMovilCedula, telefono: pagoMovilTelefono, banco: pagoMovilBanco }) }).catch(() => {})

      setExito(true)
      setEstado('pendiente')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    }
    setEnviando(false)
  }

  if (!user) return null

  // === APROBADO ===
  if (estado === 'aprobada') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden">
        <div className="bg-emerald-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full">
              <BadgeCheck size={28} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Vendedor Verificado</h3>
              <p className="text-emerald-100 text-sm">Tu identificacion ha sido verificada</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-3">
            Tus compradores pueden ver que tu identidad fue confirmada. Esto genera confianza y te da <strong>mas visibilidad</strong> en el marketplace.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Verificado
            </span>
          </div>
        </div>
      </div>
    )
  }

  // === PENDIENTE ===
  if (estado === 'pendiente') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden">
        <div className="bg-yellow-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <Clock size={28} className="text-yellow-900" />
            <div>
              <h3 className="text-xl font-bold text-yellow-900">Solicitud en revision</h3>
              <p className="text-yellow-700 text-sm">Estamos verificando tu identificacion</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">Tu solicitud fue enviada correctamente. Recibiras una notificacion cuando sea revisada.</p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 space-y-1">
            <p><strong>Telefono:</strong> {solicitudActual?.pago_movil_telefono}</p>
            <p><strong>Cedula:</strong> {solicitudActual?.pago_movil_cedula}</p>
            <p><strong>Banco:</strong> {solicitudActual?.pago_movil_banco}</p>
            <p><strong>Enviada:</strong> {new Date(solicitudActual?.creada_en).toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>
    )
  }

  // === RECHAZADO ===
  if (estado === 'rechazada') {
    return (
      <div>
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden mb-4">
          <div className="bg-red-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <X size={28} className="text-white" />
              <div>
                <h3 className="text-xl font-bold text-white">Solicitud rechazada</h3>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-3">Tu solicitud anterior fue rechazada:</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {rechazoMotivo || 'No se pudo verificar la informacion proporcionada.'}
            </div>
          </div>
        </div>

        {/* Re-apply form */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield size={20} className="text-brand-primary" /> Solicitar verificacion de nuevo
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); handleEnviar() }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" value={pagoMovilTelefono} onChange={e => setPagoMovilTelefono(e.target.value)} placeholder="600 000 000" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIE (sin letras al principio es válido)</label>
                <input type="text" value={pagoMovilCedula} onChange={e => setPagoMovilCedula(e.target.value)} placeholder="12345678A" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <select value={pagoMovilBanco} onChange={e => setPagoMovilBanco(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccionar...</option>
                  {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto de frente</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                  <Camera size={20} className="text-gray-500" />
                  <span className="text-sm text-gray-500">{frenteFile ? frenteFile.name : 'Seleccionar...'}</span>
                  <input type="file" accept="image/*" onChange={handleFrenteFile} className="hidden" />
                </label>
                {frentePreview && <Image src={frentePreview} alt="Frente" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del dorso</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                  <Camera size={20} className="text-gray-500" />
                  <span className="text-sm text-gray-500">{dorsoFile ? dorsoFile.name : 'Seleccionar...'}</span>
                  <input type="file" accept="image/*" onChange={handleDorsoFile} className="hidden" />
                </label>
                {dorsoPreview && <Image src={dorsoPreview} alt="Dorso" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Agrega informacion adicional si quieres..." />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={subiendo || enviando || !pagoMovilTelefono || !pagoMovilCedula || !pagoMovilBanco || !frenteFile || !dorsoFile}
              className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50 flex items-center gap-2"
            >
              {subiendo ? <><Upload size={16} /> Subiendo fotos...</> : enviando ? <><CheckCircle2 size={16} /> Enviando...</> : <><BadgeCheck size={16} /> Solicitar verificacion</>}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // === SIN SOLICITUD (formulario) ===
  return (
    <div>
      {/* Banner informativo */}
      <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3">
          <Shield size={24} className="text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Conviertete en Vendedor Verificado</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Verificar tu identidad te da un <strong>badge visible</strong> en todas tus publicaciones, generando confianza inmediata en los compradores. Los vendedores verificados reciben <strong>mas contacto</strong> y venden mas rapido.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Badge visible en cada publicacion
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Mas confianza de los compradores
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Verificacion revisada en menos de 24h
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BadgeCheck size={20} className="text-emerald-600" /> Solicita tu verificacion
        </h3>

        <form onSubmit={(e) => { e.preventDefault(); handleEnviar() }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" value={pagoMovilTelefono} onChange={e => setPagoMovilTelefono(e.target.value)} placeholder="600 000 000" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIE</label>
              <input type="text" value={pagoMovilCedula} onChange={e => setPagoMovilCedula(e.target.value)} placeholder="12345678A" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <select value={pagoMovilBanco} onChange={e => setPagoMovilBanco(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="">Seleccionar...</option>
                {bancos.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">Usamos estos datos para confirmar que el Pago Movil con el que compraste creditos coincide con tu identificacion.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto de frente</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                <Camera size={20} className="text-gray-500" />
                <span className="text-sm text-gray-500">{frenteFile ? frenteFile.name : 'Seleccionar...'}</span>
                <input type="file" accept="image/*" onChange={handleFrenteFile} className="hidden" />
              </label>
              {frentePreview && <Image src={frentePreview} alt="Frente" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto del dorso</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                <Camera size={20} className="text-gray-500" />
                <span className="text-sm text-gray-500">{dorsoFile ? dorsoFile.name : 'Seleccionar...'}</span>
                <input type="file" accept="image/*" onChange={handleDorsoFile} className="hidden" />
              </label>
              {dorsoPreview && <Image src={dorsoPreview} alt="Dorso" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Agrega informacion adicional si quieres..." />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={subiendo || enviando || !pagoMovilTelefono || !pagoMovilCedula || !pagoMovilBanco || !frenteFile || !dorsoFile}
            className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50 flex items-center gap-2"
          >
            {subiendo ? <><Upload size={16} /> Subiendo fotos...</> : enviando ? <><CheckCircle2 size={16} /> Enviando...</> : <><BadgeCheck size={16} /> Solicitar verificacion</>}
          </button>
        </form>
      </div>
    </div>
  )
}
