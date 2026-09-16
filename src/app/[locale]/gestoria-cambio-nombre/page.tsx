import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CheckCircle2, FileSignature } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import FormularioGestoria from './FormularioGestoria'
import { GESTORIA_PRECIO_MAX, GESTORIA_PRECIO_MIN } from '@/lib/gestoria'

/**
 * Gestoría del cambio de nombre DGT (plan de confianza §4.2, fase captación).
 *
 * El servicio se tramita con gestoría partner y el equipo contacta a mano: la
 * página captura el lead y explica con claridad qué incluye y qué NO (nada de
 * "paga aquí": el cobro lo hace la gestoría al confirmar el presupuesto).
 */

const CANONICAL = 'https://camperocasion.online/gestoria-cambio-nombre'

export const metadata: Metadata = {
  title: `Gestoría del cambio de nombre DGT para tu camper (${GESTORIA_PRECIO_MIN}-${GESTORIA_PRECIO_MAX} €)`,
  description:
    'Tramitamos por ti el cambio de titularidad de tu furgoneta camper o autocaravana: documentación, ITP (modelo 620), tasas de la DGT y notificación de venta. Déjanos tus datos y te contactamos con presupuesto cerrado.',
  keywords: [
    'gestoría cambio de nombre camper',
    'cambio de titularidad autocaravana DGT',
    'gestión modelo 620 camper',
    'trámite compraventa furgoneta camperizada',
  ],
  alternates: {
    canonical: CANONICAL,
    languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL },
  },
}

const INCLUYE = [
  'Revisión de la documentación del vehículo (ficha técnica, ITV, cargas) antes de arrancar.',
  'Autoliquidación del ITP (modelo 620/621) de tu comunidad, con la base bien calculada.',
  'Cambio de titularidad en la DGT: tasas, cita previa y presentación.',
  'Notificación de venta para el vendedor (deja de responder de multas y tasas).',
  'Un interlocutor único por teléfono o WhatsApp mientras dura el trámite.',
]

const FAQ = [
  {
    q: '¿Cuánto cuesta el cambio de nombre de una camper?',
    a: `La gestoría cobra entre ${GESTORIA_PRECIO_MIN} y ${GESTORIA_PRECIO_MAX} € por la gestión completa, más las tasas oficiales de la DGT y el ITP, que dependen de la comunidad y del vehículo. Al contactarte te damos el presupuesto cerrado antes de tramitar nada.`,
  },
  {
    q: '¿Quién paga el ITP de una camper de segunda mano?',
    a: 'El comprador. Se liquida antes del cambio de titularidad (modelo 620) y su tipo va del 3 % al 8 % según la comunidad. Puedes estimarlo exactamente con nuestra calculadora de ITP.',
  },
  {
    q: 'Soy el vendedor, ¿tengo que hacer algo?',
    a: 'Sí: presentar la notificación de venta en la DGT (o delegarla en la gestoría) para no responder de multas, tasas o del Vehicle a partir de la entrega. Con el contrato firmado y esa notificación, quedas cubierto.',
  },
  {
    q: '¿En cuánto tiempo queda hecho?',
    a: 'Con la documentación completa, el trámite suele quedar en 1-2 semanas: ITP primero (telemático en la mayoría de comunidades) y cambio de titularidad después.',
  },
]

export default function GestoriaCambioNombrePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Gestoría del cambio de nombre DGT para campers',
    areaServed: 'ES',
    provider: { '@type': 'Organization', name: 'CamperOcasión' },
    description: metadata.description as string,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: 'Gestoría del cambio de nombre', href: '/gestoria-cambio-nombre' }]} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <FileSignature size={22} aria-hidden="true" />
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">
            Cambio de nombre de tu camper, tramitado por gestoría
          </h1>
        </div>
        <p className="text-lg text-gray-600 mb-2">
          Compraste (o vas a comprar) una camper de segunda mano: nos ocupamos del papeleo para
          que solo tengas que disfrutarla. ITP, tasas de la DGT, cambio de titularidad y
          notificación de venta, todo con un único contacto.
        </p>
        <p className="text-sm font-semibold text-brand-primary mb-8">
          Gestión completa: {GESTORIA_PRECIO_MIN}–{GESTORIA_PRECIO_MAX} € (más tasas oficiales e ITP) · Presupuesto cerrado antes de empezar
        </p>

        <div className="grid md:grid-cols-[1fr_360px] gap-6 items-start">
          <div>
            <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
              <h2 className="text-lg font-black text-gray-900 mb-3">Qué incluye</h2>
              <ul className="space-y-2">
                {INCLUYE.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={16} className="text-brand-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                    {i}
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
              <h2 className="text-lg font-black text-gray-900 mb-3">Preguntas frecuentes</h2>
              <dl className="space-y-3 text-sm text-gray-600">
                {FAQ.map((f) => (
                  <div key={f.q}>
                    <dt className="font-bold text-gray-800">{f.q}</dt>
                    <dd className="mt-0.5">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="text-xs text-gray-500">
              ¿Todavía no cerraste la compra? Revisa el{' '}
              <LocalLink href="/compra-segura-camper" className="text-brand-primary font-semibold hover:underline">
                checklist de compra segura
              </LocalLink>{' '}
              y prepara el{' '}
              <LocalLink href="/contrato-compraventa" className="text-brand-primary font-semibold hover:underline">
                contrato de compraventa
              </LocalLink>{' '}
              con los datos del anuncio.
            </p>
          </div>

          {/* Formulario de contacto (isla cliente; Suspense por useSearchParams) */}
          <div className="md:sticky md:top-4">
            <Suspense fallback={<div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-500">Cargando el formulario…</div>}>
              <FormularioGestoria />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
