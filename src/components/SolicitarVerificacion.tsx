'use client'

/**
 * Solicitud de verificación de vendedor para CamperOcasión (España).
 *
 * Flujo español:
 *  - El vendedor sube fotos de su DNI/NIE (frente y dorso) + teléfono y banco
 *    (para contraste con los datos de pago de créditos vía Bizum/transferencia).
 *  - Canónico desde 2026-09-17: bucket `documentos-identidad`, columnas
 *    `telefono` / `dni` / `banco` y `dni_foto_frente_url` / `dni_foto_dorso_url`
 *    en `solicitudes_verificacion`. Los nombres legados `cedulas` y
 *    `pago_movil_*` / `cedula_foto_*` siguen sincronizados por trigger.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { BadgeCheck, Upload, X, Shield, Camera, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import Image from 'next/image'

const bancos = [
  'CaixaBank', 'BBVA', 'Santander', 'Banco Sabadell',
  'Bankinter', 'ING', 'Openbank', 'Ibercaja',
  'Unicaja', 'Caja Rural', 'Kutxabank', 'Abanca', 'Cajamar',
  'Otro',
]

export default function SolicitarVerificacion() {
  const { user } = useAuth()
  const [estado, setEstado] = useState<'sin_solicitud' | 'pendiente' | 'aprobada' | 'rechazada'>('sin_solicitud')
  const [solicitudActual, setSolicitudActual] = useState<any>(null)
  const [rechazoMotivo, setRechazoMotivo] = useState('')

  // Form — nombres de UI en español; se mapean a columnas legado pago_movil_* al guardar
  const [telefonoVerif, setTelefonoVerif] = useState('')
  const [dniVerif, setDniVerif] = useState('')
  const [bancoVerif, setBancoVerif] = useState('')
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
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('verificado, verificado_desde')
      .eq('id', user?.id)
      .single()

    if (perfil?.verificado) {
      setEstado('aprobada')
      return
    }

    // Lectura tolerante: canónico telefono/dni/banco + legados pago_movil_*
    const { data: sol } = await supabase
      .from('solicitudes_verificacion')
      .select('id, user_id, telefono, dni, banco, dni_foto_frente_url, dni_foto_dorso_url, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, cedula_foto_frente_url, cedula_foto_dorso_url, mensaje, estado, creada_en')
      .eq('user_id', user?.id)
      .eq('estado', 'pendiente')
      .single()

    if (sol) {
      setEstado('pendiente')
      setSolicitudActual({
        ...sol,
        pago_movil_telefono: sol.telefono ?? sol.pago_movil_telefono,
        pago_movil_cedula: sol.dni ?? sol.pago_movil_cedula,
        pago_movil_banco: sol.banco ?? sol.pago_movil_banco,
      })
      return
    }

    const { data: solRech } = await supabase
      .from('solicitudes_verificacion')
      .select('id, user_id, telefono, dni, banco, dni_foto_frente_url, dni_foto_dorso_url, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, cedula_foto_frente_url, cedula_foto_dorso_url, mensaje, estado, creada_en, rechazo_motivo')
      .eq('user_id', user?.id)
      .eq('estado', 'rechazada')
      .order('creada_en', { ascending: false })
      .limit(1)
      .single()

    if (solRech) {
      setEstado('rechazada')
      setRechazoMotivo(solRech.rechazo_motivo || '')
      setSolicitudActual({
        ...solRech,
        pago_movil_telefono: solRech.telefono ?? solRech.pago_movil_telefono,
        pago_movil_cedula: solRech.dni ?? solRech.pago_movil_cedula,
        pago_movil_banco: solRech.banco ?? solRech.pago_movil_banco,
      })
    }
  }, [user])

  useEffect(() => {
    if (user) cargarEstadoVerificacion()
  }, [user, cargarEstadoVerificacion])

  function handleFrenteFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no puede superar 5 MB'); return }
    setFrenteFile(file)
    setFrentePreview(URL.createObjectURL(file))
  }

  function handleDorsoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no puede superar 5 MB'); return }
    setDorsoFile(file)
    setDorsoPreview(URL.createObjectURL(file))
  }

  async function handleEnviar() {
    setError('')
    setEnviando(true)

    if (!telefonoVerif || !dniVerif || !bancoVerif) {
      setError('Completa tu teléfono, DNI/NIE y banco')
      setEnviando(false)
      return
    }
    if (!frenteFile || !dorsoFile) {
      setError('Sube fotos de ambos lados del DNI/NIE')
      setEnviando(false)
      return
    }

    try {
      setSubiendo(true)
      const userId = user?.id
      const ts = Date.now()

      const frentePath = `${userId}/${ts}_frente.jpg`
      const dorsoPath = `${userId}/${ts}_dorso.jpg`

      // Canónico: bucket documentos-identidad. Fallback a `cedulas` si aún no existe (instalación antigua).
      let [upF, upD] = await Promise.all([
        supabase.storage.from('documentos-identidad').upload(frentePath, frenteFile),
        supabase.storage.from('documentos-identidad').upload(dorsoPath, dorsoFile),
      ])
      if (upF.error && /bucket.*not found/i.test(upF.error.message || '')) {
        ;[upF, upD] = await Promise.all([
          supabase.storage.from('cedulas').upload(frentePath, frenteFile),
          supabase.storage.from('cedulas').upload(dorsoPath, dorsoFile),
        ])
      }

      if (upF.error || upD.error) {
        throw new Error(upF.error?.message || upD.error?.message || 'Error subiendo fotos')
      }

      setSubiendo(false)

      const { error: dbError } = await supabase.from('solicitudes_verificacion').insert({
        user_id: userId,
        // Canónico + legado (trigger los mantiene sincronizados)
        telefono: telefonoVerif,
        dni: dniVerif,
        banco: bancoVerif,
        pago_movil_telefono: telefonoVerif,
        pago_movil_cedula: dniVerif,
        pago_movil_banco: bancoVerif,
        dni_foto_frente_url: upF.data?.path || '',
        dni_foto_dorso_url: upD.data?.path || '',
        cedula_foto_frente_url: upF.data?.path || '',
        cedula_foto_dorso_url: upD.data?.path || '',
        mensaje: mensaje.trim() || null,
      })

      if (dbError) throw dbError

      fetch('/api/verificacion-alerta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: user?.email || user?.id, cedula: dniVerif, telefono: telefonoVerif, banco: bancoVerif }) }).catch(() => {})

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
              <p className="text-emerald-100 text-sm">Tu identidad ha sido verificada</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-3">
            Tus compradores pueden ver que tu identidad fue confirmada. Esto genera confianza y te da <strong>más visibilidad</strong> en CamperOcasión.
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
              <h3 className="text-xl font-bold text-yellow-900">Solicitud en revisión</h3>
              <p className="text-yellow-700 text-sm">Estamos verificando tu identidad</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">Tu solicitud fue enviada correctamente. Recibirás una notificación cuando sea revisada.</p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 space-y-1">
            <p><strong>Teléfono:</strong> {solicitudActual?.pago_movil_telefono}</p>
            <p><strong>DNI/NIE:</strong> {solicitudActual?.pago_movil_cedula}</p>
            <p><strong>Banco:</strong> {solicitudActual?.pago_movil_banco}</p>
            <p><strong>Enviada:</strong> {solicitudActual?.creada_en ? new Date(solicitudActual.creada_en).toLocaleDateString('es-ES') : '-'}</p>
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
              {rechazoMotivo || 'No se pudo verificar la información proporcionada.'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield size={20} className="text-brand-primary" /> Solicitar verificación de nuevo
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); handleEnviar() }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" value={telefonoVerif} onChange={e => setTelefonoVerif(e.target.value)} placeholder="600 000 000" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIE</label>
                <input type="text" value={dniVerif} onChange={e => setDniVerif(e.target.value)} placeholder="12345678A" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <select value={bancoVerif} onChange={e => setBancoVerif(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccionar...</option>
                  {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del DNI/NIE — frente</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                  <Camera size={20} className="text-gray-500" />
                  <span className="text-sm text-gray-500">{frenteFile ? frenteFile.name : 'Seleccionar...'}</span>
                  <input type="file" accept="image/*" onChange={handleFrenteFile} className="hidden" />
                </label>
                {frentePreview && <Image src={frentePreview} alt="Frente DNI" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del DNI/NIE — dorso</label>
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                  <Camera size={20} className="text-gray-500" />
                  <span className="text-sm text-gray-500">{dorsoFile ? dorsoFile.name : 'Seleccionar...'}</span>
                  <input type="file" accept="image/*" onChange={handleDorsoFile} className="hidden" />
                </label>
                {dorsoPreview && <Image src={dorsoPreview} alt="Dorso DNI" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Añade información adicional si quieres..." />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={subiendo || enviando || !telefonoVerif || !dniVerif || !bancoVerif || !frenteFile || !dorsoFile}
              className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50 flex items-center gap-2"
            >
              {subiendo ? <><Upload size={16} /> Subiendo fotos...</> : enviando ? <><CheckCircle2 size={16} /> Enviando...</> : <><BadgeCheck size={16} /> Solicitar verificación</>}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // === SIN SOLICITUD ===
  return (
    <div>
      <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3">
          <Shield size={24} className="text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Conviértete en Vendedor Verificado</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Verificar tu identidad te da un <strong>distintivo visible</strong> en todas tus publicaciones, generando confianza inmediata en los compradores. Los vendedores verificados reciben <strong>más contactos</strong> y venden más rápido.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Distintivo visible en cada publicación
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Más confianza de los compradores
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Verificación revisada en menos de 24 h
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BadgeCheck size={20} className="text-emerald-600" /> Solicita tu verificación
        </h3>

        <form onSubmit={(e) => { e.preventDefault(); handleEnviar() }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" value={telefonoVerif} onChange={e => setTelefonoVerif(e.target.value)} placeholder="600 000 000" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIE</label>
              <input type="text" value={dniVerif} onChange={e => setDniVerif(e.target.value)} placeholder="12345678A" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <select value={bancoVerif} onChange={e => setBancoVerif(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="">Seleccionar...</option>
                {bancos.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500">Usamos estos datos para verificar tu identidad y contrastarlos con el titular de tu Bizum/transferencia si compras créditos.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto del DNI/NIE — frente</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                <Camera size={20} className="text-gray-500" />
                <span className="text-sm text-gray-500">{frenteFile ? frenteFile.name : 'Seleccionar...'}</span>
                <input type="file" accept="image/*" onChange={handleFrenteFile} className="hidden" />
              </label>
              {frentePreview && <Image src={frentePreview} alt="Frente DNI" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto del DNI/NIE — dorso</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-brand-primary transition">
                <Camera size={20} className="text-gray-500" />
                <span className="text-sm text-gray-500">{dorsoFile ? dorsoFile.name : 'Seleccionar...'}</span>
                <input type="file" accept="image/*" onChange={handleDorsoFile} className="hidden" />
              </label>
              {dorsoPreview && <Image src={dorsoPreview} alt="Dorso DNI" className="mt-2 h-24 rounded-lg object-cover" width={96} height={96} unoptimized />}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Añade información adicional si quieres..." />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={subiendo || enviando || !telefonoVerif || !dniVerif || !bancoVerif || !frenteFile || !dorsoFile}
            className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50 flex items-center gap-2"
          >
            {subiendo ? <><Upload size={16} /> Subiendo fotos...</> : enviando ? <><CheckCircle2 size={16} /> Enviando...</> : <><BadgeCheck size={16} /> Solicitar verificación</>}
          </button>
        </form>
      </div>
    </div>
  )
}
