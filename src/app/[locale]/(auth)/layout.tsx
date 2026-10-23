import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Login, registro y confirmación son utilidades de cuenta, no páginas de
// aterrizaje. Se mantienen rastreables para que Google pueda seguir sus enlaces,
// pero no deben competir con el catálogo ni aparecer como resultados thin.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
