import type { Metadata } from 'next'
import { ChevronRight, Factory, ArrowRight } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import {
  MARCAS_MODELOS,
  agruparPorFabricante,
  etiquetaModelo,
  type MarcaModelo,
  type SubSlug,
} from '@/lib/marcas'

export const metadata: Metadata = {
  title: 'Marcas y modelos de campers y autocaravanas | CamperOcasión',
  description:
    'Todas las marcas y modelos de furgonetas camper, autocaravanas y 4x4 organizadas por fabricante: Fiat, Volkswagen, Mercedes-Benz, Benimar, Hymer, Adria y más. Descubre cuáles son aptos para cada tipo de vehículo vivienda.',
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
    canonical: 'https://camperocasion.online/marcas',
  },
  openGraph: {
    title: 'Marcas y modelos de campers y autocaravanas',
    description:
      'Catálogo completo de fabricantes y modelos camper organizado por marca y tipo de vehículo: gran volumen, camper mediana, minicamper, perfiladas, capuchinas, integrales y 4x4.',
    url: 'https://camperocasion.online/marcas',
    siteName: 'CamperOcasión',
    locale: 'es_ES',
    type: 'website',
  },
}

function hrefCatalogo(subLabel: string, valor?: string): string {
  const params = new URLSearchParams({ subcategoria: subLabel })
  if (valor) params.set('marca', valor)
  return `/catalogo?${params.toString()}`
}

/** Insignias de los tipos para los que un modelo es apto. */
function AptasBadges({ m, subActual }: { m: MarcaModelo; subActual: SubSlug }) {
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
            title={sub.label}
            className="text-[10px] bg-green-50 text-brand-primary border border-green-200 rounded-full px-1.5 py-0.5 font-semibold whitespace-nowrap"
          >
            {sub.icon} {sub.label}
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

  const fabricantes = agruparPorFabricante(MARCAS_MODELOS)
  const subs = categoriasData.camper.subs

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Marcas y modelos de campers y autocaravanas',
    description: 'Catálogo de fabricantes y modelos aptos para camperizar, autocaravanas y 4x4 overland.',
    numberOfItems: MARCAS_MODELOS.length,
    itemListElement: subs.map((sub, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: sub.label,
      url: `https://camperocasion.online/catalogo?subcategoria=${encodeURIComponent(sub.label)}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-gray-50 min-h-screen">
        {/* ═══════════ HERO ═══════════ */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-dark text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <nav aria-label="breadcrumb" className="text-sm text-white/70 mb-4 flex items-center gap-1.5">
              <LocalLink href="/" className="hover:text-white transition">{t('home')}</LocalLink>
              <ChevronRight size={14} />
              <span className="text-white font-medium">{t('breadcrumb')}</span>
            </nav>
            <h1 className="text-3xl md:text-5xl font-black leading-tight max-w-3xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl">{t('heroSubtitle')}</p>
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
                  {s.icon} {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════ SECCIONES POR TIPO, AGRUPADAS POR FAMILIA ═══════════ */}
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-14">
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
                        {sub.icon} {sub.label}
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
                            {entrada.nota && (
                              <p className="text-xs text-gray-500">{entrada.nota}</p>
                            )}
                            <div className="mt-2">
                              <AptasBadges m={entrada} subActual={sub.slug} />
                            </div>
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
                                  {m.nota && (
                                    <span className="block text-xs text-gray-500 mt-0.5">{m.nota}</span>
                                  )}
                                  <AptasBadges m={m} subActual={sub.slug} />
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
