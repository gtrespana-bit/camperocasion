import type { ReactNode } from 'react'

/** Encabezado compacto para pantallas de trabajo: el contenido y las acciones
 * siguen visibles sin empujar formularios ni listados fuera del primer pliegue. */
export default function WorkHeader({ title, description, eyebrow, children }: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: string
  children?: ReactNode
}) {
  return (
    <header className="work-header">
      {eyebrow && <p className="work-eyebrow"><span className="work-eyebrow-line" aria-hidden="true" />{eyebrow}</p>}
      <h1 className="work-title">{title}</h1>
      {description && <p className="work-description">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap gap-3">{children}</div>}
    </header>
  )
}
