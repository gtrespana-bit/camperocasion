import type { Metadata } from 'next'
import { FileCheck2, ShieldAlert, ShieldCheck } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import { CHECKLIST_CAMPER, CHECKLIST_COMPRA_SEGURA, TASA_DGT } from '@/lib/itp'

const CANONICAL = 'https://camperocasion.es/compra-segura-camper'

export const metadata: Metadata = {
  title: 'Checklist de compra segura de una camper de segunda mano',
  description:
    'Qué documentos y comprobaciones hay que revisar antes de comprar una furgoneta camper o autocaravana de ocasión entre particulares: ficha técnica, ITV, reformas legalizadas, cargas en la DGT, contrato e ITP.',
  keywords: [
    'comprar camper de segunda mano entre particulares',
    'checklist compra camper',
    'documentación camper segunda mano',
    'reformas legalizadas furgoneta camper',
    'contrato compraventa camper',
  ],
  alternates: {
    canonical: CANONICAL,
    languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL },
  },
}

const PASOS_MODELO_620 = [
  'Firmar el contrato de compraventa con datos de las dos partes, precio, fecha, kilómetros y matrícula.',
  'Calcular la base imponible: el mayor entre el precio pactado y el valor de tablas de Hacienda depreciado.',
  'Presentar la autoliquidación (modelo 620, o 621 en algunas comunidades) en el plazo de tu comunidad.',
  'Pagar la tasa de la DGT y pedir la cita para el cambio de titularidad.',
  'Comunicar la venta a tu aseguradora y revisar el recibo del IVTM del año en curso.',
]

export default function CompraSeguraCamperPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Cómo comprar una camper de segunda mano entre particulares de forma segura',
    totalTime: 'P1D',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'EUR', value: TASA_DGT },
    step: PASOS_MODELO_620.map((paso, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: `Paso ${i + 1}`,
      text: paso,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: 'Compra segura', href: '/compra-segura-camper' }]} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          Checklist para comprar una camper de segunda mano sin sustos
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Comprar una camper entre particulares tiene un riesgo que no existe en un coche: la camperización. Una
          ventanilla sin legalizar, unas plazas que la ficha técnica no recoge o un techo elevable sin certificado
          convierten una buena compra en un problema en la siguiente ITV. Esta es la lista que revisamos nosotros y
          la que recomendamos seguir paso a paso.
        </p>

        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <h2 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
            <ShieldAlert size={18} aria-hidden="true" />
            Los tres fallos que se llevan la mayoría de las compras
          </h2>
          <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
            <li>Declarar vehículo vivienda (2448/3148) sin proyecto de homologación: no se puede circular ni dormir legalmente como tal.</li>
            <li>Reformas de gas, techo o asientos sin legalizar: la ITV las detecta y obliga a legalizarlas por tu cuenta.</li>
            <li>Liquidar el ITP sobre el precio pactado cuando el valor de tablas era mayor: liquidación con recargos.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Documentos y comprobaciones, uno a uno</h2>
          <ol className="space-y-3">
            {CHECKLIST_COMPRA_SEGURA.map((item, i) => (
              <li key={item.titulo} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary text-white text-sm font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold text-gray-900">{item.titulo}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.detalle}</p>
                  <p className="text-xs text-gray-500 mt-1.5">📄 {item.donde}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Específico de campers y autocaravanas</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {CHECKLIST_CAMPER.map(item => (
              <li key={item.titulo} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="font-bold text-gray-900 flex items-start gap-2">
                  <FileCheck2 size={16} className="mt-0.5 flex-shrink-0 text-brand-accent" aria-hidden="true" />
                  {item.titulo}
                </p>
                <p className="text-sm text-gray-600 mt-1">{item.detalle}</p>
                <p className="text-xs text-gray-500 mt-1.5">📄 {item.donde}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Los pasos de la operación, en orden</h2>
          <ol className="space-y-3">
            {PASOS_MODELO_620.map((paso, i) => (
              <li key={paso} className="flex gap-3 text-sm text-gray-700">
                <span className="font-black text-brand-primary">{i + 1}.</span>
                <span>{paso}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-brand-primary text-white rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-black mb-2 flex items-center gap-2">
            <ShieldCheck size={20} aria-hidden="true" />
            Cómo te ayudamos desde CamperOcasión
          </h2>
          <ul className="text-sm text-white/85 space-y-2 mb-5">
            <li>
              <strong>Expediente del vehículo:</strong> el vendedor sube la ficha técnica, la ITV y el proyecto de
              homologación, y nuestro equipo los revisa. Los anuncios que pasan la revisión muestran el sello de
              homologación verificada.
            </li>
            <li>
              <strong>Ficha técnica en el anuncio:</strong> homologación, MMA, plazas para viajar y dormir, medidas y
              autonomía, para descartar antes de desplazarte.
            </li>
            <li>
              <strong>Calculadora de ITP:</strong> estima el impuesto según tu comunidad y calcula el coste total con
              la tasa de la DGT.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <LocalLink href="/catalogo?verificada=1" className="bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition">
              Campers con homologación verificada
            </LocalLink>
            <LocalLink href="/calcular-itp" className="bg-white text-brand-primary text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              Calcular el ITP
            </LocalLink>
          </div>
        </section>

        <p className="mt-6 text-xs text-gray-500">
          Contenido informativo. No es asesoramiento legal ni fiscal: para una operación concreta, contrasta la
          documentación con la DGT y la hacienda de tu comunidad autónoma.
        </p>
      </div>
    </>
  )
}
