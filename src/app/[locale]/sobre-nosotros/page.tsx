import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { alternatesSeo } from '@/lib/seo'
import LocalLink from '@/components/LocalLink'
import PublicHero from '@/components/editorial/PublicHero'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description: 'Conoce CamperOcasión, el marketplace especializado en furgonetas camper y autocaravanas de ocasión en España, con contacto directo y sin comisiones.',
  alternates: alternatesSeo('/sobre-nosotros'),
}

export default async function SobreNosotrosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'about' })
  const SITIO = 'https://camperocasion.online'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: t('title'), item: SITIO + '/sobre-nosotros' },
    ],
  }
  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': SITIO + '/sobre-nosotros#about',
    name: t('title'),
    description: t('subtitle'),
    url: SITIO + '/sobre-nosotros',
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': SITIO + '/sobre-nosotros#breadcrumb' },
    mainEntity: {
      '@type': 'Organization',
      '@id': SITIO + '/#organization',
      name: 'CamperOcasión',
      url: SITIO,
      description: t('subtitle'),
      foundingDate: '2024',
      areaServed: { '@type': 'Country', name: 'España' },
      serviceType: 'Marketplace',
    },
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, aboutJsonLd],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="public-page min-h-screen">
        <PublicHero eyebrow="CamperOcasión" title={t('title')} description={t('subtitle')} />

        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16 lg:py-24 space-y-16">
          <section>
            <h2 className="public-section-title text-night mb-5">{t('whoTitle')}</h2>
            <p className="text-slate-700 leading-[1.75] text-[17px]">{t('whoP1')}</p>
            <p className="text-slate-700 leading-[1.75] text-[17px] mt-4">{t('whoP2')}</p>
          </section>

          <section>
            <h2 className="public-section-title text-night mb-5">{t('missionTitle')}</h2>
            <p className="text-slate-700 leading-[1.75] text-[17px]">{t('missionP1')}</p>
            <p className="text-slate-700 leading-[1.75] text-[17px] mt-4">{t('missionP2')}</p>
          </section>

          <section>
            <h2 className="public-section-title text-night mb-5">{t('whyTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { titulo: t('why1_title'), desc: t('why1_desc'), icon: '💰' },
                { titulo: t('why2_title'), desc: t('why2_desc'), icon: '💬' },
                { titulo: t('why3_title'), desc: t('why3_desc'), icon: '🌎' },
                { titulo: t('why4_title'), desc: t('why4_desc'), icon: '🆓' },
              ].map((item, i) => (
                <div key={i} className="public-card p-6">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="public-card-title text-night mb-2">{item.titulo}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-night p-8 sm:p-12 text-white">
            <h2 className="public-section-title mb-4">{t('ctaTitle')}</h2>
            <p className="text-white/75 mb-8">{t('ctaDesc')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <LocalLink href="/register" className="btn btn-green">
                {t('ctaRegister')}
              </LocalLink>
              <LocalLink href="/catalogo" className="btn btn-ghost">
                {t('ctaBrowse')}
              </LocalLink>
            </div>
          </section>

          <div className="h-8" />
        </div>
      </div>
    </>
  )
}
