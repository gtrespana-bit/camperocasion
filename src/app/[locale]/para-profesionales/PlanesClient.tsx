'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { PLANES_PRO } from '@/lib/planes-anuncios'
import LocalLink from '@/components/LocalLink'

export default function PlanesClient() {
  const { session } = useAuth()
  const [cupon, setCupon] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  async function contratar(plan: string) {
    setMsg('')
    if (!session) {
      window.location.href = '/login?next=/para-profesionales'
      return
    }
    setLoading(plan)
    const res = await fetch('/api/planes/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, cupon: cupon || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok || !data.url) {
      setMsg(data.error || 'No se pudo abrir Stripe')
      return
    }
    window.location.href = data.url
  }

  async function canjear() {
    setMsg('')
    if (!session) {
      window.location.href = '/login?next=/para-profesionales'
      return
    }
    setLoading('cupon')
    const res = await fetch('/api/planes/canjear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: cupon }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) {
      setMsg(data.error || 'No se pudo canjear')
      return
    }
    setMsg(`Pack ${data.plan} activo hasta ${new Date(data.hasta).toLocaleDateString('es-ES')}`)
  }

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {PLANES_PRO.map(p => (
          <div
            key={p.id}
            className={`rounded-2xl border p-5 flex flex-col ${
              p.id === 'plus' ? 'border-brand-accent bg-white shadow-sm' : 'border-slate-200 bg-white'
            }`}
          >
            {p.id === 'plus' && (
              <span className="text-[11px] font-bold uppercase text-brand-accent mb-2">Recomendado</span>
            )}
            <h2 className="text-lg font-bold text-slate-900">{p.nombre}</h2>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {p.precioMes} €<span className="text-sm font-medium text-slate-500">/mes</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">{p.eslogan}</p>
            <ul className="space-y-2 text-sm text-slate-700 flex-1 mb-5">
              {p.incluido.map(item => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={loading === p.id}
              onClick={() => contratar(p.id)}
              className="w-full bg-brand-accent hover:bg-brand-accent-dark text-white font-semibold py-2.5 rounded-xl disabled:opacity-60"
            >
              {loading === p.id ? 'Abriendo Stripe…' : 'Contratar'}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 bg-white max-w-xl">
        <h3 className="font-bold text-slate-900 mb-2">Cupón</h3>
        <p className="text-sm text-slate-600 mb-3">
          Descuento (ej. MAYO-20): se aplica al pulsar Contratar. Regalo de días: Canjear sin pago.
        </p>
        <div className="flex gap-2">
          <input
            value={cupon}
            onChange={e => setCupon(e.target.value)}
            placeholder="CÓDIGO"
            className="flex-1 border rounded-xl px-3 py-2 uppercase"
          />
          <button
            type="button"
            onClick={canjear}
            disabled={loading === 'cupon'}
            className="px-4 py-2 rounded-xl border font-semibold"
          >
            Canjear
          </button>
        </div>
        {msg && <p className="text-sm mt-3 text-slate-800">{msg}</p>}
        {!session && (
          <p className="text-xs text-slate-500 mt-3">
            <LocalLink href="/login" className="underline">Inicia sesión</LocalLink> para contratar o canjear.
          </p>
        )}
      </div>
    </div>
  )
}
