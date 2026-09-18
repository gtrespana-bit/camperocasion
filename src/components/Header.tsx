'use client'

import LocalLink from '@/components/LocalLink'
import SiteAnnouncement from '@/components/SiteAnnouncement'
import Image from 'next/image'
import { useState, useEffect, Fragment } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Search, PlusCircle, MessageCircle, Zap, ChevronLeft, Globe } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { useTranslations } from 'next-intl'
import { categoriasData, FAMILIAS } from '@/lib/categorias'

export function Header() {
  const { user } = useAuth()
  const t = useTranslations()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [creditoBalance, setCreditoBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const creditoChecked = typeof creditoBalance === 'number'
  const [isPWA, setIsPWA] = useState(false)

  // Locale detection from Next.js pathname (reactive to client-side navigation)
  const pathname = usePathname()
  const isEn = pathname.startsWith('/en')
  const altLocaleHref = isEn
    ? (pathname.replace(/^\/en(?=\/|$)/, '') || '/')
    : `/en${pathname === '/' ? '' : pathname}`

  // Subcategorías camper (mercado vertical 100% camper)
  // Navegación del vertical camper: familias (Campers / Autocaravanas /
  // Overland) con sus tipos dentro. La categoría única `camper` no se expone.
  const familiasNav = FAMILIAS.map(f => ({
    key: f.key,
    icon: f.icon,
    nombre: t(`familias.${f.key}.label`),
    tipos: f.subs
      .map(slug => categoriasData.camper.subs.find(s => s.slug === slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map(s => ({
        id: s.slug,
        nombre: s.label,
        icon: s.icon,
        href: `/catalogo?subcategoria=${encodeURIComponent(s.label)}`,
      })),
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches)
    if ('standalone' in window.navigator && !(window.navigator as any).standalone === false) {
      setIsPWA(true)
    }
  }, [])

  // Consolidated fetch: credit balance + unread count in single query
  // ✅ PERFORMANCE FIX: Add timeout to prevent hanging requests
  // ✅ FIX: @supabase/supabase-js se importa de forma DINÁMICA (solo cuando
  // hay sesión) para no arrastrar el cliente de Supabase al bundle inicial
  // de TODAS las páginas. Solo se descarga cuando el usuario está logueado.
  useEffect(() => {
    if (!user) return

    let cancelled = false
    let timeoutId: NodeJS.Timeout
    const controller = new AbortController()
    let sb: any = null
    let channel: { unsubscribe: () => void } | null = null
    let bc: BroadcastChannel | null = null

    async function fetchAll() {
      if (!sb) return
      // Timeout after 5 seconds
      timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const [profileResponse, unreadResult] = await Promise.all([
          fetch('/api/perfil', { signal: controller.signal }),
          sb.from('mensajes').select('id', { count: 'exact', head: true }).eq('destinatario_id', user!.id).eq('leido', false).abortSignal(controller.signal),
        ])
        if (!profileResponse.ok) throw new Error('No se pudo cargar el perfil')
        const profileJson = await profileResponse.json()

        // Clear timeout on success
        clearTimeout(timeoutId)

        setCreditoBalance(profileJson.profile?.credito_balance ?? 0)
        setUnreadCount(unreadResult.count || 0)
      } catch (error: any) {
        // Clear timeout on error
        clearTimeout(timeoutId)
        
        // Reset on abort or network error
        if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
          setCreditoBalance(0)
          setUnreadCount(0)
        }
      }
    }

    async function init() {
      try {
        ;({ supabase: sb } = await import('@/lib/supabase'))
      } catch {
        return
      }
      if (cancelled) return

      fetchAll()

      // Realtime subscription for unread messages
      channel = sb
        .channel('header-unread')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${user!.id}` },
          () => fetchAll()
        )
        .subscribe()

      bc = new BroadcastChannel('camperocasion_unread_sync')
      bc.onmessage = () => fetchAll()
    }

    init()

    return () => {
      cancelled = true
      if (channel) sb?.removeChannel(channel)
      bc?.close()
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [user])

  // ✅ FIX: Don't block the entire header while auth loads.
  // Treat loading as guest → render immediately → update when session resolves.
  // Los créditos solo se muestran a usuarios con sesión: para un visitante
  // nuevo, el acceso a "Créditos" en el header sugiere que hay que pagar para
  // publicar (la monetización se descubre en su contexto, p. ej. /creditos
  // desde el dashboard o la home, nunca como acción primaria del header).
  return (
    <>
      <SiteAnnouncement />
      {/* ============ HEADER PRINCIPAL ============ */}
      <header className="bg-gradient-to-r from-brand-dark via-brand-primary to-brand-primary text-white relative sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Back button — PWA only */}
            {isPWA && (
              <button 
                onClick={() => window.history.back()} 
                aria-label={t('header.backAria')}
                className="p-1 hover:bg-white/10 rounded-lg transition text-white/80"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {/* Logo */}
            <LocalLink href="/" className="flex items-center gap-3 flex-shrink-0">
              <Image
                src="/logo-camperocasion.png"
                alt="CamperOcasión"
                width={44}
                height={44}
                className="h-11 w-auto drop-shadow-[0_0_6px_rgba(255,255,255,0.5)] bg-white/10 p-0.5 rounded-lg backdrop-blur"
                fetchPriority="high"
                decoding="async"
              />
              <span className="hidden sm:block">
                <span className="font-black text-xl tracking-tight">
                  <span className="text-white">Camper</span><span className="text-green-400">Ocasión</span>
                </span>
              </span>
            </LocalLink>

            {/* Search (desktop) */}
            <form action="/buscar" method="GET" className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <label htmlFor="header-search" className="sr-only">{t('header.searchAria')}</label>
              <input
                id="header-search"
                type="text"
                name="q"
                placeholder={t('header.searchPlaceholder')}
                className="w-full py-2 px-4 pr-12 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              <button 
                type="submit" 
                aria-label={t('header.searchAria')}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand-accent p-1.5 rounded-full hover:bg-accent/90 transition"
              >
                <Search size={18} className="text-brand-primary" />
              </button>
            </form>

            {/* Actions (desktop) */}
            <div className="flex items-center gap-2">
              {/* Language toggle - full page reload to avoid root layout hydration mismatch */}
              <a
                href={altLocaleHref}
                onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref; }}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-white/10 rounded-lg transition text-white/90"
                title={isEn ? 'Español' : 'English'}
                aria-label={isEn ? 'Cambiar a Español' : 'Switch to English'}
              >
                <Globe size={16} />
                <span className="text-xs font-medium">{isEn ? 'ES' : 'EN'}</span>
              </a>

              {/* Credits — solo usuarios con sesión */}
              {user && (
              <>
              <LocalLink href="/creditos" className="relative hidden md:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm font-medium transition" title={t('header.creditsTitle')}>
                <Zap size={16} className="text-brand-accent" />
                <span className="hidden lg:inline">{t('header.credits')}</span>
                {creditoChecked && creditoBalance !== null && creditoBalance > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-accent text-brand-dark text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{creditoBalance}</span>
                )}
              </LocalLink>
              <LocalLink
                href="/creditos"
                aria-label={t('header.credits')}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition relative"
                title={t('header.credits')}
              >
                <Zap size={20} className="text-brand-accent" />
                {creditoChecked && creditoBalance !== null && creditoBalance > 0 && (
                  <span className="absolute top-0 right-0 bg-brand-accent text-brand-dark text-[9px] font-black px-1 rounded-full min-w-[16px] text-center leading-4">{creditoBalance}</span>
                )}
              </LocalLink>
              </>
              )}

              {/* Language toggle for mobile - full page reload */}
              <a
                href={altLocaleHref}
                onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref; }}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
                title={isEn ? 'Español' : 'English'}
                aria-label={isEn ? 'Cambiar a Español' : 'Switch to English'}
              >
                <span className="text-lg" aria-hidden="true">{isEn ? '🇪🇸' : '🇺🇸'}</span>
              </a>

              {!user ? (
                <>
                  <LocalLink href="/login" className="hidden md:inline px-3 py-2 text-sm font-medium hover:text-brand-accent transition">{t('header.signIn')}</LocalLink>
                  <LocalLink href="/register" className="hidden md:inline bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition">{t('header.signUp')}</LocalLink>
                  {!isPWA && (
                    <button 
                      aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
                      className="md:hidden p-2 hover:bg-white/10 rounded-lg transition" 
                      onClick={() => setMobileOpen(!mobileOpen)}
                    >
                      {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <LocalLink href="/publicar" className="hidden md:flex items-center gap-1 bg-brand-accent text-white px-3 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition">
                    <PlusCircle size={16} /> {t('header.publish')}
                  </LocalLink>
                  <LocalLink 
                    href="/chat" 
                    aria-label={`${t('header.messages')}${unreadCount > 0 ? ` - ${unreadCount} unread` : ''}`}
                    className="relative p-2 hover:bg-white/10 rounded-lg transition" 
                    title={t('header.messages')}
                  >
                    <MessageCircle size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-brand-dark text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                  </LocalLink>
                  <LocalLink 
                    href="/dashboard" 
                    aria-label={t('header.myPanel')}
                    className="hidden sm:block p-1 hover:bg-white/10 rounded-lg transition" 
                    title={t('header.myPanel')}
                  >
                    <Avatar nombre={user?.user_metadata?.nombre || user?.email || 'U'} fotoUrl={user?.user_metadata?.foto_perfil_url || null} size="sm" />
                  </LocalLink>
                  {!isPWA && (
                    <button 
                      aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
                      className="md:hidden p-2 hover:bg-white/10 rounded-lg transition" 
                      onClick={() => setMobileOpen(!mobileOpen)}
                    >
                      {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile menu — mobile browser only, NOT in PWA */}
          {!isPWA && mobileOpen && (
            <div className="md:hidden pb-4 animate-fadeIn">
              <form action="/buscar" method="GET" className="mb-3">
                <label htmlFor="mobile-search" className="sr-only">{t('header.searchAria')}</label>
                <input 
                  id="mobile-search"
                  type="text" 
                  name="q" 
                  placeholder={t('header.searchPlaceholder')} 
                  className="w-full py-2.5 px-4 rounded-lg text-gray-800 bg-white" 
                />
              </form>
              <nav className="flex flex-col gap-1">
                {!user ? (
                  <>
                    <LocalLink href="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">{t('header.signIn')}</LocalLink>
                    <LocalLink href="/register" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg bg-brand-accent text-white font-bold text-center transition">{t('header.signUpFree')}</LocalLink>
                  </>
                ) : (
                  <>
                    <LocalLink href="/publicar" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg bg-brand-accent text-white font-bold text-center transition">📢 {t('header.publishSomething')}</LocalLink>
                    <LocalLink href="/chat" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">💬 {t('header.messages')}{unreadCount > 0 ? t('header.messagesWithCount').replace('{count}', String(unreadCount)) : ''}</LocalLink>
                    <LocalLink href="/dashboard" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">👤 {t('header.myPanel')}</LocalLink>
                    <LocalLink href="/creditos" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">⚡ {t('header.credits')}{creditoChecked && creditoBalance !== null && creditoBalance > 0 ? t('header.creditsAvailable').replace('{count}', String(creditoBalance)) : ''}</LocalLink>
                  </>
                )}
                <LocalLink href="/blog" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">📝 {t('header.blog')}</LocalLink>
                <LocalLink href="/catalogo" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">{t('header.viewCatalog')}</LocalLink>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ============ SUB-HEADER: FAMILIAS → TIPOS ============ */}
      <div className="hidden md:block bg-white border-b border-gray-200 shadow-sm sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 h-11 overflow-x-auto hide-scrollbar">
            <LocalLink
              href="/catalogo"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition font-bold whitespace-nowrap text-brand-primary bg-green-50 hover:bg-green-100"
            >
              <span className="text-base">🔍</span>
              {t('header.allCategories')}
            </LocalLink>

            {familiasNav.map((f) => (
              <Fragment key={f.key}>
                <span aria-hidden="true" className="mx-1 text-gray-300 select-none">•</span>
                <span className="flex items-center gap-1 px-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 whitespace-nowrap">
                  <span className="text-sm">{f.icon}</span> {f.nombre}
                </span>
                {f.tipos.map((tipo) => (
                  <LocalLink
                    key={tipo.id}
                    href={tipo.href}
                    className="flex items-center gap-1.5 px-2.5 py-2 text-sm rounded-lg transition font-medium whitespace-nowrap text-gray-600 hover:text-brand-accent-dark hover:bg-green-50"
                  >
                    <span className="text-base">{tipo.icon}</span>
                    {tipo.nombre}
                  </LocalLink>
                ))}
              </Fragment>
            ))}

            <span aria-hidden="true" className="mx-1 text-gray-300 select-none">•</span>
            <LocalLink
              href="/marcas"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition font-medium whitespace-nowrap text-gray-600 hover:text-brand-accent-dark hover:bg-green-50"
            >
              <span className="text-base">🏷️</span>
              {t('header.brands')}
            </LocalLink>
          </div>
        </div>
      </div>
    </>
  )
}
