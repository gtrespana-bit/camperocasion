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
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden"
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
                <div className="w-14 h-14 bg-brand-accent rounded-full flex items-center justify-center shadow-lg shadow-yellow-200 active:scale-95 transition-transform">
                  <Icon size={26} className="text-brand-primary" />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Icon
                    size={22}
                    className={isActive ? 'text-brand-primary' : 'text-gray-500'}
                  />
                  <span
                    className={`text-[10px] mt-0.5 font-medium ${
                      isActive ? 'text-brand-primary' : 'text-gray-500'
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
