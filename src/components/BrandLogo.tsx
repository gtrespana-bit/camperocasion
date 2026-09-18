import Image from 'next/image'
import LocalLink from '@/components/LocalLink'

/**
 * Marca CamperOcasión en un único sitio.
 *
 * Antes cada pantalla montaba su propio logo a mano (header, footer y las
 * cuatro pantallas de autenticación), con dos consecuencias: el icono y el
 * texto podían divergir entre páginas y quedaban restos del branding
 * anterior en las pantallas menos visitadas. Aquí se define una vez.
 *
 * - `tone="light"` → para fondos oscuros (header, footer, CTA).
 * - `tone="dark"` → para fondos claros (login, registro, confirmación).
 * - `showText={false}` → solo el icono (móvil, espacios estrechos).
 */
type BrandLogoProps = {
  tone?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  /** `true` siempre, `false` nunca, `'sm'` a partir de 640px (móvil solo icono). */
  showText?: boolean | 'sm'
  href?: string | null
  className?: string
  priority?: boolean
}

const SIZES = {
  sm: { px: 32, img: 'h-8 w-8', text: 'text-base', gap: 'gap-2' },
  md: { px: 44, img: 'h-11 w-11', text: 'text-xl', gap: 'gap-3' },
  lg: { px: 56, img: 'h-14 w-14', text: 'text-3xl', gap: 'gap-3' },
} as const

export default function BrandLogo({
  tone = 'dark',
  size = 'md',
  showText = true,
  href = '/',
  className = '',
  priority = false,
}: BrandLogoProps) {
  const s = SIZES[size]
  const isLight = tone === 'light'

  const content = (
    <>
      <Image
        src="/logo-camperocasion.png"
        alt="CamperOcasión"
        width={s.px}
        height={s.px}
        priority={priority}
        decoding="async"
        // El icono es cuadrado con fondo propio: se le da un marco sutil para
        // que se lea igual sobre fondo claro y sobre el header grafito.
        className={`${s.img} w-auto object-contain rounded-lg ${
          isLight
            ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.45)] bg-white/10 p-0.5'
            : 'drop-shadow-[0_1px_2px_rgba(15,23,42,0.15)] bg-white p-0.5 border border-gray-100'
        }`}
      />
      {showText !== false && (
        <span
          className={`font-black tracking-tight ${s.text} ${isLight ? 'text-white' : 'text-brand-primary'} ${
            showText === 'sm' ? 'hidden sm:block' : ''
          }`}
        >
          Camper<span className={isLight ? 'text-brand-accent-light' : 'text-brand-accent'}>Ocasión</span>
        </span>
      )}
    </>
  )

  const classes = `inline-flex items-center ${s.gap} ${className}`

  if (!href) return <span className={classes}>{content}</span>

  return (
    <LocalLink href={href} className={classes} aria-label="CamperOcasión">
      {content}
    </LocalLink>
  )
}
