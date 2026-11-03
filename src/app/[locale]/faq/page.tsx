import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { alternatesSeo } from '@/lib/seo'
import PublicHero from '@/components/editorial/PublicHero'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes sobre campers',
  description: 'Resuelve tus dudas sobre CamperOcasión: publicar anuncios, seguridad, créditos, métodos de pago y compra de campers en España.',
  alternates: alternatesSeo('/faq'),
}

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'faq' })

  const faqData = [
    { question: t('q1'), answer: t('a1') },
    { question: t('q2'), answer: t('a2') },
    { question: t('q3'), answer: t('a3') },
    { question: t('q4'), answer: t('a4') },
    { question: t('q5'), answer: t('a5') },
    { question: t('q6'), answer: t('a6') },
    { question: t('q7'), answer: t('a7') },
    { question: t('q8'), answer: t('a8') },
    { question: t('q9'), answer: t('a9') },
    { question: t('q10'), answer: t('a10') },
    { question: t('q11'), answer: t('a11') },
  ]

  const SITIO = 'https://camperocasion.online'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: 'Preguntas Frecuentes', item: SITIO + '/faq' },
    ],
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': SITIO + '/faq#faq',
    mainEntity: faqData.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, faqJsonLd],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="public-page min-h-screen">
        <PublicHero eyebrow="CamperOcasión" title={t('title')} description={t('subtitle')} compact />
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-24">

        <div className="space-y-4">
          {faqData.map((faq, i) => (
            <details key={i} className="public-card group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-6 py-5 text-[17px] font-semibold text-night transition-colors hover:text-leaf-600 [&::-webkit-details-marker]:hidden">
                <span><span className="t-num mr-4 text-[13px] text-leaf-600">{String(i + 1).padStart(2, '0')}</span>{faq.question}</span>
                <span className="text-leaf-600 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="text-slate-700 px-6 pb-6 pl-14 leading-[1.75]">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="bg-night p-8 sm:p-10 mt-12 text-center text-white">
          <h3 className="public-section-title">{t('noAnswer')}</h3>
          <p className="text-white/75 mt-3">{t('noAnswerDesc')}</p>
          <a href="mailto:soporte@camperocasion.online" className="btn btn-green mt-7">
            soporte@camperocasion.online
          </a>
        </div>
        </div>
      </div>
    </>
  )
}
