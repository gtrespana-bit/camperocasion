'use client'
import { useTranslations } from 'next-intl'

export type TipoVendedor = 'particular' | 'camperizador' | 'profesional'

export const TIPOS_VENDEDOR: TipoVendedor[] = ['particular', 'camperizador', 'profesional']

export function esTipoVendedor(valor: unknown): valor is TipoVendedor {
  return valor === 'particular' || valor === 'camperizador' || valor === 'profesional'
}

/**
 * Chip "Particular / Camperizador / Pro" que identifica quién vende el
 * anuncio. Colores y emoji por tipo para reconocerlo de un vistazo en
 * cards, ficha de producto, página del vendedor y publicación.
 */
export default function BadgeTipoVendedor({
  tipo,
  size = 'sm',
}: {
  tipo?: string | null
  size?: 'sm' | 'md'
}) {
  const t = useTranslations()
  if (!esTipoVendedor(tipo)) return null

  const estilos: Record<TipoVendedor, string> = {
    particular: 'text-slate-700 bg-slate-100 border-slate-200',
    camperizador: 'text-orange-700 bg-orange-50 border-orange-200',
    profesional: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  }
  const iconos: Record<TipoVendedor, string> = {
    particular: '👤',
    camperizador: '🔧',
    profesional: '🏢',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold border rounded-full ${estilos[tipo]} ${
        size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-1.5 py-0.5'
      }`}
    >
      <span aria-hidden="true">{iconos[tipo]}</span>
      {t(`tiposVendedor.${tipo}`)}
    </span>
  )
}
