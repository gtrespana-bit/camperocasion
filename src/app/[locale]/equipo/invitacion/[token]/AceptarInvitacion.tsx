'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, LogIn } from 'lucide-react'
import LocalLink from '@/components/LocalLink'

export default function AceptarInvitacion({ token }: { token: string }) {
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error' | 'sesion'>('idle')
  const [mensaje, setMensaje] = useState('')

  async function aceptar() {
    setEstado('cargando')
    setMensaje('')
    try {
      const res = await fetch('/api/equipo/aceptar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.status === 401) {
        setEstado('sesion')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setEstado('error')
        setMensaje(data.error || 'No se pudo aceptar la invitación.')
        return
      }
      setEstado('ok')
    } catch {
      setEstado('error')
      setMensaje('No se pudo conectar. Inténtalo de nuevo.')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
          <CheckCircle2 size={16} /> Ya formas parte del equipo
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Publica como siempre desde tu panel. El cupo y los destacados son de la cuenta; tus
          anuncios siguen siendo tuyos.
        </p>
        <LocalLink
          href="/dashboard?tab=equipo"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
        >
          Ir al panel <ArrowRight size={14} />
        </LocalLink>
      </div>
    )
  }

  if (estado === 'sesion') {
    const destino = `/equipo/invitacion/${token}`
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          Entra con la cuenta invitada para aceptar. Si no tienes cuenta, créala con el mismo email
          al que llegó la invitación.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/login?redirect=${encodeURIComponent(destino)}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
          >
            <LogIn size={14} /> Entrar
          </a>
          <a
            href={`/register?redirect=${encodeURIComponent(destino)}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Crear cuenta
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={aceptar}
        disabled={estado === 'cargando'}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {estado === 'cargando' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        Aceptar invitación
      </button>
      {estado === 'error' && <p className="mt-3 text-sm text-red-700">{mensaje}</p>}
    </div>
  )
}
