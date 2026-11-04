import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  compact?: boolean
}

/** Cabecera editorial compartida por las páginas públicas; no añade efectos
 * ni oculta contenido, y admite títulos traducidos de distinta longitud. */
export default function PublicHero({ eyebrow, title, description, children, compact = false }: Props) {
  return (
    <header className={`public-hero ${compact ? 'public-hero--compact' : ''}`}>
      <div className="public-shell relative z-10">
        <p className="public-eyebrow"><span className="public-eyebrow-line" aria-hidden="true" />{eyebrow}</p>
        <h1 className="public-hero-title t-mega">{title}</h1>
        {description && <p className="public-hero-description">{description}</p>}
        {children && <div className="public-hero-actions">{children}</div>}
      </div>
    </header>
  )
}
