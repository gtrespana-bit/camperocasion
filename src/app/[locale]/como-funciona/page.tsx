import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { alternatesSeo } from '@/lib/seo'
import { CheckCircle, Zap, Shield, MessageCircle, Eye, Camera, DollarSign, X } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import PublicHero from '@/components/editorial/PublicHero'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Cómo funciona el marketplace camper',
  description: 'Publica gratis tu camper en cuatro pasos y contacta directamente con compradores y vendedores en toda España, sin comisiones por venta.',
  alternates: alternatesSeo('/como-funciona'),
}

export default async function ComoFuncionaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'howItWorks' })

  const SITIO = 'https://camperocasion.online'
  const CANONICAL = SITIO + '/como-funciona'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: t('heroTitle') || 'Cómo funciona', item: CANONICAL },
    ],
  }
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': CANONICAL + '#howto',
    name: t('heroTitle'),
    description: t('heroSubtitle'),
    url: CANONICAL,
    totalTime: 'PT30M',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'EUR', value: '0' },
    step: [
      { '@type': 'HowToStep', position: 1, name: t('step1Title'), text: t('step1Desc'), url: CANONICAL + '#paso-1' },
      { '@type': 'HowToStep', position: 2, name: t('step2Title'), text: t('step2Desc'), url: CANONICAL + '#paso-2' },
      { '@type': 'HowToStep', position: 3, name: t('step3Title'), text: t('step3Desc'), url: CANONICAL + '#paso-3' },
      { '@type': 'HowToStep', position: 4, name: t('step4Title'), text: t('step4Desc'), url: CANONICAL + '#paso-4' },
    ],
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': CANONICAL + '#faq',
    mainEntity: [
      { '@type': 'Question', name: t('faq1q'), acceptedAnswer: { '@type': 'Answer', text: t('faq1a') } },
      { '@type': 'Question', name: t('faq2q'), acceptedAnswer: { '@type': 'Answer', text: t('faq2a') } },
      { '@type': 'Question', name: t('faq3q'), acceptedAnswer: { '@type': 'Answer', text: t('faq3a') } },
      { '@type': 'Question', name: t('faq4q'), acceptedAnswer: { '@type': 'Answer', text: t('faq4a') } },
      { '@type': 'Question', name: t('faq5q'), acceptedAnswer: { '@type': 'Answer', text: t('faq5a') } },
      { '@type': 'Question', name: t('faq6q'), acceptedAnswer: { '@type': 'Answer', text: t('faq6a') } },
    ],
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, howToJsonLd, faqJsonLd],
  }

  const pasos = [
    { icon: <Camera className="text-brand-accent" size={32} />, titulo: t('step1Title'), desc: t('step1Desc') },
    { icon: <Eye className="text-brand-accent" size={32} />, titulo: t('step2Title'), desc: t('step2Desc') },
    { icon: <MessageCircle className="text-brand-accent" size={32} />, titulo: t('step3Title'), desc: t('step3Desc') },
    { icon: <Shield className="text-brand-accent" size={32} />, titulo: t('step4Title'), desc: t('step4Desc') },
  ]

  const faqs = [
    { pregunta: t('faq1q'), respuesta: t('faq1a') },
    { pregunta: t('faq2q'), respuesta: t('faq2a') },
    { pregunta: t('faq3q'), respuesta: t('faq3a') },
    { pregunta: t('faq4q'), respuesta: t('faq4a') },
    { pregunta: t('faq5q'), respuesta: t('faq5a') },
    { pregunta: t('faq6q'), respuesta: t('faq6a') },
  ]

  const camperItems = ['razon1','razon2','razon3','razon4','razon5'] as const
  const othersItems = ['others1','others2','others3','others4','others5'] as const

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="public-page min-h-screen">
        <PublicHero eyebrow="CamperOcasión" title={t('heroTitle')} description={t('heroSubtitle')} />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pasos.map((paso, i) => (
              <div key={i} className="public-card p-6 flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center">{paso.icon}</div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{paso.titulo}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{paso.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bone border-y border-night/10 py-16 px-5">
          <div className="max-w-3xl mx-auto">
            <h2 className="public-section-title text-night mb-8 text-center">{t('vsTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-bold text-green-800 text-lg mb-3">✅ {t('razonTitle')}</h3>
                <ul className="space-y-2 text-sm text-green-700">
                  {camperItems.map(k => (
                    <li key={k} className="flex items-center gap-2"><CheckCircle size={14} /> {t(k)}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="font-bold text-red-800 text-lg mb-3">❌ {t('othersTitle')}</h3>
                <ul className="space-y-2 text-sm text-red-700">
                  {othersItems.map(k => (
                    <li key={k} className="flex items-center gap-2"><X size={14} /> {t(k)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="public-section-title text-night mb-8 text-center">{t('faqTitle')}</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="public-card group">
                <summary className="cursor-pointer p-5 font-semibold text-gray-900 flex justify-between items-center list-none">
                  {faq.pregunta}
                  <span className="text-brand-accent group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">{faq.respuesta}</div>
              </details>
            ))}
          </div>
        </div>

        <div className="bg-bone border-y border-night/10 py-16 px-5">
          <div className="max-w-2xl mx-auto text-center flex flex-col sm:flex-row gap-4 justify-center">
            <LocalLink href="/publicar" className="btn btn-green">
              {t('ctaPublish')}
            </LocalLink>
            <LocalLink href="/catalogo" className="btn btn-ink">
              {t('ctaCatalog')}
            </LocalLink>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </>
  )
}
