'use client'

import { usePathname } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Barra de navegación inferior.
 *
 * Antes solo se montaba en modo PWA, pero la gran mayoría del tráfico móvil
 * llega por enlace compartido (WhatsApp, Google) directamente al navegador.
 * Ahí el botón grande de "Publicar" —el patrón que mejor convierte en móvil—
 * no existía. Ahora se muestra en todo móvil (PWA y navegador) y desaparece
 * en escritorio (md:hidden).
 */
export default function BottomTabNav() {
  const pathname = usePathname()
  const t = useTranslations()

  const navItems = [
    { href: '/', icon: Home, label: t('bottomNav.home') },
    { href: '/buscar', icon: Search, label: t('bottomNav.search') },
    { href: '/publicar', icon: PlusCircle, label: t('bottomNav.publish'), highlight: true },
    { href: '/chat', icon: MessageCircle, label: t('bottomNav.chat') },
    { href: '/dashboard', icon: User, label: t('bottomNav.profile') },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-night/95 backdrop-blur-xl border-t border-white/10 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      role="navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/dashboard')
          return (
            <LocalLink
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition ${
                item.highlight ? '-mt-4' : ''
              }`}
            >
              {item.highlight ? (
                <div className="w-14 h-14 bg-leaf rounded-full flex items-center justify-center shadow-[0_10px_24px_-6px_rgba(22,163,74,0.55)] active:scale-95 transition-transform">
                  <Icon size={26} className="text-white" />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Icon
                    size={22}
                    className={isActive ? 'text-white' : 'text-white/50'}
                  />
                  <span
                    className={`text-[10px] mt-0.5 font-medium ${
                      isActive ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </LocalLink>
          )
        })}
      </div>
    </nav>
  )
}
