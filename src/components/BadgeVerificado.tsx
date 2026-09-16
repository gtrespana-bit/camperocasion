'use client'

import { useTranslations } from 'next-intl'

/**
 * Badge de Vendedor Verificado
 * - Se muestra como un icono con el texto "Verificado"
 * - Color verde para generar confianza visual inmediata
 */
export default function BadgeVerificado({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('dashboard')
  const sizes = {
    sm: { icon: 14, text: 'text-xs', gap: 'gap-1' },
    md: { icon: 16, text: 'text-sm', gap: 'gap-1.5' },
    lg: { icon: 20, text: 'text-base', gap: 'gap-2' },
  }
  const s = sizes[size]

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.text} font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full`}
      title={t('verifiedTitle')}
    >
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600 flex-shrink-0"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>{t('verified')}</span>
    </span>
  )
}
