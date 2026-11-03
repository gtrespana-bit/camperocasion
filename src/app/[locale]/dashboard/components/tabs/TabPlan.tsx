'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { planIncludedEn } from '@/app/[locale]/para-profesionales/contenido-en'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  Package,
  Sparkles,
  Star,
  Store,
  TrendingUp,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { PLANES_PRO, PLAN_GRATIS, etiquetaPlan } from '@/lib/planes-anuncios'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'

type Estado = {
  tipo: string
  plan: string
  planContratado: string
  planHasta: string | null
  planPagoVigente: boolean
  suscripcionStripe: boolean
  gestionable: boolean
  trial: boolean
  trialHasta: string | null
  trialInicio?: string | null
  diasTrial: number
  diasTrialTotal: number
  trialElegible?: boolean
  trialUsado?: boolean
  trialGracia?: boolean
  diasGracia?: number
  graciaHasta?: string | null
  pagoFallido?: boolean
  pagoPendienteDesde?: string | null
  pausadosPorPlan?: number
  creditos: number
  cupo: {
    max: number | null
    usados: number
    restantes: number | null
    puedePublicar: boolean
    plan: string
    fotosMax: number
    destacadosMes: number
    destacadosUsados: number
    destacadosRestantes: number
    trial: boolean
    tipo: string
  }
}

function fecha(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Barra({ valor, max, tono = 'verde' }: { valor: number; max: number | null; tono?: 'verde' | 'ambar' }) {
  const pct = max == null || max <= 0 ? 100 : Math.min(100, Math.round((valor / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
      <div
        className={`h-full rounded-full transition-all ${tono === 'ambar' ? 'bg-amber-500' : pct >= 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function TabPlan({ onRefresh }: { onRefresh?: () => void }) {
  const t = useTranslations('planTab')
  const locale = useLocale()
  const date = (iso: string | null | undefined) => fecha(iso, locale)
  const typeName = (tipo: string) => ({ particular: t('sellerPrivate'), camperizador: t('sellerConverter'), profesional: t('sellerProfessional') } as Record<string, string>)[tipo] || tipo
  const planName = (plan: string) => ({ gratis: t('planFree'), plus: t('planProfessional'), starter: t('planLegacyStarter'), unlimited: t('planLegacyUnlimited') } as Record<string, string>)[plan] || etiquetaPlan(plan)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [portal, setPortal] = useState(false)
  const [prueba, setPrueba] = useState(false)
  const [reactivando, setReactivando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/planes/estado', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(locale === 'en' ? t('loadError') : (data?.error || t('loadError')))
        return
      }
      setEstado(data)
      setError('')
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [locale, t])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function empezarPrueba() {
    setError('')
    setAviso('')
    setPrueba(true)
    try {
      const res = await fetch('/api/planes/prueba', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(locale === 'en' ? t('trialError') : (data.error || t('trialError')))
        return
      }
      setAviso(
        data.reactivados > 0
          ? t('trialReactivated', { count: data.reactivados })
          : t('trialActivated', { date: date(data.hasta) }),
      )
      await cargar()
      onRefresh?.()
      window.dispatchEvent(new Event('plan-actualizado'))
    } catch {
      setError(t('connectionError'))
    } finally {
      setPrueba(false)
    }
  }

  async function reactivarPausados() {
    setError('')
    setAviso('')
    setReactivando(true)
    try {
      const res = await fetch('/api/productos/reactivar-pausados', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(locale === 'en' ? t('reactivateError') : (data.error || t('reactivateError')))
        return
      }
      setAviso(
        data.reactivados > 0
          ? t('reactivated', { count: data.reactivados, rest: data.restantes > 0 ? t('stillPaused', { count: data.restantes }) : '' })
          : t('noRoom'),
      )
      await cargar()
      onRefresh?.()
      window.dispatchEvent(new Event('plan-actualizado'))
    } catch {
      setError(t('connectionError'))
    } finally {
      setReactivando(false)
    }
  }

  async function abrirPortal() {
    setError('')
    setPortal(true)
    try {
      const res = await fetch('/api/planes/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(locale === 'en' ? t('portalError') : (data.error || t('portalError')))
        return
      }
      window.location.assign(data.url)
    } catch {
      setError(t('stripeError'))
    } finally {
      setPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> {t('loading')}
      </div>
    )
  }

  if (!estado) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || t('loadError')}
      </div>
    )
  }

  const planNombre = planName(estado.planPagoVigente ? estado.planContratado : estado.plan)
  const esGratis = !estado.planPagoVigente && !estado.trial && !estado.trialGracia
  const pctRestante =
    estado.diasTrialTotal > 0
      ? Math.min(100, Math.max(0, Math.round((estado.diasTrial / estado.diasTrialTotal) * 100)))
      : 0

  // Un solo plan de pago: si no lo tienen (o están en prueba), se ofrece
  // Profesional. Ya no hay escalera ni «cambiar de pack».
  const siguiente = estado.planPagoVigente ? null : PLANES_PRO[0]
  const tituloSiguiente = siguiente
    ? estado.trial || estado.trialGracia
      ? t('trialActivateTitle')
      : t('upgradeTitle')
    : ''

  return (
    <div className="space-y-5">
      {/* Plan actual */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary to-brand-dark text-white">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{t('yourPlan')}</p>
              <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-black">
                {estado.trial ? t('professionalTrial') : estado.trialGracia ? t('trialGrace') : planNombre}
                {estado.trial ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-200">
                    <Sparkles size={12} /> {t('days', { count: estado.diasTrial })}
                  </span>
                ) : estado.trialGracia ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-200">
                    <Sparkles size={12} /> {t('graceDays', { count: estado.diasGracia ?? 0 })}
                  </span>
                ) : estado.pagoFallido ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-400/20 px-2.5 py-1 text-xs font-bold text-red-200">
                    <CreditCard size={12} /> {t('paymentPending')}
                  </span>
                ) : estado.planPagoVigente ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-bold text-emerald-200">
                    <BadgeCheck size={12} /> {t('active')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white/80">
                    {t('free')}
                  </span>
                )}
              </h2>
              <p className="mt-2 max-w-lg text-sm text-white/75">
                {estado.trial
                  ? t('trialDetail', { date: date(estado.trialHasta) })
                  : estado.trialGracia
                    ? t('graceDetail', { end: date(estado.trialHasta), grace: date(estado.graciaHasta) })
                    : estado.pagoFallido
                      ? t('failedPaymentDetail', { until: estado.planHasta ? t('failedUntil', { date: date(estado.planHasta) }) : '' })
                      : estado.planPagoVigente
                    ? estado.planHasta
                      ? estado.suscripcionStripe
                        ? t('renewalDetail', { date: date(estado.planHasta) })
                        : t('giftDetail', { date: date(estado.planHasta) })
                      : t('activeDetail')
                    : t('freeDetail', { listings: PLAN_GRATIS.cupo ?? 1, photos: PLAN_GRATIS.fotos })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {estado.planPagoVigente && estado.suscripcionStripe && (
                <button
                  type="button"
                  onClick={abrirPortal}
                  disabled={portal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
                >
                  {portal ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {t('manageSubscription')}
                </button>
              )}
              <LocalLink
                href="/para-profesionales"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
              >
                {t(estado.trial || estado.trialGracia ? 'activateProfessional' : esGratis ? 'beProfessional' : 'viewProfessional')}
                <ArrowRight size={14} />
              </LocalLink>
            </div>
          </div>

          {estado.trial && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/70">
                <span>{t('freeTrial')}</span>
                <span>
                  {t('trialRemaining', { days: estado.diasTrial, total: estado.diasTrialTotal })}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pctRestante}%` }} />
              </div>
            </div>
          )}
          {estado.trialGracia && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/70">
                <span>{t('gracePeriod')}</span>
                <span>{t('daysRemaining', { days: estado.diasGracia ?? 0 })}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, Math.max(0, ((estado.diasGracia || 0) / 7) * 100))}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}
      {aviso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</div>
      )}

      {estado.pagoFallido && (
        <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
          <h3 className="text-base font-black text-red-900">{t('failedTitle')}</h3>
          <p className="mt-1 text-sm text-red-800">
            {t('failedDesc', { since: estado.pagoPendienteDesde ? t('failedSince', { date: date(estado.pagoPendienteDesde) }) : '', until: estado.planHasta ? t('accessUntil', { date: date(estado.planHasta) }) : '' })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {estado.gestionable && (
              <button
                type="button"
                onClick={abrirPortal}
                disabled={portal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {portal ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                {t('updateCard')}
              </button>
            )}
            <LocalLink
              href="/para-profesionales"
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
            >
              {t('viewProfessional')}
            </LocalLink>
          </div>
        </section>
      )}

      {estado.trialGracia && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-black text-amber-900">
            {t('graceTitle', { days: estado.diasGracia ?? 0 })}
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            {t('graceWarning', { date: date(estado.graciaHasta) })}
          </p>
          <LocalLink
            href="/para-profesionales"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
          >
            {t('activateProfessional')} <ArrowRight size={14} />
          </LocalLink>
        </section>
      )}

      {estado.trialElegible && (
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-base font-black text-emerald-900">{t('trialOfferTitle')}</h3>
          <p className="mt-1 text-sm text-emerald-800">
            {t('trialOfferDesc', { listings: PLANES_PRO[0].cupo ?? 15, featured: PLANES_PRO[0].destacadosMes, photos: PLANES_PRO[0].fotos })}
            {estado.tipo === 'particular' && (
              <span className="mt-1 block text-xs text-emerald-700">
                {t('trialSellerType')}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={empezarPrueba}
            disabled={prueba}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {prueba ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t('startTrial')}
          </button>
        </section>
      )}

      {(estado.pausadosPorPlan || 0) > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-black text-slate-900">
            {t('pausedTitle', { count: estado.pausadosPorPlan ?? 0 })}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {t('pausedDesc')}
          </p>
          <button
            type="button"
            onClick={reactivarPausados}
            disabled={reactivando}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {reactivando ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            {t('reactivate')}
          </button>
        </section>
      )}

      {/* Consumo */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-900">{t('capacity')}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('activeListings')}</span>
              <Package size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {estado.cupo.usados}
              <span className="text-sm font-semibold text-slate-400"> / {estado.cupo.max == null ? '∞' : estado.cupo.max}</span>
            </p>
            <div className="mt-2">
              <Barra valor={estado.cupo.usados} max={estado.cupo.max} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {estado.cupo.max == null
                ? t('unlimited')
                : estado.cupo.restantes === 0
                  ? t('quotaFull')
                  : t('slotsLeft', { count: estado.cupo.restantes ?? 0 })}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('photos')}</span>
              <Store size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{estado.cupo.fotosMax}</p>
            <p className="mt-2 text-xs text-slate-500">{t('photosDesc')}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('featured')}</span>
              <Star size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {estado.cupo.destacadosRestantes}
              <span className="text-sm font-semibold text-slate-400"> / {estado.cupo.destacadosMes}</span>
            </p>
            <div className="mt-2">
              <Barra valor={estado.cupo.destacadosUsados} max={estado.cupo.destacadosMes || 1} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {estado.cupo.destacadosMes === 0 ? t('noFeatured') : t('featuredIncluded')}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('credits')}</span>
              <TrendingUp size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{estado.creditos}</p>
            <p className="mt-2 text-xs text-slate-500">{t('creditsDesc')}</p>
            <LocalLink href="/creditos" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-accent hover:underline">
              {t('buyCredits')} <ArrowRight size={12} />
            </LocalLink>
          </div>
        </div>
      </section>

      {/* Upsell contextual */}
      {siguiente && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t('nextStep')}</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{tituloSiguiente}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t('upgradeDesc', { listings: siguiente.cupo ?? 15, featured: siguiente.destacadosMes, photos: siguiente.fotos, price: formatPrecio(siguiente.precioMes) })}
              </p>
            </div>
            <LocalLink
              href="/para-profesionales"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-accent-dark"
            >
              {t('viewProfessional')} <ArrowRight size={15} />
            </LocalLink>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-3">
            {(locale === 'en' ? planIncludedEn : siguiente.incluido).slice(0, 3).map(item => (
              <li key={item} className="flex items-start gap-1.5">
                <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Identidad vs plan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-900">{t('typeTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {t('sellerTypeDesc', { type: typeName(estado.tipo) })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LocalLink href="/dashboard?tab=cuenta" className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {t('changeSellerType')}
          </LocalLink>
          <LocalLink href="/para-profesionales" className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {t('seeBenefits')}
          </LocalLink>
        </div>
      </section>

      {esGratis && (
        <p className="text-center text-xs text-slate-500">
          {t('freeSummary', { listings: PLAN_GRATIS.cupo ?? 1, photos: PLAN_GRATIS.fotos })}
        </p>
      )}

    </div>
  )
}
