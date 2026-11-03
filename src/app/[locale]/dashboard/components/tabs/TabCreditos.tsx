'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle, CreditCard } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import ModalPago, { type MetodoPago } from '@/components/creditos/ModalPago'
import { PAQUETES_CREDITO } from '@/lib/creditos'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'

const PAYMENT_METHODS: MetodoPago[] = [
  { id: 'bizum', nombre: 'Bizum', emoji: '📱', instrucciones: {} },
  { id: 'transferencia', nombre: 'Transferencia', emoji: '🏦', instrucciones: {} },
  { id: 'paypal', nombre: 'PayPal', emoji: '💙', instrucciones: {} },
]

export default function TabCreditos({ creditos, refreshCreditos }: { creditos: number; refreshCreditos: () => void }) {
  const t = useTranslations('creditos')
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<(typeof PAQUETES_CREDITO)[number] | null>(null)
  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [configurado, setConfigurado] = useState<Record<string, boolean> | null>(null)
  const [stripeDisponible, setStripeDisponible] = useState(false)

  useEffect(() => {
    fetch('/api/stripe/estado')
      .then(r => r.json())
      .then(d => setStripeDisponible(Boolean(d?.disponible)))
      .catch(() => {})
    fetch('/api/datos-pago')
      .then(r => r.json())
      .then(d => {
        // Do not offer manual payment options without real server-side account details.
        setMetodos(PAYMENT_METHODS
          .map(m => ({ ...m, instrucciones: d?.[m.id] && typeof d[m.id] === 'object' ? d[m.id] : {} }))
          .filter(m => d?.configurado?.[m.id] !== false && Object.keys(m.instrucciones).length > 0))
        setConfigurado(d?.configurado ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-brand-primary to-brand-dark p-6 text-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-80">{t('currentBalance')}</p>
          <p className="text-4xl font-black">{creditos} {t('credits')}</p>
        </div>
        <CreditCard size={40} aria-hidden="true" className="opacity-50 shrink-0" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="font-bold text-lg text-brand-primary mb-4">{t('whatFor')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2">{t('boostTitle')}</p>
            <p className="text-sm text-gray-700 mt-1">{t.rich('boostDesc', { strong: chunks => <strong>{chunks}</strong> })}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2">{t('featureTitle')}</p>
            <p className="text-sm text-gray-700 mt-1">{t.rich('featureDesc', { strong: chunks => <strong>{chunks}</strong> })}</p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-bold text-gray-900">{t('multipleCampersTitle')}</p>
          <p className="text-sm text-gray-600">{t('multipleCampersDesc')}</p>
        </div>
        <LocalLink href="/para-profesionales" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
          {t('viewPlans')} <ArrowRight size={15} aria-hidden="true" />
        </LocalLink>
      </div>

      <section aria-labelledby="dashboard-credit-packages">
        <h3 id="dashboard-credit-packages" className="text-xl font-bold text-brand-primary text-center mb-4">{t('choosePackage')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAQUETES_CREDITO.map(pkg => (
            <div key={pkg.creditos} className={`rounded-2xl overflow-hidden border-2 bg-white transition hover:-translate-y-1 ${pkg.popular ? 'border-brand-accent' : 'border-slate-200'}`}>
              {pkg.popular && <div className="bg-brand-accent text-white text-center py-1.5 text-xs font-bold">{t('mostPopular')}</div>}
              <div className="bg-gradient-to-br from-brand-primary to-brand-dark p-6 text-white text-center">
                <p className="text-5xl font-black">{pkg.creditos}</p>
                <p className="text-sm opacity-80">{t('credits')}</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-3xl font-black text-gray-800 mb-1">{formatPrecio(pkg.precio)}</p>
                <p className="text-xs text-gray-600 mb-5">{formatPrecio(pkg.precio / pkg.creditos)} {t('perCredit')}</p>
                <ul className="text-sm text-gray-700 space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2"><CheckCircle size={14} aria-hidden="true" className="text-green-600 shrink-0" /><strong>{pkg.creditos}</strong> {t('boosts')}</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} aria-hidden="true" className="text-green-600 shrink-0" />{t('orFeatured', { count: Math.floor(pkg.creditos / 4) })}</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} aria-hidden="true" className="text-green-600 shrink-0" />{t('noExpiration')}</li>
                </ul>
                <button type="button" onClick={() => setPaqueteSeleccionado(pkg)} aria-haspopup="dialog" className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition">{t('buy')}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-lg mb-4 text-center">{t('paymentMethods')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {metodos.map(m => (
            <div key={m.id} className="rounded-xl p-4 text-center bg-slate-50">
              <span className="text-3xl block mb-2" aria-hidden="true">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
          {stripeDisponible && <div className="rounded-xl p-4 text-center bg-slate-50">
            <CreditCard size={30} className="mx-auto mb-2 text-brand-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-800">{t('cardPayment')}</p>
          </div>}
        </div>
        {!stripeDisponible && metodos.length === 0 && configurado && <p className="text-sm text-gray-600 text-center">{t('paymentUnavailable')} <LocalLink href="/contacto" className="underline">{t('contactUs')}</LocalLink>.</p>}
      </section>

      {paqueteSeleccionado && <ModalPago
        paquete={paqueteSeleccionado}
        metodos={metodos}
        configurado={configurado}
        stripeDisponible={stripeDisponible}
        onClose={() => setPaqueteSeleccionado(null)}
        onCompraExitosa={refreshCreditos}
      />}
    </div>
  )
}
