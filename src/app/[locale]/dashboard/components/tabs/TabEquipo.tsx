'use client'

/**
 * Equipo de Unlimited Flota: un titular, hasta tres comerciales y una sola
 * cuota. El valor está en que cada comercial publica con su usuario (su
 * historial, sus mensajes) sin que la empresa pague tres packs.
 */
import { useCallback, useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { MIEMBROS_MAX, ROLES_EQUIPO, type RolEquipo } from '@/lib/equipo-reglas'

type Miembro = {
  id: string
  email: string
  nombre: string | null
  rol: RolEquipo
  rolEtiqueta: string
  estado: 'invitado' | 'activo' | 'revocado'
  creadoEn: string
  aceptadoEn: string | null
  anunciosActivos: number
  soyYo: boolean
  token?: string
  enlace?: string
}

type Datos = {
  ok: boolean
  rol: RolEquipo | null
  esTitular: boolean
  titularId: string
  plan: string
  puedeInvitar: boolean
  max: number
  ocupados: number
  equipoCompleto: boolean
  cupo: { max: number | null; usados: number; restantes: number | null }
  miembros: Miembro[]
}

export default function TabEquipo() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<RolEquipo>('comercial')
  const [invitando, setInvitando] = useState(false)
  const [enlaceNuevo, setEnlaceNuevo] = useState('')
  const [copiado, setCopiado] = useState('')

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/equipo', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo cargar el equipo.')
        return
      }
      setDatos(data)
      setError('')
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnlaceNuevo('')
    setInvitando(true)
    try {
      const res = await fetch('/api/equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre, rol }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo invitar.')
        return
      }
      setEnlaceNuevo(data.enlace || data.miembro?.enlace || '')
      setAviso(
        data.emailEnviado
          ? `Invitación enviada a ${email}.`
          : 'Invitación creada. Copia el enlace y mándalo tú: el email no ha salido.',
      )
      setEmail('')
      setNombre('')
      setRol('comercial')
      await cargar()
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setInvitando(false)
    }
  }

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      setTimeout(() => setCopiado(''), 2000)
    } catch {
      setError('No se pudo copiar. Selecciona el enlace a mano.')
    }
  }

  async function revocar(id: string) {
    if (!confirm('¿Revocar el acceso de este comercial? Sus anuncios se quedan como están.')) return
    const res = await fetch(`/api/equipo?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'No se pudo revocar.')
      return
    }
    setAviso('Acceso revocado.')
    await cargar()
  }

  async function salir() {
    if (!confirm('¿Salir del equipo? Tus anuncios siguen publicados, pero dejarás de usar el cupo de la cuenta.'))
      return
    const res = await fetch('/api/equipo?salir=1', { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'No se pudo salir.')
      return
    }
    setAviso('Has salido del equipo.')
    await cargar()
  }

  async function cambiarRol(id: string, nuevo: RolEquipo) {
    const res = await fetch('/api/equipo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rol: nuevo }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'No se pudo cambiar el rol.')
      return
    }
    await cargar()
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Cargando…
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'No se pudo cargar el equipo.'}
      </div>
    )
  }

  // Titular sin Flota: se vende el escalón sin engañar.
  if (datos.esTitular && datos.plan !== 'unlimited' && datos.miembros.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Users size={20} className="text-brand-primary" /> Equipo de comerciales
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Con Unlimited Flota puedes dar acceso a hasta {MIEMBROS_MAX} comerciales. Cada uno entra
            con su propio usuario —sus anuncios, sus mensajes, su historial— y todos comparten el
            cupo y los destacados de la cuenta. Una factura, un escaparate.
          </p>
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
            <p className="font-bold text-slate-800">Disponible en Unlimited Flota</p>
            <p className="mt-1 text-sm text-slate-600">
              Tu plan actual es {datos.plan === 'plus' ? 'Plus' : datos.plan === 'starter' ? 'Starter' : 'gratuito'}.
              Si sois varios publicando con el mismo login, Flota sale más barato que dos packs Plus y
              además os deja las estadísticas completas y la importación de stock.
            </p>
            <LocalLink
              href="/para-profesionales"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Ver Unlimited Flota <ArrowRight size={14} />
            </LocalLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <Users size={20} className="text-brand-primary" /> Equipo
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {datos.esTitular
            ? 'Cada comercial publica con su usuario; el cupo, los destacados y la factura son de la cuenta.'
            : 'Formas parte de una cuenta Flota: publicas con tu usuario dentro del cupo del equipo.'}
        </p>
      </div>

      {datos.esTitular && datos.plan !== 'unlimited' && datos.miembros.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Tu plan actual ya no incluye equipo. Los comerciales que ya tienen acceso lo conservan hasta
          que los revoques, pero no puedes invitar a más. Vuelve a Unlimited Flota para ampliar el
          equipo.
        </div>
      )}

      {(error || aviso) && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || aviso}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Comerciales</p>
          <p className="text-2xl font-black text-slate-900">
            {datos.ocupados}
            <span className="text-base font-semibold text-slate-400"> / {datos.max}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Anuncios de la cuenta</p>
          <p className="text-2xl font-black text-slate-900">
            {datos.cupo.usados}
            <span className="text-base font-semibold text-slate-400">
              {' '}
              / {datos.cupo.max ?? '∞'}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Cupo libre</p>
          <p className="text-2xl font-black text-emerald-700">{datos.cupo.restantes ?? '∞'}</p>
        </div>
      </div>

      {/* Invitar */}
      {datos.esTitular && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="flex items-center gap-2 font-bold text-slate-800">
            <UserPlus size={16} className="text-brand-primary" /> Añadir un comercial
          </p>
          {datos.puedeInvitar && !datos.equipoCompleto ? (
            <form onSubmit={invitar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@tucuenta.com"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre (opcional)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as RolEquipo)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {ROLES_EQUIPO.map((r) => (
                  <option key={r} value={r}>
                    {r === 'admin' ? 'Administrador' : 'Comercial'}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={invitando}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {invitando ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Invitar
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              {datos.equipoCompleto
                ? `El equipo ya está completo (${datos.max} comerciales). Revoca un acceso para liberar un asiento.`
                : 'La invitación de comerciales está incluida en Unlimited Flota.'}
            </p>
          )}

          {enlaceNuevo && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Enlace de invitación:</p>
              <code className="max-w-full overflow-x-auto rounded bg-white px-2 py-1 text-[11px] text-slate-700">
                {enlaceNuevo}
              </code>
              <button
                type="button"
                onClick={() => copiar(enlaceNuevo, 'nuevo')}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {copiado === 'nuevo' ? <Check size={12} /> : <Copy size={12} />} Copiar
              </button>
            </div>
          )}
        </section>
      )}

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <p className="font-bold text-slate-800">Personas con acceso</p>
        </div>
        <ul className="divide-y divide-slate-100">
          <li className="flex flex-wrap items-center gap-3 p-4">
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Crown size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">Titular de la cuenta</p>
              <p className="text-xs text-slate-500">Paga el pack y gestiona la suscripción.</p>
            </div>
            {datos.esTitular ? (
              <span className="text-xs font-semibold text-amber-700">Tú</span>
            ) : (
              <button
                type="button"
                onClick={salir}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Salir del equipo
              </button>
            )}
          </li>

          {datos.miembros.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
                <Users size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {m.nombre || m.email}
                  {m.soyYo && <span className="ml-1 text-xs font-semibold text-emerald-700">(tú)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {m.email} · {m.anunciosActivos} anuncio{m.anunciosActivos === 1 ? '' : 's'} activo
                  {m.anunciosActivos === 1 ? '' : 's'}
                </p>
              </div>

              {m.estado === 'invitado' ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Invitación pendiente
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Activo
                </span>
              )}

              {datos.esTitular && (
                <>
                  {m.estado === 'activo' && (
                    <select
                      value={m.rol}
                      onChange={(e) => cambiarRol(m.id, e.target.value as RolEquipo)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                      aria-label={`Rol de ${m.email}`}
                    >
                      {ROLES_EQUIPO.map((r) => (
                        <option key={r} value={r}>
                          {r === 'admin' ? 'Administrador' : 'Comercial'}
                        </option>
                      ))}
                    </select>
                  )}
                  {m.estado === 'invitado' && m.enlace && (
                    <button
                      type="button"
                      onClick={() => copiar(m.enlace as string, m.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {copiado === m.id ? <Check size={12} /> : <Copy size={12} />} Enlace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => revocar(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"
                    aria-label={`Revocar acceso de ${m.email}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        Al revocar un acceso, los anuncios de ese comercial siguen publicados y pasan a contar en el
        cupo de la cuenta. No se borra nada.
      </p>
    </div>
  )
}
