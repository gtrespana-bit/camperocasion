import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Eliminar tu cuenta',
  description: 'Solicita la eliminación de tu cuenta y datos asociados en CamperOcasión.',
}

export default async function EliminarCuentaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'deleteAccount' })
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-black text-gray-800 mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-10">{t('subtitle')}</p>
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('howTitle')}</h2>
          <p className="text-gray-600 mb-4">
            <a href="mailto:privacidad@camperocasion.online?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20%E2%80%94%20CamperOcasión" className="text-blue-600 underline font-medium">
              privacidad@camperocasion.online
            </a> — {t('howP1')}
          </p>
          <p className="text-gray-600 mb-3">{t('howBody')}</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>{t('howLi1')}</li>
            <li>{t('howLi2')}</li>
          </ul>
          <p className="text-gray-600 mt-4 text-sm">{t('howP2')}</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('deletedTitle')}</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>{t('delLi1')}</li>
            <li>{t('delLi2')}</li>
            <li>{t('delLi3')}</li>
            <li>{t('delLi4')}</li>
            <li>{t('delLi5')}</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('keptTitle')}</h2>
          <p className="text-gray-600">{t('keptText')}</p>
        </section>
        <section className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <h3 className="font-bold text-gray-800 mb-2">{t('contactTitle')}</h3>
          <p className="text-gray-600">
            <a href="mailto:privacidad@camperocasion.online" className="text-blue-600 underline font-medium">privacidad@camperocasion.online</a>
          </p>
          <p className="text-gray-500 text-sm mt-2">{t('tagline')}</p>
        </section>
      </div>
    </div>
  )
}
