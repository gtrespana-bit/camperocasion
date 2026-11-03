import PublicHero from '@/components/editorial/PublicHero'
import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import CalculadoraITP from './CalculadoraITP'
import { CALCULADORA_FAQ, SECCIONES_CALCULADORA } from './contenido'
import { CALCULADORA_FAQ_EN, SECCIONES_CALCULADORA_EN, plazoITPEn } from './contenido-en'
import { TIPOS_ITP, REVISADO_EN } from '@/lib/itp'

const CANONICAL = 'https://camperocasion.online/calcular-itp'

const metadataEs: Metadata = {
  title: 'Calculadora de ITP para campers',
  description:
    'Calcula el ITP de tu camper o autocaravana de ocasión por comunidad autónoma, con cuota fija, depreciación y coste del cambio de nombre.',
  keywords: [
    'calculadora ITP camper',
    'impuesto comprar autocaravana segunda mano',
    'ITP vehículo vivienda',
    'modelo 620 camper',
    'cuánto se paga de ITP por una furgoneta camper',
    'ITP por comunidad autónoma',
  ],
  alternates: {
    canonical: CANONICAL,
    languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL },
  },
  openGraph: {
    title: 'Calculadora de ITP para campers',
    description:
      'Calcula lo que pagarás de ITP por tu camper según tu comunidad autónoma y revisa la documentación antes de firmar.',
    type: 'website',
    locale: 'es_ES',
    url: CANONICAL,
    images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: 'Calculadora de ITP — CamperOcasión' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculadora de ITP para campers',
    description: 'Calcula el ITP de tu camper por comunidad autónoma, con depreciación y coste del cambio de nombre.',
    images: ['https://camperocasion.online/api/og/catalog?categoria=camper'],
  },
}

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ precio?: string; ccaa?: string }>
}

export async function generateMetadata({ params }: { params: PageProps['params'] }): Promise<Metadata> {
  const { locale } = await params
  if (locale !== 'en') return metadataEs
  const title = 'Campervan transfer tax (ITP) calculator in Spain'
  const description = 'Estimate ITP when buying a used campervan from a private seller in Spain. Compare regional rates, depreciation and vehicle transfer costs.'
  const canonical = 'https://camperocasion.online/en/calcular-itp'
  return {
    title, description,
    alternates: { canonical, languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL } },
    robots: { index: false, follow: true },
    openGraph: { title, description, type: 'website', locale: 'en_US', url: canonical,
      images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: ['https://camperocasion.online/api/og/catalog?categoria=camper'] },
  }
}


export default async function CalcularITPPage({ params, searchParams }: PageProps) {
  const [{ locale }, { precio, ccaa }] = await Promise.all([params, searchParams])
  const english = locale === 'en'
  const secciones = english ? SECCIONES_CALCULADORA_EN : SECCIONES_CALCULADORA
  const faq = english ? CALCULADORA_FAQ_EN : CALCULADORA_FAQ
  const copy = english ? {
    home: 'Home', breadcrumb: 'ITP calculator', eyebrow: 'CamperOcasión · Tools',
    title: 'ITP transfer tax calculator for used campervans in Spain',
    description: 'The buyer pays ITP (property transfer tax) when buying from a private individual. Rates and special rules vary by autonomous community. Use this estimate and confirm the details before signing.',
    regionsTitle: 'ITP by autonomous community',
    regionsDesc: `Rates last reviewed in ${REVISADO_EN}. Check each community’s official tax website before paying.`,
    general: 'general rate', moreHp: 'over 15 fiscal hp', moreCc: 'over 2,000 cc',
    flatFrom: 'flat fee from', exemptFrom: 'exempt from', years: 'years',
    deadline: 'Deadline', businessDays: 'business days', days: 'days', form: 'Form',
    faqTitle: 'Frequently asked questions about campervan ITP',
    checkTitle: 'Before you pay, check the campervan’s documentation',
    checkDesc: 'ITP is only one part of the purchase. Check that the vehicle registration and technical documents match what the listing promises. Review the safe-buying checklist and listings with documents checked by our team.',
    checklist: 'Safe-buying checklist', verified: 'Campers with verified homologation',
    paperwork: 'Need help with tax and the ownership transfer? Use our administration service',
  } : {
    home: 'Inicio', breadcrumb: 'Calculadora de ITP', eyebrow: 'CamperOcasión · Herramientas',
    title: 'Calculadora de ITP para comprar una camper de segunda mano',
    description: 'El Impuesto sobre Transmisiones Patrimoniales lo paga el comprador cuando compra a un particular. Cambia según la comunidad autónoma: aquí puedes calcular una estimación y consultar el desglose antes de firmar.',
    regionsTitle: 'ITP por comunidad autónoma',
    regionsDesc: `Tipos revisados en ${REVISADO_EN} y enlaces a la sede tributaria de cada comunidad para verificarlos.`,
    general: 'general', moreHp: 'para más de 15 CV fiscales', moreCc: 'para más de 2.000 cc',
    flatFrom: 'cuota fija desde', exemptFrom: 'exento desde', years: 'años',
    deadline: 'Plazo', businessDays: 'días hábiles', days: 'días', form: 'Modelo',
    faqTitle: 'Preguntas frecuentes sobre el ITP de una camper',
    checkTitle: 'Antes de pagar, comprueba que la camper es lo que dice ser',
    checkDesc: 'El ITP es solo una parte del coste: la otra es comprar un vehículo que en la ficha técnica ponga lo que el anuncio promete. Revisa el checklist de compra segura y busca anuncios con la documentación del vehículo ya revisada por nuestro equipo.',
    checklist: 'Checklist de compra segura', verified: 'Campers con homologación verificada',
    paperwork: '¿No quieres papeleos? Tramita el ITP y el cambio de nombre con gestoría',
  }
  // Un anuncio concreto puede enlazar aquí con su precio (y su provincia) ya
  // puestos, para que la calculadora sea útil en un clic.
  const precioInicial = Number(String(precio || '').replace(/[^\d.]/g, '')) || undefined
  const ccaaInicial = ccaa && TIPOS_ITP.some(c => c.slug === ccaa) ? ccaa : undefined

  const SITIO = 'https://camperocasion.online'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: copy.home, item: SITIO + (english ? '/en' : '/') },
      { '@type': 'ListItem', position: 2, name: copy.breadcrumb, item: SITIO + (english ? '/en' : '') + '/calcular-itp' },
    ],
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd,
      {
        '@type': 'FAQPage',
        '@id': SITIO + (english ? '/en' : '') + '/calcular-itp#faq',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.pregunta,
          acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Breadcrumbs items={[{ label: copy.breadcrumb, href: '/calcular-itp' }]} />

      <div className="public-page min-h-screen">
        <PublicHero compact eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 lg:py-16">
        <Suspense fallback={<div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />}>
          <CalculadoraITP ccaaInicial={ccaaInicial} precioInicial={precioInicial} />
        </Suspense>

        {/* ── Contenido de apoyo (SEO + utilidad real) ─────────────── */}
        <section className="mt-12 grid md:grid-cols-3 gap-6">
          {secciones.map(seccion => (
            <article key={seccion.titulo} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-2">{seccion.titulo}</h2>
              {seccion.parrafos.map(p => <p key={p} className="text-sm text-gray-600 mb-2">{p}</p>)}
              {seccion.puntos && (
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  {seccion.puntos.map(punto => <li key={punto}>{punto}</li>)}
                </ul>
              )}
            </article>
          ))}
        </section>

        {/* ── Tipos por comunidad: enlaces a las landings ──────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-gray-900 mb-2">{copy.regionsTitle}</h2>
          <p className="text-gray-600 mb-5">
            {copy.regionsDesc}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TIPOS_ITP.map(c => (
              <LocalLink
                key={c.slug}
                href={`/calcular-itp/${c.slug}`}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-brand-accent hover:shadow-md transition"
              >
                <p className="font-bold text-gray-900 group-hover:text-brand-primary">{c.nombre}</p>
                <p className="text-sm text-gray-600">
                  {c.tipo} % {copy.general}
                  {c.tipoIncrementado && ` · ${c.tipoIncrementado.tipo} % ${c.tipoIncrementado.masDeCVFiscales ? copy.moreHp : copy.moreCc}`}
                  {c.cuotaFija && ` · ${copy.flatFrom} ${c.cuotaFija.minAnios} ${copy.years}`}
                  {c.exencionPorAntiguedad && ` · ${copy.exemptFrom} ${c.exencionPorAntiguedad.minAnios} ${copy.years}`}
                </p>
                <p className="text-xs text-gray-500 mt-1.5">
                  {copy.deadline}: {english ? plazoITPEn(c) : `${c.plazoDias} ${c.plazoDiasHabiles ? copy.businessDays : copy.days}`} · {copy.form} {c.modelo}
                </p>
              </LocalLink>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-gray-900 mb-5">{copy.faqTitle}</h2>
          <div className="space-y-3">
            {faq.map(faq => (
              <details key={faq.pregunta} className="bg-white rounded-xl border border-gray-100 shadow-sm group">
                <summary className="font-bold text-gray-800 px-5 py-4 cursor-pointer list-none marker:content-['▶'] hover:text-brand-primary">
                  {faq.pregunta}
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600">{faq.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 bg-brand-primary text-white rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-black mb-2">{copy.checkTitle}</h2>
          <p className="text-white/80 text-sm mb-4 max-w-2xl">
            {copy.checkDesc}
          </p>
          <div className="flex flex-wrap gap-3">
            <LocalLink href="/compra-segura-camper" className="bg-white text-brand-primary text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              {copy.checklist}
            </LocalLink>
            <LocalLink href="/catalogo?verificada=1" className="bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition">
              {copy.verified}
            </LocalLink>
            <LocalLink href="/gestoria-cambio-nombre" className="bg-white/10 text-white border border-white/30 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-white/20 transition">
              {copy.paperwork}
            </LocalLink>
          </div>
        </section>
        </div>
      </div>
    </>
  )
}
