'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { isAdminPath } from '@/lib/admin-path'

/**
 * Envoltorio del "chrome" del sitio público (header, main y footer).
 *
 * El panel de administración se muestra como una app independiente: no monta
 * el Header ni el Footer (ni, por tanto, sus efectos de sesión/notificaciones),
 * de modo que gana todo el alto de pantalla y no parece parte de la web.
 */
export function SiteChrome({ children, lang = 'es' }: { children: React.ReactNode; lang?: string }) {
  const pathname = usePathname()
  const admin = isAdminPath(pathname)

  // El <html lang> lo fija el layout raíz (estático, `lang="es"`), así que en
  // /en el documento se anunciaba como español. El contenido sí puede declarar
  // su idioma: los lectores de pantalla usan el `lang` más cercano y Google
  // pondera el texto según el suyo. No afecta al cacheo porque es un atributo
  // del árbol ya renderizado.
  if (admin) {
    return (
      <div lang={lang}>
        <main id="main-content" className="min-h-screen bg-white">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div lang={lang}>
      <Header />
      <main id="main-content" className="min-h-screen bg-white">
        {children}
      </main>
      <Footer />
    </div>
  )
}
