'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { planIncludedEn } from './contenido-en'
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

function nombrePlan(id: string | null): string {
  if (!id) return ''
  return PLANES_PRO.find(p => p.id === id)?.nombre || id
}

function fechaCorta(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PlanesClient() {
  const t = useTranslations('proPlans')
  const { session, user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual')
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

  const formatDate = (iso: string | null | undefined) => fechaCorta(iso, locale)
  const localizedPlanName = (name: string) => locale === 'en' && name === 'Profesional' ? 'Professional' : name

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
          locale,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || (!data.url && !data.actualizado)) {
        setError(locale === 'en' ? t('checkoutError') : (data.error || t('checkoutError')))
        return
      }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setMsg(locale === 'en' ? t('packUpdated') : (data.mensaje || t('packUpdated')))
      // El webhook que escribe el nuevo plan puede tardar unos segundos.
      await cargarEstado()
      setTimeout(() => { cargarEstado() }, 2500)
    } catch {
      setError(t('connectionError'))
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
        setError(locale === 'en' ? t('trialError') : (data.error || t('trialError')))
        return
      }
      setMsg(
        data.reactivados > 0
          ? t('trialActivatedReactivated', { date: formatDate(data.hasta), count: data.reactivados })
          : t('trialActivated', { date: formatDate(data.hasta) }),
      )
      await cargarEstado()
    } catch {
      setError(t('retryError'))
    } finally {
      setPruebaLoading(false)
    }
  }

  async function abrirPortal() {
    setError('')
    setPortalLoading(true)
    try {
      const res = await fetch('/api/planes/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(locale === 'en' ? t('portalError') : (data.error || t('portalError')))
        return
      }
      window.location.assign(data.url)
    } catch {
      setError(t('portalConnectionError'))
    } finally {
      setPortalLoading(false)
    }
  }

  const planActual = estado?.planPagoVigente ? estado.planContratado : 'gratis'

  return (
    <div>
      {/* Resultado del pago */}
      {pago === 'ok' && (
        <div className={`mb-6 rounded-2xl border p-5 flex items-start gap-3 ${estado?.planPagoVigente ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {estado?.planPagoVigente
            ? <BadgeCheck className="text-emerald-600 mt-0.5 shrink-0" size={22} />
            : <Loader2 className="text-amber-700 mt-0.5 shrink-0 animate-spin" size={22} aria-hidden="true" />}
          <div className="flex-1">
            <p className={`font-bold ${estado?.planPagoVigente ? 'text-emerald-900' : 'text-amber-900'}`}>{estado?.planPagoVigente ? t('paymentConfirmed') : t('paymentProcessing')}</p>
            <p className={`text-sm mt-1 ${estado?.planPagoVigente ? 'text-emerald-800' : 'text-amber-900'}`}>
              {estado?.planPagoVigente && planPagado ? `${t('planPaid', { name: localizedPlanName(nombrePlan(planPagado)) })} ` : ''}
              {estado?.planPagoVigente ? t('paymentDoneDesc') : t('paymentPendingDesc')}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              {estado?.planPagoVigente && <LocalLink href="/publicar" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                {t('publishListing')} <ArrowRight size={15} />
              </LocalLink>}
              <LocalLink href="/dashboard?tab=plan" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">
                {t('myPlan')}
              </LocalLink>
            </div>
          </div>
        </div>
      )}
      {pago === 'cancelado' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {t('paymentCancelled')}
        </div>
      )}

      {/* Prueba activa o gracia */}
      {estado?.trialGracia && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-amber-900">
              {t('graceTitle', { days: estado.diasGracia ?? 0 })}
            </p>
            <p className="text-sm text-amber-800">
              {t('graceDesc', { date: formatDate(estado.graciaHasta) })}
            </p>
          </div>
          <LocalLink
            href="/dashboard?tab=plan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
          >
            {t('activateProfessional')} <ArrowRight size={14} />
          </LocalLink>
        </div>
      )}
      {estado?.trial && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-amber-900">
              {t('trialTitle', { remaining: estado.diasTrial > 0 ? t('trialDays', { days: estado.diasTrial }) : '' })}
            </p>
            <p className="text-sm text-amber-800">
              {t('trialDesc')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              <Sparkles size={14} /> {t('trialActive')}
            </span>
            <LocalLink
              href="/dashboard?tab=plan"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-accent-dark"
            >
              {t('activateProfessional')} <ArrowRight size={13} />
            </LocalLink>
          </div>
        </div>
      )}

      {/* Prueba disponible */}
      {session && estado?.trialElegible && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-bold text-emerald-900">{t('trialOfferTitle')}</p>
            <p className="text-sm text-emerald-800">
              {t('trialOfferDesc')}
              {estado?.tipo === 'particular' && (
                <span className="mt-1 block text-xs text-emerald-700">
                  {t('particularPromote')}
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
            {t('startTrial')}
          </button>
        </div>
      )}

      {/* Periodicidad */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{t('onePlan')}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('onePlanDesc')}
            </p>
          </div>

          <div className="lg:text-right">
            <p className="text-sm font-bold text-slate-900">{t('payment')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('annualSavings')}</p>
            <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label={t('periodicity')}>
              <button
                type="button"
                onClick={() => setPeriodicidad('mensual')}
                aria-pressed={periodicidad === 'mensual'}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  periodicidad === 'mensual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('monthly')}
              </button>
              <button
                type="button"
                onClick={() => setPeriodicidad('anual')}
                aria-pressed={periodicidad === 'anual'}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  periodicidad === 'anual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('annually')} <span className="text-emerald-700">−17 %</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta única */}
      <div className="mx-auto grid max-w-md gap-4">
        {PLANES_PRO.map(p => {
          const esActual = planActual === p.id
          const precio = precioPlan(p.id, periodicidad)
          const ahorro = descuentoAnualPct(p.id)
          const porAnuncio = p.cupo
            ? (periodicidad === 'anual' ? precioMensualEquivalente(p.id) : precio) / p.cupo
            : null
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border border-brand-accent bg-white p-5 shadow-lg ring-1 ring-brand-accent sm:p-6`}
            >
              <div className="flex items-start justify-between gap-2 min-h-[24px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                  <Sparkles size={12} /> {t('uniquePlan')}
                </span>
                {esActual && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Check size={12} /> {t('currentPlan')}
                  </span>
                )}
                {!esActual && estado?.trial && estado.plan === p.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                    {t('inTrial')}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-slate-900 mt-3">{localizedPlanName(p.nombre)}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{locale === 'en' ? t('audience') : p.paraQuien}</p>

              <div className="mt-4">
                <p className="text-4xl font-black text-slate-900">
                  {formatPrecio(periodicidad === 'anual' ? precioMensualEquivalente(p.id) : precio)}
                  <span className="text-sm font-semibold text-slate-500">{t('perMonth')}</span>
                </p>
                {periodicidad === 'anual' ? (
                  <p className="text-xs text-slate-500 mt-1">
                    {t('yearlyPrice', { price: formatPrecio(precio), percent: ahorro })}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">{t('monthlyBilling')}</p>
                )}
                {porAnuncio != null && (
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    {t('perListing', { price: formatPrecio(porAnuncio) })}
                  </p>
                )}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-slate-700 flex-1">
                {(locale === 'en' ? planIncludedEn : p.incluido).map(item => (
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
                    : 'bg-brand-accent text-white hover:bg-brand-accent-dark'
                }`}
              >
                {loading === p.id ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('openingCheckout')}
                  </>
                ) : esActual ? (
                  <>
                    <Check size={16} /> {t('planCurrent')}
                  </>
                ) : !session ? (
                  <>
                    {t('startWith', { name: localizedPlanName(p.nombre) })} <ArrowRight size={16} />
                  </>
                ) : estado?.trial && estado.plan === p.id ? (
                  <>
                    {t('activateNow', { name: localizedPlanName(p.nombre) })} <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    {t('choose', { name: localizedPlanName(p.nombre) })} <ArrowRight size={16} />
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
                  {t('tryFree')}
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
            <p className="font-semibold text-slate-900">{t('noContract')}</p>
            <p className="text-xs text-slate-500">{t('noContractDesc')}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <CreditCard size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">{t('invoice')}</p>
            <p className="text-xs text-slate-500">{t('invoiceDesc')}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <Lock size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">{t('secure')}</p>
            <p className="text-xs text-slate-500">{t('secureDesc')}</p>
          </div>
        </div>
      </div>

      {estado?.suscripcionStripe && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-slate-900">{t('manage')}</p>
            <p className="text-xs text-slate-500">
              {t('manageDesc')}
              {estado.planHasta ? t('nextRenewal', { date: formatDate(estado.planHasta) }) : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={abrirPortal}
            disabled={portalLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {portalLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {t('openManage')}
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
            <span className="block text-sm font-bold text-slate-900">{t('couponTitle')}</span>
            <span className="block text-xs text-slate-500">{t('couponDesc')}</span>
          </span>
          <span className="text-xs font-semibold text-slate-500">{t(mostrarCupon ? 'hide' : 'add')}</span>
        </button>
        {mostrarCupon && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={cupon}
              onChange={e => setCupon(e.target.value.toUpperCase())}
              placeholder={t('couponPlaceholder')}
              aria-label={t('couponLabel')}
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
                  setError(locale === 'en' ? t('couponError') : (data.error || t('couponError')))
                  return
                }
                setMsg(t('couponRedeemed', { name: localizedPlanName(nombrePlan(data.plan)), date: formatDate(data.hasta) }))
                await cargarEstado()
              }}
              disabled={loading === 'cupon'}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              {t(loading === 'cupon' ? 'redeeming' : 'redeem')}
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {t('couponHint')}
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
          {t('createQuestion')}{' '}
          <LocalLink href="/register" className="font-semibold underline">
            {t('createFree')}
          </LocalLink>{' '}
          {t('createDesc')}
        </p>
      )}

      {session && estado?.tipo === 'particular' && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {t('promoteDesc')}
        </p>
      )}

      {user?.email && !estado && !authLoading && (
        <p className="mt-4 text-center text-xs text-slate-400">
          {t('signedIn', { email: user.email })}
        </p>
      )}
    </div>
  )
}
