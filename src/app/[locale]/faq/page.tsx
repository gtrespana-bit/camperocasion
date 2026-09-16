import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes',
  description: 'Resuelve tus dudas sobre CamperOcasión: cómo publicar, seguridad, créditos, métodos de pago y más.',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-gray-800 mb-2 text-center">{t('title')}</h1>
        <p className="text-center text-gray-500 mb-10">{t('subtitle')}</p>

        <div className="space-y-4">
          {faqData.map((faq, i) => (
            <details key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 group">
              <summary className="font-bold text-gray-800 text-lg px-6 pt-5 pb-2 cursor-pointer list-none hover:text-brand-primary transition-colors marker:content-['▶']">
                {faq.question}
              </summary>
              <p className="text-gray-600 px-6 pb-5 leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="bg-brand-accent rounded-xl p-6 mt-8 text-center">
          <h3 className="font-bold text-brand-primary text-lg">{t('noAnswer')}</h3>
          <p className="text-brand-primary/80 mt-1">{t('noAnswerDesc')}</p>
          <a href="mailto:soporte@camperocasion.es" className="inline-block mt-3 bg-brand-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-dark transition">
            soporte@camperocasion.es
          </a>
        </div>
      </div>
    </>
  )
}
