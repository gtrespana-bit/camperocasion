'use client'

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function MiPerfilRedirect() {
  const { user, loading } = useAuth()
  const locale = useLocale()
  const t = useTranslations('common')
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace(`${locale === 'en' ? '/en' : ''}/dashboard?tab=cuenta`)
    } else {
      router.replace(`${locale === 'en' ? '/en' : ''}/dashboard`)
    }
  }, [user, loading, router, locale])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-500">{t('loading')}</p>
    </div>
  )
}
