'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CreditCard, Sparkles } from 'lucide-react'
import { etiquetaPlan } from '@/lib/planes-anuncios'
import type { DashboardTab } from './DashboardNav'

type Estado = {
  plan: string
  planContratado: string
  planPagoVigente: boolean
  trial: boolean
  diasTrial: number
  trialGracia?: boolean
  diasGracia?: number
  pagoFallido?: boolean
  pausadosPorPlan?: number
  cupo: { usados: number; max: number | null; restantes: number | null }
}

/**
 * Franja de estado del plan, visible en todas las pestañas del panel.
 *
 * Antes el plan solo aparecía cuando el usuario se quedaba sin cupo. Es el
 * peor momento para explicar que existe un pack: ya está frustrado. Esta
 * franja lo mantiene visible (y con la cuenta atrás de la prueba) sin tapar
 * el contenido.
 */
export default function PlanBar({ onAbrirPlan }: { onAbrirPlan: (tab: DashboardTab) => void }) {
  const t = useTranslations('dashboard.planBar')
  const [estado, setEstado] = useState<Estado | null>(null)

  useEffect(() => {
    let vivo = true
    const cargar = () => {
      fetch('/api/planes/estado', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!vivo || !d?.ok) return
          setEstado(d)
        })
        .catch(() => {})
    }
    cargar()
    // Tras empezar la prueba o reactivar anuncios, la franja debe reflejarlo
    // sin obligar a recargar la página.
    window.addEventListener('plan-actualizado', cargar)
    return () => {
      vivo = false
      window.removeEventListener('plan-actualizado', cargar)
    }
  }, [])

  if (!estado) return null

  const cupo = estado.cupo
  const plan = estado.planPagoVigente ? estado.planContratado : estado.plan
  const nombre = estado.trial
    ? t('trial')
    : estado.trialGracia
      ? t('trialGrace')
      : plan === 'plus' ? t('professional') : plan === 'gratis' ? t('free') : etiquetaPlan(plan)

  const detalles = [nombre]
  detalles.push(cupo.max == null ? t('unlimited') : t('usage', { used: cupo.usados, max: cupo.max }))
  if (estado.trial && estado.diasTrial > 0) detalles.push(t('trialDays', { count: estado.diasTrial }))
  if (estado.trialGracia) detalles.push(t('graceDays', { count: estado.diasGracia || 0 }))
  if (estado.pausadosPorPlan) detalles.push(t('paused', { count: estado.pausadosPorPlan }))
  const texto = detalles.join(' · ')

  const fallo = Boolean(estado.pagoFallido)
  const destacar = Boolean(estado.trial || estado.trialGracia || !estado.planPagoVigente)

  return (
    <button
      type="button"
      onClick={() => onAbrirPlan('plan')}
      className={`mb-5 flex w-full flex-col items-start gap-2 rounded-md border px-4 py-3 text-left text-sm transition sm:flex-row sm:items-center sm:justify-between ${
        fallo
          ? 'border-red-300 bg-red-50 hover:bg-red-100'
          : destacar
            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
            : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="flex min-w-0 items-start gap-2 sm:items-center">
        {fallo ? (
          <CreditCard size={16} className="shrink-0 text-red-600" aria-hidden="true" />
        ) : (
          <Sparkles size={16} className={destacar ? 'shrink-0 text-amber-600' : 'shrink-0 text-emerald-600'} aria-hidden="true" />
        )}
        <span className={`font-semibold leading-relaxed ${fallo ? 'text-red-900' : 'text-slate-800'}`}>
          {fallo ? t('pendingPayment') : t('planLabel')}{' '}
          {texto}
        </span>
      </span>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${fallo ? 'text-red-800' : destacar ? 'text-amber-800' : 'text-slate-500'}`}>
        {fallo
          ? t('update')
          : estado.trial || estado.trialGracia
            ? t('activate')
            : estado.planPagoVigente
              ? t('manage')
              : t('seeProfessional')}
        <ArrowRight size={13} aria-hidden="true" />
      </span>
    </button>
  )
}
