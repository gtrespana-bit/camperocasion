import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FileSignature, Calculator, ShieldCheck } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import ContratoClient from './ContratoClient'
import { RECUERDOS_POSTFIRMA } from '@/lib/contrato'

/**
 * Generador de contrato de compraventa de camper (plan de confianza §4.2).
 *
 * 100% software, sin partner y sin base de datos: es la utilidad que cierra la
 * operación (el comprador que ya vio el vehículo necesita un contrato decente
 * ese mismo día) y una página de captación SEO («contrato compraventa camper»).
 * Los datos de las partes NO se envían a ningún servidor: el navegador los
 * compone en el documento y se imprime/guarda como PDF.
 */

const CANONICAL = 'https://camperocasion.online/contrato-compraventa'

export const metadata: Metadata = {
  title: 'Contrato de compraventa de furgoneta camper — modelo gratuito',
  description:
    'Modelo de contrato de compraventa entre particulares para furgonetas camper y autocaravanas de ocasión: cláusulas completas, precio, estado del vehículo y cambios de titularidad. Se rellena con los datos del anuncio y se descarga en PDF.',
  keywords: [
    'contrato compraventa camper',
    'modelo contrato compraventa autocaravana',
    'contrato compraventa vehículo usado entre particulares',
    'contrato de venta furgoneta camperizada pdf',
  ],
  alternates: {
    canonical: CANONICAL,
    languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL },
  },
}

export default function ContratoCompraventaPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Generador de contrato de compraventa de camper',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description: metadata.description as string,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: 'Contrato de compraventa', href: '/contrato-compraventa' }]} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <FileSignature size={22} aria-hidden="true" />
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">
            Contrato de compraventa de camper
          </h1>
        </div>
        <p className="text-lg text-gray-600 mb-8">
          Rellena los datos de las partes y del vehículo, imprime el contrato en dos ejemplares y
          firmadlo el día de la entrega. Si llegas desde un anuncio de CamperOcasión, los datos del
          vehículo van precargados. <strong>Nada se guarda en ningún servidor</strong>: el
          documento se genera en tu navegador.
        </p>

        <Suspense
          fallback={
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-500 text-sm">
              Cargando el generador…
            </div>
          }
        >
          <ContratoClient />
        </Suspense>

        {/* Después de firmar: los dos trámites que casi nadie hace a tiempo. */}
        <section className="mt-10">
          <h2 className="text-xl font-black text-gray-900 mb-4">Después de firmar</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {RECUERDOS_POSTFIRMA.map((r) => (
              <div key={r.titulo} className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-900 mb-1">{r.titulo}</p>
                <p className="text-xs text-gray-600 mb-2">{r.texto}</p>
                {r.enlace && (
                  <LocalLink
                    href={r.enlace}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline"
                  >
                    {r.enlace.startsWith('/gestoria') ? 'Tramitar con gestoría' : 'Calcular importe'}
                  </LocalLink>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-5">
          <h2 className="text-base font-black text-gray-900 mb-2">Preguntas frecuentes</h2>
          <dl className="space-y-3 text-sm text-gray-600">
            <div>
              <dt className="font-bold text-gray-800">¿Este contrato sirve para el cambio de nombre en la DGT?</dt>
              <dd>
                Sí como justificante de la compraventa entre particulares: es el documento que
                acompaña a la notificación de venta y al modelo 620 del ITP. La Jefatura de Tráfico
                no registra el contrato, pero te protege frente a multas y tasas anteriores a la
                entrega.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">¿Y si la camper tiene reformas homologadas?</dt>
              <dd>
                Antes de firmar, comprueba que la ficha técnica recoge la configuración de
                habitáculo (2448/3148 si es vivienda) y pide los certificados de las reformas. En
                CamperOcasión puedes filtrar por{' '}
                <LocalLink href="/catalogo?verificada=1" className="text-brand-primary font-semibold hover:underline">
                  homologación verificada
                </LocalLink>
                .
              </dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">¿Quién paga el ITP y el cambio de nombre?</dt>
              <dd>
                El comprador: el ITP (modelo 620, varía por comunidad) y las tasas de la DGT. El
                vendedor debe presentar la notificación de venta para no responder de multas
                posteriores.{' '}
                <LocalLink href="/calcular-itp" className="text-brand-primary font-semibold hover:underline">
                  Calcula tu ITP
                </LocalLink>{' '}
                u{' '}
                <LocalLink href="/gestoria-cambio-nombre" className="text-brand-primary font-semibold hover:underline">
                  déjalo en manos de la gestoría
                </LocalLink>
                .
              </dd>
            </div>
          </dl>
        </section>

        <div className="grid md:grid-cols-2 gap-3 mt-8">
          <LocalLink
            href="/calcular-itp"
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-brand-accent transition"
          >
            <Calculator size={18} className="text-brand-accent-dark" aria-hidden="true" />
            <span className="text-sm font-bold text-gray-900">Calcular el ITP de esta venta</span>
          </LocalLink>
          <LocalLink
            href="/gestoria-cambio-nombre"
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-brand-primary transition"
          >
            <ShieldCheck size={18} className="text-brand-primary" aria-hidden="true" />
            <span className="text-sm font-bold text-gray-900">Tramitar el cambio de nombre con gestoría</span>
          </LocalLink>
        </div>
      </div>
    </>
  )
}
