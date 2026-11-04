import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Pantalla de trabajo o cuenta: rastreable para seguir enlaces, no indexable.
export const metadata: Metadata = { robots: { index: false, follow: true } }

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return children
}
