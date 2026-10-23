'use client'

import { useEffect, useState } from 'react'
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

const NOMBRE_TIPO: Record<string, string> = {
  particular: 'Particular',
  camperizador: 'Camperizador',
  profesional: 'Profesional',
}

function fecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
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
  const [estado, setEstado] = useState<Estado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [portal, setPortal] = useState(false)
  const [prueba, setPrueba] = useState(false)
  const [reactivando, setReactivando] = useState(false)

  async function cargar() {
    try {
      const res = await fetch('/api/planes/estado', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'No se pudo cargar tu plan.')
        return
      }
      setEstado(data)
      setError('')
    } catch {
      setError('No se pudo cargar tu plan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function empezarPrueba() {
    setError('')
    setAviso('')
    setPrueba(true)
    try {
      const res = await fetch('/api/planes/prueba', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo empezar la prueba.')
        return
      }
      setAviso(
        data.reactivados > 0
          ? `Prueba activada. Hemos vuelto a publicar ${data.reactivados} anuncio${data.reactivados === 1 ? '' : 's'} que estaban pausados por cupo.`
          : `Prueba activada hasta el ${fecha(data.hasta)}. No se cobra nada automáticamente.`,
      )
      await cargar()
      onRefresh?.()
      window.dispatchEvent(new Event('plan-actualizado'))
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
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
        setError(data.error || 'No se pudieron reactivar los anuncios.')
        return
      }
      setAviso(
        data.reactivados > 0
          ? `Hemos vuelto a publicar ${data.reactivados} anuncio${data.reactivados === 1 ? '' : 's'}.${data.restantes > 0 ? ` Te quedan ${data.restantes} pausados: pasa a Profesional para recuperarlos.` : ''}`
          : 'No cabe ningún anuncio más con tu plan actual. Pausa otro o pasa a Profesional.',
      )
      await cargar()
      onRefresh?.()
      window.dispatchEvent(new Event('plan-actualizado'))
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setReactivando(false)
    }
  }

  async function abrirPortal() {
    setError('')
    setPortal(true)
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
      setPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Cargando tu plan…
      </div>
    )
  }

  if (!estado) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'No se pudo cargar tu plan.'}
      </div>
    )
  }

  const planNombre = etiquetaPlan(estado.planPagoVigente ? estado.planContratado : estado.plan)
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
      ? 'Activa Profesional y conserva tus 15 anuncios'
      : 'Hazte Profesional y publica hasta 15 a la vez'
    : ''

  return (
    <div className="space-y-5">
      {/* Plan actual */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary to-brand-dark text-white">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Tu plan</p>
              <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-black">
                {estado.trial ? 'Prueba Profesional' : estado.trialGracia ? 'Prueba Profesional · gracia' : planNombre}
                {estado.trial ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-200">
                    <Sparkles size={12} /> {estado.diasTrial} días
                  </span>
                ) : estado.trialGracia ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-200">
                    <Sparkles size={12} /> {estado.diasGracia} días de gracia
                  </span>
                ) : estado.pagoFallido ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-400/20 px-2.5 py-1 text-xs font-bold text-red-200">
                    <CreditCard size={12} /> Cobro pendiente
                  </span>
                ) : estado.planPagoVigente ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-bold text-emerald-200">
                    <BadgeCheck size={12} /> Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white/80">
                    Sin coste
                  </span>
                )}
              </h2>
              <p className="mt-2 max-w-lg text-sm text-white/75">
                {estado.trial
                  ? `Tienes el plan Profesional de prueba hasta el ${fecha(estado.trialHasta)}. No se cobra nada automáticamente; al terminar tendrás 7 días de gracia.`
                  : estado.trialGracia
                    ? `La prueba terminó el ${fecha(estado.trialHasta)}. Tienes hasta el ${fecha(estado.graciaHasta)} antes de que se pausen los anuncios que excedan el plan gratuito. No se borra nada.`
                    : estado.pagoFallido
                      ? `No hemos podido cobrar tu plan${estado.planHasta ? `, pero mantienes el acceso hasta el ${fecha(estado.planHasta)}` : ''}. Actualiza la tarjeta para no perder el cupo.`
                      : estado.planPagoVigente
                    ? estado.planHasta
                      ? estado.suscripcionStripe
                        ? `Se renueva el ${fecha(estado.planHasta)}. Puedes cancelar cuando quieras y mantenerlo hasta esa fecha.`
                        : `Plan activo hasta el ${fecha(estado.planHasta)} (regalo o cupón).`
                      : 'Plan activo. Sin permanencia.'
                    : 'Publicas 1 anuncio activo y tienes 10 fotos por anuncio. Sin comisión por venta.'}
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
                  Gestionar suscripción
                </button>
              )}
              <LocalLink
                href="/para-profesionales"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
              >
                {estado.trial || estado.trialGracia ? 'Activar Profesional' : esGratis ? 'Hacerme Profesional' : 'Ver Profesional'}
                <ArrowRight size={14} />
              </LocalLink>
            </div>
          </div>

          {estado.trial && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/70">
                <span>Prueba gratuita</span>
                <span>
                  {estado.diasTrial} de {estado.diasTrialTotal} días restantes
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
                <span>Periodo de gracia</span>
                <span>{estado.diasGracia} días restantes</span>
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
          <h3 className="text-base font-black text-red-900">No hemos podido cobrar tu plan</h3>
          <p className="mt-1 text-sm text-red-800">
            Tu tarjeta ha fallado{estado.pagoPendienteDesde ? ` desde el ${fecha(estado.pagoPendienteDesde)}` : ''}.
            Mantenemos tu plan y tus anuncios activos, pero actualiza el método de pago para que no se pause nada.
            {estado.planHasta ? ` El acceso está garantizado hasta el ${fecha(estado.planHasta)}.` : ''}
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
                Actualizar tarjeta
              </button>
            )}
            <LocalLink
              href="/para-profesionales"
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
            >
              Ver Profesional
            </LocalLink>
          </div>
        </section>
      )}

      {estado.trialGracia && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-black text-amber-900">
            Tu prueba terminó: te quedan {estado.diasGracia} días de gracia
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            El {fecha(estado.graciaHasta)} se pausarán los anuncios que excedan el cupo del plan gratuito.
            No se borra ninguno: podrás reactivarlos al pasar a Profesional o pausar otro para dejar sitio.
          </p>
          <LocalLink
            href="/para-profesionales"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
          >
            Activar Profesional <ArrowRight size={14} />
          </LocalLink>
        </section>
      )}

      {estado.trialElegible && (
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-base font-black text-emerald-900">Prueba Profesional 30 días, gratis</h3>
          <p className="mt-1 text-sm text-emerald-800">
            15 anuncios, 5 destacados al mes, escaparate y 20 fotos por anuncio. Sin tarjeta y sin cobro
            automático. Al terminar tienes 7 días de gracia y no se borra ningún anuncio.
            {estado.tipo === 'particular' && (
              <span className="mt-1 block text-xs text-emerald-700">
                Al empezar, tu cuenta pasa a «profesional» (la identidad es gratis) para que recibas
                el cupo de Profesional.
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
            Empezar prueba de 30 días
          </button>
        </section>
      )}

      {(estado.pausadosPorPlan || 0) > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-black text-slate-900">
            {estado.pausadosPorPlan} anuncio{estado.pausadosPorPlan === 1 ? '' : 's'} pausado{estado.pausadosPorPlan === 1 ? '' : 's'} por cupo
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Los pausamos al bajar el plan, pero no los borramos. Si ahora tienes hueco, puedes volver a
            publicarlos; si no, pasa a Profesional o pausa otro anuncio para dejar sitio.
          </p>
          <button
            type="button"
            onClick={reactivarPausados}
            disabled={reactivando}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {reactivando ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            Reactivar los que quepan
          </button>
        </section>
      )}

      {/* Consumo */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Tu capacidad ahora</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anuncios activos</span>
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
                ? 'Sin límite de anuncios activos.'
                : estado.cupo.restantes === 0
                  ? 'Cupo lleno. Pausa uno o pasa a Profesional.'
                  : `Te quedan ${estado.cupo.restantes} libres.`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fotos por anuncio</span>
              <Store size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{estado.cupo.fotosMax}</p>
            <p className="mt-2 text-xs text-slate-500">La ficha se ve más completa con todas las fotos.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destacados del mes</span>
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
              {estado.cupo.destacadosMes === 0 ? 'Tu plan no incluye destacados: usa créditos.' : 'Incluidos en tu plan, sin gastar créditos.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos</span>
              <TrendingUp size={16} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{estado.creditos}</p>
            <p className="mt-2 text-xs text-slate-500">Para subir al nº 1 o destacar fuera del plan.</p>
            <LocalLink href="/creditos" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-accent hover:underline">
              Comprar créditos <ArrowRight size={12} />
            </LocalLink>
          </div>
        </div>
      </section>

      {/* Upsell contextual */}
      {siguiente && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Siguiente paso</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{tituloSiguiente}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {siguiente.cupo == null
                  ? 'Para compraventas con rotación alta. 15 destacados al mes y 30 fotos por anuncio.'
                  : `${siguiente.cupo} anuncios activos, ${siguiente.destacadosMes} destacados al mes y ${siguiente.fotos} fotos por anuncio por ${formatPrecio(siguiente.precioMes)}/mes.`}
              </p>
            </div>
            <LocalLink
              href="/para-profesionales"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-accent-dark"
            >
              Ver Profesional <ArrowRight size={15} />
            </LocalLink>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-3">
            {siguiente.incluido.slice(0, 3).map(item => (
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
        <h3 className="font-bold text-slate-900">Tu tipo de vendedor no es tu plan</h3>
        <p className="mt-1 text-sm text-slate-600">
          Ahora apareces como <strong>{NOMBRE_TIPO[estado.tipo] || estado.tipo}</strong>. Eso es gratis y define
          tu sello y los filtros del catálogo. El plan solo cambia cuántos anuncios puedes tener
          publicados a la vez y qué extras incluyes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LocalLink href="/dashboard?tab=cuenta" className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Cambiar tipo de vendedor
          </LocalLink>
          <LocalLink href="/para-profesionales" className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Ver qué incluye Profesional
          </LocalLink>
        </div>
      </section>

      {esGratis && (
        <p className="text-center text-xs text-slate-500">
          Plan gratuito: {PLAN_GRATIS.incluido.join(' · ')}.
        </p>
      )}

    </div>
  )
}
