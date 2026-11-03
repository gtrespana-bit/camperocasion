'use client'

import LocalLink from '@/components/LocalLink'

import { useState, useEffect } from 'react'
import {
  CheckCircle, Zap, Star, X, Copy, Upload, Loader2, Banknote, Landmark, Wallet, CreditCard, ArrowRight
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import WorkHeader from '@/components/editorial/WorkHeader'
import { PAQUETES_CREDITO } from '@/lib/creditos'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'
import ModalPago, { type MetodoPago } from '@/components/creditos/ModalPago'

const paquetesCredito = PAQUETES_CREDITO

// Los datos bancarios llegan del servidor (/api/datos-pago).
let metodosPago: MetodoPago[] = [
  {
    id: 'bizum',
    nombre: 'Bizum',
    emoji: '📱',
    instrucciones: {},
  },
  {
    id: 'transferencia',
    nombre: 'Transferencia',
    emoji: '🏦',
    instrucciones: {},
  },
  {
    id: 'paypal',
    nombre: 'PayPal',
    emoji: '💙',
    instrucciones: {},
  },
]

export default function CreditosPage() {
  const t = useTranslations('creditos')
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<any>(null)
  // Métodos de pago con datos REALES del servidor. Si una variable de entorno
  // falta, ese método no se ofrece: antes la web mostraba un IBAN y un Bizum de
  // ejemplo (dineros a una cuenta inexistente) porque el endpoint rellenaba los
  // huecos con valores ficticios.
  const [metodos, setMetodos] = useState<MetodoPago[]>(metodosPago)
  const [configurado, setConfigurado] = useState<Record<string, boolean> | null>(null)
  // ¿Está el cobro automático activo? Lo pregunta al servidor para no tener que
  // exponer ninguna clave de Stripe en el bundle del navegador.
  const [stripeDisponible, setStripeDisponible] = useState(false)
  // Se lee de window y no con useSearchParams para no obligar a envolver toda
  // la página en un <Suspense> durante el prerender.
  const [resultadoPago, setResultadoPago] = useState<string | null>(null)

  useEffect(() => {
    setResultadoPago(new URLSearchParams(window.location.search).get('pago'))
    fetch('/api/stripe/estado')
      .then(r => r.json())
      .then(d => setStripeDisponible(Boolean(d?.disponible)))
      .catch(() => {})
  }, [])

  // Cargar datos de pago reales del servidor (IBAN, teléfono Bizum, PayPal…)
  useEffect(() => {
    fetch('/api/datos-pago')
      .then(r => r.json())
      .then(d => {
        const conDatos = metodosPago
          .map(m => (d?.[m.id] && typeof d[m.id] === 'object' ? { ...m, instrucciones: d[m.id] } : m))
          .filter(m => d?.configurado?.[m.id] !== false && Object.keys(m.instrucciones).length > 0)
        setMetodos(conDatos)
        setConfigurado(d?.configurado ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="work-space max-w-5xl mx-auto px-5 py-10 md:py-14">
      <WorkHeader
        eyebrow={t('eyebrow')}
        title={<>{t('title1')} <span className="text-leaf">{t('title2')}</span></>}
        description={t.rich('subtitle', { strong: (chunks) => <strong>{chunks}</strong> })}
      />

      {resultadoPago === 'ok' && (
        <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
          <CheckCircle size={22} className="text-brand-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-gray-900">{t('paymentReceived')}</p>
            <p className="text-sm text-gray-700">
              {t('paymentReceivedDesc')}
            </p>
          </div>
        </div>
      )}
      {resultadoPago === 'cancelado' && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-gray-900">{t('paymentCancelled')}</p>
          <p className="text-sm text-gray-700">{t('paymentCancelledDesc')}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('whatFor')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-50 text-brand-accent"><Zap size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('boostTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t.rich('boostDesc', { strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
                <span className="text-brand-primary font-bold text-2xl">{t('boostPrice')}</span>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-brand-primary"><Star size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('featureTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t.rich('featureDesc', { strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
                <div className="space-y-1 text-sm">
                  <p className="text-brand-primary font-bold">4 créditos → 12h</p>
                  <p className="text-brand-primary font-bold">6 créditos → 24h</p>
                  <p className="text-brand-primary font-bold">10 créditos → 48h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Puente plan <-> créditos: quien compra visibilidad varias veces al
          mes ahorra con el plan Profesional, que ya incluye destacados. */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-bold text-gray-900">{t('multipleCampersTitle')}</p>
          <p className="text-sm text-gray-600">
            {t('multipleCampersDesc')}
          </p>
        </div>
        <LocalLink
          href="/para-profesionales"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
        >
          {t('viewPlans')} <ArrowRight size={15} />
        </LocalLink>
      </div>

      {/* Paquetes */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">{t('choosePackage')}</h2>
        <p className="text-center text-sm text-gray-500 mb-4">{t('eurNote')}</p>

        <div className="creditos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {paquetesCredito.map((pkg) => {
            const porCredito = pkg.precio / pkg.creditos
            return (
              <div key={pkg.creditos} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${pkg.popular ? 'border-brand-accent' : 'border-transparent'}`}>
                {pkg.popular && <div className="bg-brand-accent text-white text-center py-1.5 text-xs font-bold">{t('mostPopular')}</div>}
                <div className="bg-gradient-to-br from-brand-primary to-brand-dark p-6 text-white text-center">
                  <p className="text-5xl font-black">{pkg.creditos}</p>
                  <p className="text-sm opacity-80">{t('credits')}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-black text-gray-800 mb-1">{formatPrecio(pkg.precio)}</p>
                  <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">{formatPrecio(porCredito)} {t('perCredit')}</p>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" /><strong>{pkg.creditos}</strong> {t('boosts')}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('orFeatured', { count: Math.floor(pkg.creditos / 4) })}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('noExpiration')}</li>
                  </ul>
                  <button onClick={() => setPaqueteSeleccionado(pkg)} className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition cursor-pointer">{t('buy')}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métodos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('paymentMethods')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { nombre: 'Bizum', emoji: '📱', Icono: Banknote },
            { nombre: 'Transferencia', emoji: '🏦', Icono: Landmark },
            { nombre: 'PayPal', emoji: '💙', Icono: Wallet },
          ].map((m) => (
            <div key={m.nombre} className="rounded-xl p-4 text-center bg-gray-50">
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <h3 className="font-bold text-brand-primary text-sm mb-2">{t('howItWorks')}</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>
        </div>
      </div>

      {paqueteSeleccionado && (
        <ModalPago
          paquete={paqueteSeleccionado}
          metodos={metodos}
          configurado={configurado}
          stripeDisponible={stripeDisponible}
          onClose={() => setPaqueteSeleccionado(null)}
        />
      )}
    </div>
  )
}
