'use client'

import { useTranslations } from 'next-intl'
import { normalizarEstadoVerificacion } from '@/lib/verificacion-homologacion'

/**
 * Sello "Homologación verificada".
 *
 * Distinto del badge de vendedor verificado (`BadgeVerificado`): aquel acredita
 * la identidad del vendedor; este acredita que el equipo ha revisado la
 * documentación DEL VEHÍCULO (ficha técnica, proyecto de homologación, ITV).
 *
 * Solo se pinta cuando hay algo que contar: con el expediente sin empezar no
 * aparece nada, ni en las tarjetas ni en la ficha.
 */
export default function BadgeHomologacion({
  estado,
  size = 'sm',
  mostrarSinVerificar = false,
}: {
  estado?: string | null
  size?: 'sm' | 'md' | 'lg'
  mostrarSinVerificar?: boolean
}) {
  const t = useTranslations('productCard')
  const estadoNormalizado = normalizarEstadoVerificacion(estado)

  if (estadoNormalizado === 'sin_verificar' && !mostrarSinVerificar) return null

  const sizes = {
    sm: { icon: 11, text: 'text-[10px]', gap: 'gap-1', pad: 'px-1.5 py-0.5' },
    md: { icon: 14, text: 'text-xs', gap: 'gap-1.5', pad: 'px-2 py-0.5' },
    lg: { icon: 17, text: 'text-sm', gap: 'gap-2', pad: 'px-2.5 py-1' },
  }[size]

  const estilos: Record<string, string> = {
    verificada: 'bg-brand-accent/10 text-brand-accent-dark border-brand-accent/40',
    pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
    rechazada: 'bg-red-50 text-red-700 border-red-200',
    sin_verificar: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const etiquetas: Record<string, string> = {
    verificada: t('homologacionVerificada'),
    pendiente: t('homologacionPendiente'),
    rechazada: t('homologacionRechazada'),
    sin_verificar: t('homologacionSinExpediente'),
  }

  return (
    <span
      className={`inline-flex items-center ${sizes.gap} ${sizes.text} ${sizes.pad} font-semibold border rounded-full ${estilos[estadoNormalizado]}`}
      title={etiquetas[estadoNormalizado]}
    >
      <svg
        width={sizes.icon}
        height={sizes.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        {/* Documento con sello: el expediente del vehículo */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9 15 2 2 4-4" />
      </svg>
      <span>{etiquetas[estadoNormalizado]}</span>
    </span>
  )
}
