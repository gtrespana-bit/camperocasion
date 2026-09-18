import type { Metadata } from 'next'
import { CheckCircle, Zap, Shield, MessageCircle, Eye, Camera, DollarSign, X } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: '¿Cómo Funciona?',
  description: 'Publica gratis en CamperOcasión en 4 pasos simples. Compra y vende en España sin comisiones.',
}

export default async function ComoFuncionaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'howItWorks' })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('heroTitle'),
    description: t('heroSubtitle'),
    url: 'https://camperocasion.online/como-funciona',
    step: [
      { '@type': 'HowToStep', name: t('step1Title'), text: t('step1Desc') },
      { '@type': 'HowToStep', name: t('step2Title'), text: t('step2Desc') },
      { '@type': 'HowToStep', name: t('step3Title'), text: t('step3Desc') },
      { '@type': 'HowToStep', name: t('step4Title'), text: t('step4Desc') },
    ],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-brand-primary to-brand-dark text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-4">{t('heroTitle')}</h1>
            <p className="text-xl text-white/80">{t('heroSubtitle')}</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pasos.map((paso, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex gap-4">
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

        <div className="bg-white border-t border-b border-gray-100 py-10 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">{t('vsTitle')}</h2>
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
          <h2 className="text-2xl font-black text-gray-900 mb-8 text-center">{t('faqTitle')}</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="bg-white rounded-xl border border-gray-100 group">
                <summary className="cursor-pointer p-5 font-semibold text-gray-900 flex justify-between items-center list-none">
                  {faq.pregunta}
                  <span className="text-brand-accent group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">{faq.respuesta}</div>
              </details>
            ))}
          </div>
        </div>

        <div className="bg-white border-t border-b border-gray-100 py-10 px-4">
          <div className="max-w-2xl mx-auto text-center flex flex-col sm:flex-row gap-4 justify-center">
            <LocalLink href="/publicar" className="bg-brand-accent text-white px-8 py-3 rounded-lg font-bold hover:bg-accent/90 transition inline-block">
              {t('ctaPublish')}
            </LocalLink>
            <LocalLink href="/catalogo" className="bg-white border-2 border-brand-primary text-brand-primary px-8 py-3 rounded-lg font-bold hover:bg-brand-primary hover:text-white transition inline-block">
              {t('ctaCatalog')}
            </LocalLink>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </>
  )
}
