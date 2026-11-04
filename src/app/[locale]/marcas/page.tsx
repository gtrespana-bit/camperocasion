import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { ChevronRight, Factory, ArrowRight } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { faqsEn } from './faqs-en'
import {
  MARCAS_MODELOS,
  agruparPorFabricante,
  etiquetaModelo,
  slugModelo,
  type MarcaModelo,
  type SubSlug,
} from '@/lib/marcas'

const SITIO = 'https://camperocasion.online'

const metadataEs: Metadata = {
  title: 'Marcas de campers y autocaravanas',
  description:
    'Marcas y modelos de furgonetas camper y autocaravanas: Fiat, Volkswagen, Mercedes, Benimar, Hymer y Adria. Encuentra tu camper de ocasión.',
  keywords: [
    'marcas de campers',
    'marcas de autocaravanas',
    'modelos furgonetas camper',
    'Fiat Ducato camper',
    'Volkswagen California',
    'Benimar autocaravana',
    'Hymer autocaravana',
    'marcas caravanas',
  ],
  alternates: {
    canonical: `${SITIO}/marcas`,
    languages: {
      'es-ES': `${SITIO}/marcas`,
      'x-default': `${SITIO}/marcas`,
    },
  },
  openGraph: {
    title: 'Marcas y modelos de campers y autocaravanas',
    description:
      'Catálogo completo de fabricantes y modelos camper organizado por marca y tipo de vehículo: gran volumen, camper mediana, minicamper, perfiladas, capuchinas, integrales y 4x4.',
    url: `${SITIO}/marcas`,
    siteName: 'CamperOcasión',
    locale: 'es_ES',
    type: 'website',
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (locale !== 'en') return metadataEs
  const title = 'Campervan and motorhome brands and models'
  const description = 'Browse campervan and motorhome brands in Spain. Explore suitable vehicle types, active listings and model market prices.'
  const canonical = `${SITIO}/en/marcas`
  return {
    title, description,
    robots: { index: false, follow: true },
    alternates: { canonical, languages: { 'es-ES': `${SITIO}/marcas`, 'x-default': `${SITIO}/marcas` } },
    openGraph: { title, description, url: canonical, siteName: 'CamperOcasión', locale: 'en_US', type: 'website' },
  }
}

function hrefCatalogo(subLabel: string, valor?: string): string {
  const params = new URLSearchParams({ subcategoria: subLabel })
  if (valor) params.set('marca', valor)
  return `/catalogo?${params.toString()}`
}

/** Insignias de los tipos para los que un modelo es apto. */
function AptasBadges({ m, subActual, labels }: { m: MarcaModelo; subActual: SubSlug; labels: Record<string, string> }) {
  const otras = m.aptoPara.filter(s => s !== subActual)
  if (otras.length === 0) return null
  const subs = categoriasData.camper.subs
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {otras.map(slug => {
        const sub = subs.find(s => s.slug === slug)
        if (!sub) return null
        return (
          <span
            key={slug}
            title={labels[slug] || sub.label}
            className="text-[10px] bg-green-50 text-brand-primary border border-green-200 rounded-full px-1.5 py-0.5 font-semibold whitespace-nowrap"
          >
            {sub.icon} {labels[slug] || sub.label}
          </span>
        )
      })}
    </span>
  )
}

export default async function MarcasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'marcasPage' })
  const tf = await getTranslations({ locale, namespace: 'familias' })
  const tc = await getTranslations({ locale, namespace: 'catalog' })
  const english = locale === 'en'

  const fabricantes = agruparPorFabricante(MARCAS_MODELOS)
  const subs = categoriasData.camper.subs
  const subLabels: Record<string, string> = Object.fromEntries(subs.map(sub => [
    sub.slug, english ? tc(`subcategories.${sub.label}`) : sub.label,
  ]))

  const SITIO = 'https://camperocasion.online'
  const canonical = SITIO + (english ? '/en' : '') + '/marcas'
  const brandName = english ? 'Campervan and motorhome brands and models' : 'Marcas y modelos de campers y autocaravanas'
  const brandDesc = english ? 'Browse manufacturers and models for campers, motorhomes and overland vehicles in Spain.' : 'Catálogo de fabricantes y modelos aptos para camperizar, autocaravanas y 4x4 overland.'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: english ? 'Home' : 'Inicio', item: SITIO + (english ? '/en' : '/') },
      { '@type': 'ListItem', position: 2, name: english ? 'Brands' : 'Marcas', item: canonical },
    ],
  }
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': canonical + '#collection',
    name: brandName,
    description: brandDesc,
    url: canonical,
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': canonical + '#breadcrumb' },
  }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': canonical + '#itemlist',
    name: brandName,
    description: brandDesc,
    numberOfItems: MARCAS_MODELOS.length,
    itemListElement: MARCAS_MODELOS.slice(0, 30).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: etiquetaModelo(m),
      url: SITIO + (english ? '/en' : '') + '/modelo/' + slugModelo(m),
    })),
  }
  // FAQ visible + FAQPage schema: responde las dudas de marca
  // que Google muestra en "La gente también pregunta".
  const faqsEs = [
    {
      pregunta: '¿Qué marcas de furgonetas camper hay en España?',
      respuesta: 'Las bases camper más habituales son Fiat Ducato, Citroën Jumper, Peugeot Boxer, Renault Master, Volkswagen Crafter, Mercedes-Benz Sprinter, Ford Transit, MAN TGE y Opel Movano (gran volumen); Volkswagen Transporter/California, Mercedes Vito y Marco Polo, Ford Transit Custom, Renault Trafic y Opel Vivaro (camper mediana); y Citroën Berlingo, Peugeot Rifter, VW Caddy y Fiat Doblò (minicamper). En autocaravanas, los carroceros habituales son Adria, Hymer, Challenger, Laika, Swift, Roller Team, Benimar, PIK y Autocamper.',
    },
    {
      pregunta: '¿Qué marca de camper es más fiable?',
      respuesta: 'No hay una marca universalmente mejor: la fiabilidad depende del motor y chasis concretos (año, kilómetros, mantenimiento), no del logotipo. Como regla general, los diésel 2.0/2.2 MultiJet (Ducato, Boxer, Jumper), EcoBlue (Transit) y OM651 (Sprinter) tienen red de talleres amplia y recambios accesibles. Antes de comprar, revisa el historial de mantenimiento y el estado de la camperización, no solo la marca.',
    },
    {
      pregunta: '¿Hay marcas de autocaravanas españolas?',
      respuesta: 'Sí: Benimar, PIK y Autocamper son carroceros españoles con larga trayectoria, y varias marcas internacionales (Adria, Hymer, Challenger, Laika, Swift, Roller Team) tienen amplia red de distribución y servicio en España. En el catálogo puedes filtrar por marca y ver los precios reales de cada modelo en su página de mercado.',
    },
    {
      pregunta: '¿VW California o Ducato camperizado?',
      respuesta: 'Son segmentos distintos: la VW California es una camper mediana de fábrica (calidad de construcción y reventa altas, precio superior, espacio limitado), mientras que un Ducato camperizado es gran volumen (más espacio, baño y cama fija a mejor precio por metro, pero más grande para ciudad). Para parejas y uso urbano, California; para familias y viajes largos, Ducato/Boxer/Jumper camperizados.',
    },
    {
      pregunta: '¿Todas estas marcas se venden de segunda mano en CamperOcasión?',
      respuesta: 'El catálogo refleja las marcas y modelos presentes en el mercado de ocasión español: si un modelo no tiene anuncios activos, no aparecerá en el listado de precios. Las páginas de modelo muestran mediana y rango P25–P75 solo cuando hay una muestra suficiente de anuncios reales; nunca publicamos cifras inventadas.',
    },
    {
      pregunta: '¿Dónde veo el precio real de un modelo concreto?',
      respuesta: 'En la página de cada modelo (/modelo/[modelo]): mostramos el precio mediano, el rango P25–P75 y el precio por tramo de antigüedad, calculados con los anuncios activos de CamperOcasión. Es la referencia más útil antes de negociar una compra o de publicar tu propia camper.',
    },
  ]
  const faqs = english ? faqsEn : faqsEs
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': canonical + '#faq',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, collectionJsonLd, itemListJsonLd, faqJsonLd],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="public-page min-h-screen">
        {/* ═══════════ HERO ═══════════ */}
        <div className="public-hero">
          <div className="public-shell relative z-10">
            <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-white/75">
              <LocalLink href="/" className="hover:text-white transition">{t('home')}</LocalLink>
              <ChevronRight size={14} />
              <span className="text-white font-medium">{t('breadcrumb')}</span>
            </nav>
            <h1 className="public-hero-title t-mega">
              {t('heroTitle')}
            </h1>
            <p className="public-hero-description">{t('heroSubtitle')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-bold">
                <Factory size={16} /> {t('statsBrands', { count: fabricantes.length })}
              </span>
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-bold">
                🚐 {t('statsModels', { count: MARCAS_MODELOS.length })}
              </span>
            </div>
            {/* Acceso rápido a cada tipo */}
            <div className="mt-6 flex flex-wrap gap-2">
              {subs.map(s => (
                <a
                  key={s.slug}
                  href={`#${s.slug}`}
                  className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/15 rounded-full px-3 py-1.5 transition"
                >
                  {s.icon} {subLabels[s.slug] || s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

          {/* ═══════════ GUÍA DE MARCA ═══════════ */}
          <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
            <h2 className="public-section-title text-night mb-5">
              {t('guideTitle')}
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>{t('guideP1')}</p>
              <p>{t('guideP2')}</p>
            </div>
          </section>

          {/* ═══════════ SECCIONES POR TIPO, AGRUPADAS POR FAMILIA ═══════════ */}
        <div className="public-shell py-12 lg:py-20 space-y-16">
          {FAMILIAS.map(familia => {
            const subsFamilia = familia.subs
              .map(slug => subs.find(s => s.slug === slug))
              .filter((s): s is NonNullable<typeof s> => Boolean(s))
            return (
            <div key={familia.key}>
              {/* Banner de familia */}
              <div className="flex items-center gap-3 border-b-2 border-brand-accent/30 pb-3 mb-8">
                <span className="text-3xl">{familia.icon}</span>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-none">
                    {tf(`${familia.key}.label`)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{tf(`${familia.key}.desc`)}</p>
                </div>
              </div>

              <div className="space-y-12">
              {subsFamilia.map(sub => {
                const grupos = agruparPorFabricante(sub.marcas)
                return (
                  <section key={sub.slug} id={sub.slug} aria-labelledby={`titulo-${sub.slug}`} className="scroll-mt-24">
                    <div className="mb-5">
                      <h3 id={`titulo-${sub.slug}`} className="text-xl md:text-2xl font-black text-gray-900">
                        {sub.icon} {subLabels[sub.slug] || sub.label}
                      </h3>
                      <p className="text-gray-500 mt-1 max-w-3xl">{t(`desc.${sub.slug}`)}</p>
                    </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grupos.map(g => {
                    // Entrada "solo fabricante" (Benimar, Hymer…): el nombre ya
                    // está en la cabecera de la tarjeta, así que dentro solo va
                    // la nota y el acceso a sus anuncios.
                    const soloFabricante = g.modelos.length === 1 && !g.modelos[0].modelo
                    const entrada = g.modelos[0]
                    return (
                      <div
                        key={g.fabricante}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight">
                            {soloFabricante ? (
                              <LocalLink
                                href={hrefCatalogo(sub.label, entrada.valor)}
                                className="hover:text-brand-accent transition"
                              >
                                {g.fabricante}
                              </LocalLink>
                            ) : (
                              g.fabricante
                            )}
                          </h3>
                          <LocalLink
                            href={soloFabricante ? hrefCatalogo(sub.label, entrada.valor) : hrefCatalogo(sub.label)}
                            className="text-xs font-bold text-brand-accent hover:text-brand-dark transition whitespace-nowrap inline-flex items-center gap-0.5"
                          >
                            {t('viewAds')} <ArrowRight size={12} />
                          </LocalLink>
                        </div>

                        {soloFabricante ? (
                          <div>
                            {!english && entrada.nota && (
                              <p className="text-xs text-gray-500">{entrada.nota}</p>
                            )}
                            <div className="mt-2">
                              <AptasBadges m={entrada} subActual={sub.slug} labels={subLabels} />
                            </div>
                            <LocalLink
                              href={`/modelo/${slugModelo(entrada)}`}
                              className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-0.5 mt-2"
                            >
                              {t('marketPrices')} <ArrowRight size={11} />
                            </LocalLink>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {g.modelos.map(m => (
                              <li key={m.valor}>
                                <LocalLink
                                  href={hrefCatalogo(sub.label, m.valor)}
                                  className="group block"
                                >
                                  <span className="text-sm font-semibold text-gray-800 group-hover:text-brand-accent transition">
                                    {etiquetaModelo(m)}
                                  </span>
                                  {!english && m.nota && (
                                    <span className="block text-xs text-gray-500 mt-0.5">{m.nota}</span>
                                  )}
                                  <AptasBadges m={m} subActual={sub.slug} labels={subLabels} />
                                </LocalLink>
                                <LocalLink
                                  href={`/modelo/${slugModelo(m)}`}
                                  className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  {t('marketPrices')} <ArrowRight size={11} />
                                </LocalLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                      })}
                    </div>
                  </section>
                )
              })}
              </div>
            </div>
            )
          })}

          {/* ═══════════ FAQ ═══════════ */}
          <section className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-5">
              {t('faqTitle')}
            </h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details key={i} className="bg-white border border-gray-200 rounded-xl p-5 group">
                  <summary className="font-bold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                    {f.pregunta}
                    <ArrowRight size={16} className="text-brand-accent shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{f.respuesta}</p>
                </details>
              ))}
            </div>
          </section>

          {/* ═══════════ CTA ═══════════ */}
          <section className="bg-gradient-to-r from-brand-primary to-brand-dark rounded-3xl p-8 md:p-10 text-white text-center">
            <h2 className="text-2xl md:text-3xl font-black">{t('ctaTitle')}</h2>
            <p className="mt-2 text-white/85">{t('ctaSubtitle')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <LocalLink
                href="/catalogo"
                className="bg-brand-accent hover:bg-brand-accent-dark text-white font-bold px-8 py-3.5 rounded-xl transition"
              >
                {t('viewCatalog')}
              </LocalLink>
              <LocalLink
                href="/publicar"
                className="border border-white/30 hover:bg-white/10 font-bold px-8 py-3.5 rounded-xl transition"
              >
                {t('publishCta')}
              </LocalLink>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
