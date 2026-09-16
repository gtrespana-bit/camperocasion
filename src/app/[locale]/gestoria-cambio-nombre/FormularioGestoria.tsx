'use client'

/**
 * Formulario de lead de la gestoría (isla cliente de /gestoria-cambio-nombre).
 *
 * Sin login: el comprador medio aún no tiene cuenta. La validación fina vive
 * en `validarLeadGestoria` (src/lib/gestoria.ts) y se repite en la API; aquí
 * solo se piden los mínimos para que el equipo pueda llamar. El `?producto=`
 * de la URL (si se llegó desde un anuncio o desde el contrato) va oculto.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { COMUNIDADES_AUTONOMAS } from '@/lib/ubicaciones'

export default function FormularioGestoria() {
  const searchParams = useSearchParams()
  const [productoId, setProductoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [provincia, setProvincia] = useState('')
  const [matricula, setMatricula] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    const p = searchParams?.get('producto') || ''
    if (/^[0-9a-f-]{36}$/i.test(p)) setProductoId(p)
  }, [searchParams])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/gestoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email,
          telefono,
          provincia: provincia || undefined,
          matricula: matricula || undefined,
          mensaje: mensaje || undefined,
          productoId: productoId || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo enviar. Inténtalo de nuevo.')
        return
      }
      setEnviado(true)
    } catch {
      setError('No se pudo enviar. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40'

  if (enviado) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-brand-primary mb-3" aria-hidden="true" />
        <h3 className="font-black text-gray-900 text-base mb-1">¡Recibido!</h3>
        <p className="text-sm text-gray-600">
          Te contactamos en horario laboral con el presupuesto cerrado. Revisa también el correo no
          deseado, por si acaso.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h2 className="text-lg font-black text-gray-900 mb-1">Pide presupuesto</h2>
      <p className="text-xs text-gray-500 mb-4">Te llamamos con el precio cerrado, sin compromiso.</p>

      <div className="space-y-3">
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellidos"
          autoComplete="name"
          maxLength={100}
          className={inputCls}
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          maxLength={200}
          className={inputCls}
        />
        <input
          required
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono"
          autoComplete="tel"
          maxLength={20}
          className={inputCls}
        />
        <select
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          className={`${inputCls} bg-white ${provincia ? '' : 'text-gray-400'}`}
        >
          <option value="">¿Dónde tramitar? (comunidad)</option>
          {COMUNIDADES_AUTONOMAS.map((c: any) => (
            <option key={c.nombre} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          value={matricula}
          onChange={(e) => setMatricula(e.target.value.toUpperCase())}
          placeholder="Matrícula del vehículo (opcional)"
          maxLength={12}
          className={`${inputCls} uppercase`}
        />
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="¿Algo que debamos saber? (opcional)"
          className={inputCls}
        />
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-brand-primary text-white font-bold rounded-xl py-3 text-sm hover:bg-brand-dark transition disabled:opacity-60"
      >
        {enviando && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        Quiero que me llamen
      </button>
      <p className="mt-2 text-[11px] text-gray-400">
        Usamos tus datos solo para contactarte por este trámite. Nada de listas de correo.
      </p>
    </form>
  )
}
