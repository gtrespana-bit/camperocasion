'use client'
import { formatPrecio } from '@/lib/precio'

import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { productUrl } from '@/lib/product-url'

export interface ProductCardData {
  id: string
  slug?: string | null
  titulo: string
  precio_usd: number | null
  imagen_url: string | null
  ubicacion_ciudad: string | null
  ubicacion_estado: string | null
  estado: string
  boosteado_en: string | null
  destacado: boolean | null
  destacado_hasta: string | null
  vendedor_verificado: boolean | null
}

const PLACEHOLDER_IMAGES = [
  '/placeholder-product.webp',
]

export default function ProductCard({ p, isPromoted, isFeatured, priority }: { p: ProductCardData; isPromoted?: boolean; isFeatured?: boolean; priority?: boolean }) {
  const t = useTranslations()
  const isBoosted = p.boosteado_en != null
  const promoted = isPromoted ?? (isBoosted || isFeatured)

  const imgUrl = p.imagen_url || PLACEHOLDER_IMAGES[p.titulo.charCodeAt(0) % PLACEHOLDER_IMAGES.length]

  return (
    <LocalLink
      href={productUrl(p)}
      className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border
        ${isPromoted
          ? 'border-2 border-brand-accent shadow-md hover:shadow-xl hover:-translate-y-1'
          : 'border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'
        }`
      }
    >
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ⭐ {t('productCard.featured')}
          </div>
        )}
        {isBoosted && !isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ⚡ {t('productCard.boost')}
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          width={400}
          height={400}
          sizes="(max-width: 768px) 50vw, 25vw"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            if (!target.src.includes('/placeholder-product.webp')) {
              target.src = '/placeholder-product.webp'
            }
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
          {p.titulo}
        </h3>
        <p className="text-xl font-black text-brand-primary mt-1">
          {formatPrecio(p.precio_usd || 0)}
        </p>
        {p.vendedor_verificado && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full mt-1">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {t('productCard.verified')}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1 truncate">
          {p.estado}{p.ubicacion_ciudad ? ` · ${p.ubicacion_ciudad}` : ''}
        </p>
      </div>
    </LocalLink>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}
