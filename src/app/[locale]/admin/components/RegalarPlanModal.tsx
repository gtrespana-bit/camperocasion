'use client'

import { useEffect, useMemo, useState } from 'react'
import { Gift, RefreshCw, Sparkles } from 'lucide-react'
import { Button, Modal, Segmented, formatDate } from './AdminUi'
import { apiJson } from './admin-utils'
import {
  DIAS_REGALO_RAPIDOS,
  calcularRegaloPlan,
  diasRestantesDePlan,
  etiquetaPlan,
  type ModoRegalo,
  type PlanRegalable,
} from '@/lib/planes-regalo'

export interface UsuarioRegalable {
  id: string
  nombre?: string | null
  email?: string | null
  tipo_vendedor?: string | null
  plan_anuncios?: string | null
  plan_hasta?: string | null
}

const PACKS: { id: PlanRegalable; nombre: string; detalle: string; emoji: string }[] = [
  { id: 'starter', nombre: 'Starter', detalle: '5 anuncios · 3 destacados', emoji: '🚐' },
  { id: 'plus', nombre: 'Plus', detalle: '15 anuncios · 5 destacados', emoji: '⭐' },
  { id: 'unlimited', nombre: 'Unlimited', detalle: 'anuncios ilimitados', emoji: '💠' },
  { id: 'gratis', nombre: 'Sin pack', detalle: 'quitar el pack regalado', emoji: '↩️' },
]

/**
 * Modal para regalar días de pack a un usuario concreto.
 *
 * Es la pieza que faltaba: el admin ve en la propia previsualización hasta
 * cuándo queda activo el pack (`calcularRegaloPlan`, la misma función que usa
 * la API) y decide si los días se suman al final del periodo vigente o si
 * empiezan a contar ahora.
 */
export default function RegalarPlanModal({
  usuario,
  onClose,
  onDone,
  notify,
}: {
  usuario: UsuarioRegalable | null
  onClose: () => void
  onDone?: (mensaje: string) => void
  notify: (msg: string) => void
}) {
  const [plan, setPlan] = useState<PlanRegalable>('plus')
  const [dias, setDias] = useState(30)
  const [modo, setModo] = useState<ModoRegalo>('extender')
  const [motivo, setMotivo] = useState('')
  const [marcarProfesional, setMarcarProfesional] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setPlan('plus')
    setDias(30)
    setModo('extender')
    setMotivo('')
    setMarcarProfesional(usuario.tipo_vendedor === 'particular' || !usuario.tipo_vendedor)
  }, [usuario])

  const previsualizacion = useMemo(() => {
    if (!usuario) return null
    return calcularRegaloPlan({
      planActual: usuario.plan_anuncios,
      hastaActual: usuario.plan_hasta,
      plan,
      dias,
      modo,
    })
  }, [usuario, plan, dias, modo])

  const diasRestantes = usuario ? diasRestantesDePlan(usuario.plan_hasta) : null

  async function aplicar() {
    if (!usuario) return
    setBusy(true)
    try {
      const res = await apiJson<{ ok: boolean; resumen: string; emailEnviado: boolean; cambiaTipo: boolean }>(
        '/api/admin/regalar-plan',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: usuario.id,
            plan,
            dias,
            modo,
            motivo: motivo || null,
            marcarProfesional,
          }),
        },
      )
      const extra = [
        res.emailEnviado ? 'con email de aviso' : 'sin email (revisa el canal)',
        res.cambiaTipo ? 'cuenta marcada como profesional' : null,
      ]
        .filter(Boolean)
        .join(' · ')
      notify(`✅ ${res.resumen}${extra ? ` · ${extra}` : ''}`)
      onDone?.(res.resumen)
      onClose()
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setBusy(false)
  }

  if (!usuario) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Gift size={17} className="text-brand-primary" /> Regalar pack
        </span>
      }
      subtitle={`${usuario.nombre || 'Usuario'}${usuario.email ? ` · ${usuario.email}` : ''}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={plan === 'gratis' ? 'danger' : 'primary'}
            onClick={aplicar}
            disabled={busy || (plan !== 'gratis' && dias < 1)}
          >
            {busy ? <RefreshCw className="animate-spin" size={14} /> : <Gift size={14} />}
            {plan === 'gratis' ? 'Quitar pack' : `Regalar ${dias} días de ${etiquetaPlan(plan)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Ahora mismo:</span>
          <span>
            {etiquetaPlan(usuario.plan_anuncios)}
            {diasRestantes ? ` · quedan ${diasRestantes} días (hasta ${formatDate(usuario.plan_hasta)})` : ''}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-gray-500">
            {usuario.tipo_vendedor === 'camperizador' ? 'Camperizador' : usuario.tipo_vendedor === 'profesional' ? 'Profesional' : 'Particular'}
          </span>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Pack</label>
          <div className="grid grid-cols-2 gap-2">
            {PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  plan === p.id
                    ? p.id === 'gratis'
                      ? 'border-red-300 bg-red-50'
                      : 'border-brand-primary bg-brand-primary/5'
                    : 'border-gray-200 hover:border-brand-primary/40 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <span>{p.emoji}</span> {p.nombre}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500">{p.detalle}</span>
              </button>
            ))}
          </div>
        </div>

        {plan !== 'gratis' && (
          <>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Días</label>
              <div className="flex flex-wrap items-center gap-2">
                {DIAS_REGALO_RAPIDOS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDias(d)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      dias === d ? 'border-brand-primary bg-brand-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={dias}
                  onChange={(e) => setDias(Math.max(1, Math.min(3650, Number(e.target.value) || 0)))}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Entre 1 y 3650 días (10 años).</p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">¿Desde cuándo cuenta?</label>
              <Segmented
                items={[
                  { id: 'extender' as const, label: '➕ Sumar al final' },
                  { id: 'reemplazar' as const, label: '🔄 Empezar ahora' },
                ]}
                value={modo}
                onChange={setModo}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                {modo === 'extender'
                  ? 'Si ya tiene el mismo pack activo, los días se añaden al final; si no, empiezan ahora.'
                  : 'Los días empiezan a contar ahora, aunque tuviera pack pendiente.'}
              </p>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Motivo (interno)</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: acuerdo de colaboración, compensación por incidencia…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        {plan !== 'gratis' && (
          <label className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={marcarProfesional}
              onChange={(e) => setMarcarProfesional(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Marcar la cuenta como <strong>profesional</strong> si ahora es particular. Un particular tiene 1 anuncio
              activo aunque se le regale un pack: sin este cambio, los 5/15/ilimitados no sirven de nada.
            </span>
          </label>
        )}

        {previsualizacion && (
          <div className="flex items-start gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
            <Sparkles size={16} className="mt-0.5 text-brand-primary" />
            <div className="text-sm text-gray-700">
              <p className="font-bold text-gray-900">
                {previsualizacion.plan === 'gratis'
                  ? 'La cuenta vuelve al plan gratuito'
                  : `${etiquetaPlan(previsualizacion.plan)} hasta el ${previsualizacion.planHasta?.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {previsualizacion.extendido
                  ? `Se suman ${dias} días al final del pack que ya tenía.`
                  : plan === 'gratis'
                    ? 'Se borra la fecha de fin del pack.'
                    : `Empieza a contar ahora (${dias} días).`}
                {previsualizacion.plan !== 'gratis' ? ' Sin cargos ni Stripe: es un regalo.' : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
