'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import LocalLink from '@/components/LocalLink'
import {
  PLANES_PRO,
  descuentoAnualPct,
  planRecomendado,
  precioMensualEquivalente,
  precioPlan,
  type Periodicidad,
  type PlanPago,
} from '@/lib/planes-anuncios'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'
import { routing } from '@/i18n/routing'

type EstadoPlan = {
  tipo: string
  plan: string
  planContratado: string
  planHasta: string | null
  planPagoVigente: boolean
  suscripcionStripe: boolean
  gestionable: boolean
  trial: boolean
  trialHasta: string | null
  diasTrial: number
  diasTrialTotal: number
  trialElegible?: boolean
  trialUsado?: boolean
  trialGracia?: boolean
  diasGracia?: number
  graciaHasta?: string | null
  pagoFallido?: boolean
  pausadosPorPlan?: number
  creditos: number
}

const OPCIONES_STOCK = [
  { id: 'pequeno', label: '1–4', vehiculos: 3 },
  { id: 'medio', label: '5–15', vehiculos: 10 },
  { id: 'grande', label: '16 o más', vehiculos: 16 },
] as const

function nombrePlan(id: string | null): string {
  if (!id) return ''
  return PLANES_PRO.find(p => p.id === id)?.nombre || id
}

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PlanesClient() {
  const { session, user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual')
  const [stock, setStock] = useState<(typeof OPCIONES_STOCK)[number]['id']>('medio')
  const [cupon, setCupon] = useState('')
  const [mostrarCupon, setMostrarCupon] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoPlan | null>(null)
  const [pago, setPago] = useState<string | null>(null)
  const [planPagado, setPlanPagado] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [pruebaLoading, setPruebaLoading] = useState(false)

  const locale = useMemo(() => {
    for (const l of routing.locales) {
      if (l === routing.defaultLocale) continue
      if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l
    }
    return routing.defaultLocale
  }, [pathname])

  const aLogin = () => {
    const prefix = locale === routing.defaultLocale ? '' : `/${locale}`
    window.location.assign(`${prefix}/login?redirect=/para-profesionales`)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setPago(params.get('pago'))
    setPlanPagado(params.get('plan'))
  }, [])

  const cargarEstado = useCallback(async (): Promise<EstadoPlan | null> => {
    if (!session) return null
    try {
      const res = await fetch('/api/planes/estado', { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.ok) {
        setEstado(data)
        return data as EstadoPlan
      }
    } catch {
      /* silencio: no bloquea la página de precios */
    }
    return null
  }, [session])

  useEffect(() => {
    if (!session) {
      setEstado(null)
      return
    }
    let vivo = true
    let intentos = 0
    const cargar = async () => {
      intentos++
      const data = await cargarEstado()
      // El webhook puede tardar unos segundos tras volver de Stripe. Se
      // reintenta hasta que el plan figure como activo (no basta con que la
      // petición responda 200: el pago puede seguir en camino).
      if (!data?.planPagoVigente && vivo && pago === 'ok' && intentos < 5) {
        setTimeout(cargar, 2500)
      }
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [session, pago, cargarEstado])

  const recomendado = planRecomendado(OPCIONES_STOCK.find(o => o.id === stock)?.vehiculos ?? 5)

  async function contratar(plan: PlanPago) {
    setMsg('')
    setError('')
    if (!session) {
      aLogin()
      return
    }
    setLoading(plan)
    try {
      const res = await fetch('/api/planes/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          periodicidad,
          cupon: cupon.trim() ? cupon.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || (!data.url && !data.actualizado)) {
        setError(data.error || 'No se pudo abrir el pago.')
        return
      }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setMsg(data.mensaje || 'Pack actualizado. Stripe aplicará la diferencia en la próxima factura.')
      // El webhook que escribe el nuevo plan puede tardar unos segundos.
      await cargarEstado()
      setTimeout(() => { cargarEstado() }, 2500)
    } catch {
      setError('No se pudo conectar con la pasarela de pago.')
    } finally {
      setLoading(null)
    }
  }

  async function empezarPrueba() {
    setMsg('')
    setError('')
    if (!session) {
      aLogin()
      return
    }
    setPruebaLoading(true)
    try {
      const res = await fetch('/api/planes/prueba', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo empezar la prueba.')
        return
      }
      setMsg(
        data.reactivados > 0
          ? `Prueba activada hasta el ${fechaCorta(data.hasta)}. Hemos vuelto a publicar ${data.reactivados} anuncio${data.reactivados === 1 ? '' : 's'}.`
          : `Prueba activada hasta el ${fechaCorta(data.hasta)}. Sin tarjeta y sin cobro automático.`,
      )
      await cargarEstado()
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setPruebaLoading(false)
    }
  }

  async function abrirPortal() {
    setError('')
    setPortalLoading(true)
    try {
      const res = await fetch('/api/planes/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error || 'No se pudo abrir la gestión de la suscripción.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('No se pudo conectar con Stripe.')
    } finally {
      setPortalLoading(false)
    }
  }

  const planActual = estado?.planPagoVigente ? estado.planContratado : 'gratis'

  return (
    <div>
      {/* Resultado del pago */}
      {pago === 'ok' && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
          <BadgeCheck className="text-emerald-600 mt-0.5 shrink-0" size={22} />
          <div className="flex-1">
            <p className="font-bold text-emerald-900">¡Pack activado! Gracias por confiar en CamperOcasión.</p>
            <p className="text-sm text-emerald-800 mt-1">
              {planPagado ? `Ya tienes el pack ${nombrePlan(planPagado)}. ` : ''}
              Puedes publicar tu siguiente anuncio ahora mismo. La factura llega por email desde Stripe.
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <LocalLink href="/publicar" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                Publicar un anuncio <ArrowRight size={15} />
              </LocalLink>
              <LocalLink href="/dashboard?tab=plan" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">
                Ver mi plan
              </LocalLink>
            </div>
          </div>
        </div>
      )}
      {pago === 'cancelado' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No se ha cobrado nada. Tu plan sigue como estaba y puedes contratarlo cuando quieras.
        </div>
      )}

      {/* Prueba activa o gracia */}
      {estado?.trialGracia && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-amber-900">
              Tu prueba terminó · te quedan {estado.diasGracia} días de gracia
            </p>
            <p className="text-sm text-amber-800">
              Hasta el {fechaCorta(estado.graciaHasta)} tus anuncios siguen publicados. Después se pausarán
              los que excedan el cupo gratuito, sin borrar nada.
            </p>
          </div>
          <LocalLink
            href="/dashboard?tab=plan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
          >
            Activar mi pack <ArrowRight size={14} />
          </LocalLink>
        </div>
      )}
      {estado?.trial && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-amber-900">
              Estás probando el pack Plus{estado.diasTrial > 0 ? ` · quedan ${estado.diasTrial} días` : ''}
            </p>
            <p className="text-sm text-amber-800">
              Aprovecha para publicar todo tu stock. Al terminar hay 7 días de gracia y después se pausan
              los anuncios que sobren, sin borrarlos. Activa un pack cuando quieras.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              <Sparkles size={14} /> Prueba activa
            </span>
            <LocalLink
              href="/dashboard?tab=plan"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-accent-dark"
            >
              Activar Plus <ArrowRight size={13} />
            </LocalLink>
          </div>
        </div>
      )}

      {/* Prueba disponible */}
      {session && estado?.trialElegible && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-emerald-900">Puedes probar Plus 30 días, gratis</p>
            <p className="text-sm text-emerald-800">
              15 anuncios, 5 destacados al mes y escaparate. Sin tarjeta y sin cobro automático.
              Al terminar, 7 días de gracia y no se borra ningún anuncio.
              {estado?.tipo === 'particular' && (
                <span className="mt-1 block text-xs text-emerald-700">
                  Al empezar, tu cuenta pasa a «profesional» (gratis) para recibir el cupo de Plus.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={empezarPrueba}
            disabled={pruebaLoading}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pruebaLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Empezar prueba
          </button>
        </div>
      )}

      {/* Selector de stock + periodicidad */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">¿Cuántas camper tienes a la venta?</p>
            <p className="text-xs text-slate-500 mt-0.5">Te marcamos el pack que encaja. Puedes cambiarlo cuando quieras.</p>
            <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Vehículos en stock">
              {OPCIONES_STOCK.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setStock(o.id)}
                  aria-pressed={stock === o.id}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                    stock === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:text-right">
            <p className="text-sm font-bold text-slate-900">Pago</p>
            <p className="text-xs text-slate-500 mt-0.5">El anual sale como 10 mensualidades: 2 meses gratis.</p>
            <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Periodicidad">
              <button
                type="button"
                onClick={() => setPeriodicidad('mensual')}
                aria-pressed={periodicidad === 'mensual'}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  periodicidad === 'mensual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriodicidad('anual')}
                aria-pressed={periodicidad === 'anual'}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  periodicidad === 'anual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Anual <span className="text-emerald-700">−17 %</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANES_PRO.map(p => {
          const esActual = planActual === p.id
          const esRecomendado = recomendado === p.id
          const precio = precioPlan(p.id, periodicidad)
          const ahorro = descuentoAnualPct(p.id)
          const porAnuncio = p.cupo
            ? (periodicidad === 'anual' ? precioMensualEquivalente(p.id) : precio) / p.cupo
            : null
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 sm:p-6 transition ${
                esRecomendado
                  ? 'border-brand-accent shadow-lg ring-1 ring-brand-accent lg:-translate-y-1'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 min-h-[24px]">
                {esRecomendado ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                    <Sparkles size={12} /> Recomendado para tu stock
                  </span>
                ) : (
                  <span />
                )}
                {esActual && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Check size={12} /> Tu plan
                  </span>
                )}
                {!esActual && estado?.trial && estado.plan === p.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                    En prueba
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-slate-900 mt-3">{p.nombre}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{p.paraQuien}</p>

              <div className="mt-4">
                <p className="text-4xl font-black text-slate-900">
                  {formatPrecio(periodicidad === 'anual' ? precioMensualEquivalente(p.id) : precio)}
                  <span className="text-sm font-semibold text-slate-500">/mes</span>
                </p>
                {periodicidad === 'anual' ? (
                  <p className="text-xs text-slate-500 mt-1">
                    {formatPrecio(precio)} al año · ahorras {ahorro} %
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Facturado mes a mes · sin permanencia</p>
                )}
                {porAnuncio != null && (
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    {formatPrecio(porAnuncio)} por anuncio al mes
                  </p>
                )}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-slate-700 flex-1">
                {p.incluido.map(item => (
                  <li key={item} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={loading === p.id || esActual}
                onClick={() => contratar(p.id)}
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-70 ${
                  esActual
                    ? 'bg-slate-100 text-slate-500'
                    : esRecomendado
                      ? 'bg-brand-accent text-white hover:bg-brand-accent-dark'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {loading === p.id ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Abriendo pago…
                  </>
                ) : esActual ? (
                  <>
                    <Check size={16} /> Plan actual
                  </>
                ) : !session ? (
                  <>
                    Empezar con {p.nombre} <ArrowRight size={16} />
                  </>
                ) : estado?.suscripcionStripe ? (
                  <>
                    Cambiar a {p.nombre} <ArrowRight size={16} />
                  </>
                ) : estado?.trial && estado.plan === p.id ? (
                  <>
                    Activar {p.nombre} ahora <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    Elegir {p.nombre} <ArrowRight size={16} />
                  </>
                )}
              </button>

              {p.id === 'plus' && estado?.trialElegible && (
                <button
                  type="button"
                  onClick={empezarPrueba}
                  disabled={pruebaLoading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {pruebaLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  Probar 30 días gratis
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Garantías */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <ShieldCheck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">Sin permanencia</p>
            <p className="text-xs text-slate-500">Cancela cuando quieras desde tu panel.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <CreditCard size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">Factura con IVA</p>
            <p className="text-xs text-slate-500">Añade tu NIF/CIF en el pago. Tarjeta, Apple Pay y Google Pay.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <Lock size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">Pago seguro con Stripe</p>
            <p className="text-xs text-slate-500">No vemos ni guardamos los datos de tu tarjeta.</p>
          </div>
        </div>
      </div>

      {estado?.suscripcionStripe && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Gestionar mi suscripción</p>
            <p className="text-xs text-slate-500">
              Cambia la tarjeta, descarga facturas o date de baja.
              {estado.planHasta ? ` Próxima renovación: ${fechaCorta(estado.planHasta)}.` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={abrirPortal}
            disabled={portalLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {portalLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            Abrir gestión
          </button>
        </div>
      )}

      {/* Cupón */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          onClick={() => setMostrarCupon(v => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={mostrarCupon}
        >
          <span>
            <span className="block text-sm font-bold text-slate-900">¿Tienes un cupón?</span>
            <span className="block text-xs text-slate-500">Descuento en la cuota o días de regalo.</span>
          </span>
          <span className="text-xs font-semibold text-slate-500">{mostrarCupon ? 'Ocultar' : 'Añadir'}</span>
        </button>
        {mostrarCupon && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={cupon}
              onChange={e => setCupon(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              aria-label="Código de cupón"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <button
              type="button"
              onClick={async () => {
                setError('')
                setMsg('')
                if (!session) return aLogin()
                setLoading('cupon')
                const res = await fetch('/api/planes/canjear', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ codigo: cupon }),
                })
                const data = await res.json().catch(() => ({}))
                setLoading(null)
                if (!res.ok) {
                  setError(data.error || 'No se pudo canjear el cupón.')
                  return
                }
                setMsg(`Cupón canjeado: pack ${data.plan} activo hasta ${fechaCorta(data.hasta)}.`)
                await cargarEstado()
              }}
              disabled={loading === 'cupon'}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === 'cupon' ? 'Canjeando…' : 'Canjear regalo'}
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          El descuento se aplica al pulsar «Elegir pack». Los cupones de días se canjean aquí sin pasar por el pago.
        </p>
      </div>

      {msg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {msg}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <X size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!authLoading && !session && (
        <p className="mt-4 text-center text-sm text-slate-500">
          ¿Todavía no tienes cuenta?{' '}
          <LocalLink href="/register" className="font-semibold underline">
            Créala gratis
          </LocalLink>{' '}
          y publica tu primera camper sin pagar nada.
        </p>
      )}

      {session && estado?.tipo === 'particular' && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Al contratar un pack, tu perfil pasa a <strong>profesional</strong> automáticamente (es gratis). Así
          recibes el cupo que pagas en lugar de quedarte en el límite de 1 anuncio.
        </p>
      )}

      {user?.email && !estado && !authLoading && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Sesión iniciada como {user.email}
        </p>
      )}
    </div>
  )
}
