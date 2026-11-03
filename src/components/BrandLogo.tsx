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
  sm: { px: 32, img: 'h-8 w-8', text: 'text-[22px]', gap: 'gap-2' },
  md: { px: 44, img: 'h-10 w-10', text: 'text-[28px]', gap: 'gap-2.5' },
  lg: { px: 56, img: 'h-14 w-14', text: 'text-[40px]', gap: 'gap-3' },
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
        // El icono es un cuadrado redondeado con fondo propio (grafito): se
        // lee igual sobre fondo claro y oscuro, sin marcos añadidos.
        className={`${s.img} w-auto shrink-0 object-contain rounded-[10px] ${isLight ? 'ring-1 ring-white/25' : 'ring-1 ring-ink/10'}`}
      />
      {showText !== false && (
        <span
          className={`font-display leading-none tracking-[-0.01em] ${s.text} ${isLight ? 'text-white' : 'text-ink'} ${
            showText === 'sm' ? 'hidden sm:block' : ''
          }`}
        >
          Camper<em className={`italic ${isLight ? 'text-[#FFD2B0]' : 'text-ember'}`}>Ocasión</em>
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
