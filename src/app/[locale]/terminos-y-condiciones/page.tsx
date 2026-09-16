import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
}

export default async function TerminosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'terms' })
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-black text-gray-800 mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('updated')}</p>
      <div className="prose prose-sm text-gray-600 space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s1_title')}</h2>
          <p>{t('s1_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s2_title')}</h2>
          <p>{t('s2_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s3_title')}</h2>
          <p>{t('s3_text')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('s3_li1')}</li>
            <li>{t('s3_li2')}</li>
            <li>{t('s3_li3')}</li>
          </ul>
          <p className="mt-2">{t('s3_text2')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s4_title')}</h2>
          <p>{t('s4_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s5_title')}</h2>
          <p>{t('s5_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s6_title')}</h2>
          <p>{t('s6_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s7_title')}</h2>
          <p>{t('s7_text')}</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">{t('s8_title')}</h2>
          <p>{t('s8_text')}</p>
        </section>
      </div>
    </div>
  )
}
