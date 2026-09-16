import type { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Sobre Nosotros',
  description: 'Conoce CamperOcasión: el marketplace gratuito para comprar y vender en España. Sin comisiones, sin intermediarios, contacto directo entre compradores y vendedores.',
}

export default async function SobreNosotrosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'about' })
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('title'),
    description: t('subtitle'),
    url: 'https://camperocasion.es/sobre-nosotros',
    mainEntity: {
      '@type': 'Organization',
      name: 'CamperOcasión',
      url: 'https://camperocasion.es',
      description: t('subtitle'),
      foundingDate: '2024',
      areaServed: { '@type': 'Country', name: 'España' },
      serviceType: 'Marketplace',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-brand-primary to-brand-dark text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-4">{t('title')}</h1>
            <p className="text-xl text-white/80">{t('subtitle')}</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-4">{t('whoTitle')}</h2>
            <p className="text-gray-600 leading-relaxed">{t('whoP1')}</p>
            <p className="text-gray-600 leading-relaxed mt-4">{t('whoP2')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-4">{t('missionTitle')}</h2>
            <p className="text-gray-600 leading-relaxed">{t('missionP1')}</p>
            <p className="text-gray-600 leading-relaxed mt-4">{t('missionP2')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-4">{t('whyTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { titulo: t('why1_title'), desc: t('why1_desc'), icon: '💰' },
                { titulo: t('why2_title'), desc: t('why2_desc'), icon: '💬' },
                { titulo: t('why3_title'), desc: t('why3_desc'), icon: '🌎' },
                { titulo: t('why4_title'), desc: t('why4_desc'), icon: '🆓' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.titulo}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl p-8 border border-gray-100 text-center shadow-sm">
            <h2 className="text-2xl font-black text-gray-900 mb-3">{t('ctaTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('ctaDesc')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <LocalLink href="/register" className="bg-brand-accent text-white px-8 py-3 rounded-lg font-bold hover:bg-accent/90 transition inline-block">
                {t('ctaRegister')}
              </LocalLink>
              <LocalLink href="/catalogo" className="bg-white border-2 border-brand-primary text-brand-primary px-8 py-3 rounded-lg font-bold hover:bg-brand-primary hover:text-white transition inline-block">
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
