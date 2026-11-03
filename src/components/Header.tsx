'use client'

import LocalLink from '@/components/LocalLink'
import SiteAnnouncement from '@/components/SiteAnnouncement'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Search, MessageCircle, Zap, ChevronLeft, ChevronDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import BrandLogo from '@/components/BrandLogo'
import Avatar from '@/components/Avatar'
import { useTranslations } from 'next-intl'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { enlaceCambioIdioma } from '@/lib/locale-path'

export function Header() {
  const { user } = useAuth()
  const t = useTranslations()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [creditoBalance, setCreditoBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const creditoChecked = typeof creditoBalance === 'number'
  const [isPWA, setIsPWA] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Locale detection from Next.js pathname (reactive to client-side navigation)
  const pathname = usePathname()
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const altLocaleHref = enlaceCambioIdioma(pathname)
  // En la portada la cabecera flota transparente sobre la fotografía y se
  // solidifica al hacer scroll; en el resto de páginas es siempre sólida.
  const isHome = pathname === '/' || pathname === '/en'
  const overlay = isHome && !scrolled && !mobileOpen && !megaOpen && !searchOpen
  // La portada es nocturna: la cabecera es oscura también tras hacer scroll.
  const homeDark = isHome && !mobileOpen && !megaOpen && !searchOpen

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
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cierra menús al navegar
  useEffect(() => {
    setMobileOpen(false)
    setMegaOpen(false)
    setSearchOpen(false)
  }, [pathname])

  // Escape cierra; el menú móvil y la búsqueda bloquean el scroll del fondo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMegaOpen(false)
        setSearchOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const lock = mobileOpen || searchOpen
    document.body.style.overflow = lock ? 'hidden' : ''
    if (searchOpen) setTimeout(() => searchInput.current?.focus(), 60)
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen, searchOpen])

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

  const openMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current)
    setMegaOpen(true)
  }
  const closeMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current)
    megaTimer.current = setTimeout(() => setMegaOpen(false), 140)
  }

  const onDark = overlay || mobileOpen || homeDark
  const linkTone = onDark
    ? 'text-white/85 hover:text-white'
    : 'text-ink/70 hover:text-ink'
  const navLink = `relative px-3.5 py-2 text-[14.5px] font-medium transition-colors duration-300 ${linkTone}`
  const iconBtn = `flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${onDark ? 'text-white hover:bg-white/15' : 'text-ink hover:bg-ink/8'}`
  const pill = isHome
    ? 'inline-flex h-10 items-center gap-2 bg-[#EDEBE4] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-night transition-colors duration-500 hover:bg-flare'
    : `inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-colors duration-500 ${onDark ? 'bg-white text-ink hover:bg-ember hover:text-white' : 'bg-ink text-white hover:bg-ember'}`

  const mobileLinks = [
    { href: '/catalogo', label: t('header.megaAll') },
    ...familiasNav.flatMap((f) => f.tipos.map((tp) => ({ href: tp.href, label: tp.nombre, sub: true }))),
    { href: '/publicar', label: t('header.navSell') },
    { href: '/cuanto-vale-mi-camper', label: t('header.navValue') },
    { href: '/blog', label: t('header.navGuides') },
    { href: '/marcas', label: t('header.navBrands') },
    { href: '/para-profesionales', label: t('header.navPros') },
  ]

  return (
    <>
      <SiteAnnouncement />
      {/* ============ CABECERA ============ */}
      <header
        className={`sticky top-0 ${mobileOpen ? 'z-[65]' : 'z-50'} h-[72px] transition-[background-color,box-shadow,backdrop-filter] duration-500 ${isHome ? '-mb-[72px]' : ''} ${
          mobileOpen
            ? 'bg-transparent text-white'
            : overlay
            ? 'bg-gradient-to-b from-night/55 to-transparent text-white'
            : homeDark
            ? 'bg-night/70 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl'
            : 'bg-sand-50/85 text-ink shadow-[0_1px_0_rgba(11,20,16,0.08)] backdrop-blur-xl'
        }`}
        onMouseLeave={closeMega}
      >
        <div className="mx-auto flex h-full w-full max-w-[1360px] items-center justify-between gap-6 px-5 sm:px-8">
          <div className="flex items-center gap-2">
            {isPWA && (
              <button onClick={() => window.history.back()} aria-label={t('header.backAria')} className={iconBtn}>
                <ChevronLeft size={22} />
              </button>
            )}
            <BrandLogo href="/" tone={onDark ? 'light' : 'dark'} size="md" showText priority />
          </div>

          {/* Navegación principal (escritorio) */}
          <nav className="hidden items-center lg:flex" aria-label="Principal">
            <div className="relative" onMouseEnter={openMega}>
              <button
                type="button"
                aria-expanded={megaOpen}
                aria-haspopup="true"
                onClick={() => setMegaOpen((v) => !v)}
                className={`${navLink} inline-flex items-center gap-1`}
              >
                {t('header.navBuy')}
                <ChevronDown size={14} className={`transition-transform duration-300 ${megaOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>
            <LocalLink href="/publicar" className={navLink} onMouseEnter={() => setMegaOpen(false)}>{t('header.navSell')}</LocalLink>
            <LocalLink href="/cuanto-vale-mi-camper" className={navLink} onMouseEnter={() => setMegaOpen(false)}>{t('header.navValue')}</LocalLink>
            <LocalLink href="/blog" className={navLink} onMouseEnter={() => setMegaOpen(false)}>{t('header.navGuides')}</LocalLink>
            <LocalLink href="/para-profesionales" className={navLink} onMouseEnter={() => setMegaOpen(false)}>{t('header.navPros')}</LocalLink>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label={t('header.searchAria')} className={iconBtn}>
              <Search size={19} />
            </button>

            <a
              href={altLocaleHref}
              onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref }}
              className={`hidden h-10 items-center rounded-full px-2.5 text-[12px] font-semibold tracking-[0.12em] transition-colors md:flex ${onDark ? 'text-white/80 hover:text-white' : 'text-ink/60 hover:text-ink'}`}
              title={isEn ? 'Español' : 'English'}
              aria-label={isEn ? 'Cambiar a Español' : 'Switch to English'}
            >
              {isEn ? 'ES' : 'EN'}
            </a>

            {user && (
              <LocalLink
                href="/creditos"
                className={`relative hidden h-10 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium transition-colors md:flex ${onDark ? 'text-white hover:bg-white/15' : 'text-ink hover:bg-ink/8'}`}
                title={t('header.creditsTitle')}
              >
                <Zap size={15} className="text-ember" />
                <span className="hidden xl:inline">{t('header.credits')}</span>
                {creditoChecked && creditoBalance !== null && creditoBalance > 0 && (
                  <span className="rounded-full bg-ember px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{creditoBalance}</span>
                )}
              </LocalLink>
            )}

            {user && (
              <LocalLink
                href="/chat"
                aria-label={`${t('header.messages')}${unreadCount > 0 ? ` - ${unreadCount} unread` : ''}`}
                className={`${iconBtn} relative`}
                title={t('header.messages')}
              >
                <MessageCircle size={19} />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </LocalLink>
            )}

            {!user ? (
              <LocalLink href="/login" className={`hidden px-3 py-2 text-[14px] font-medium transition-colors md:inline ${linkTone}`}>
                {t('header.signInShort')}
              </LocalLink>
            ) : (
              <LocalLink href="/dashboard" aria-label={t('header.myPanel')} className="hidden rounded-full sm:block" title={t('header.myPanel')}>
                <Avatar nombre={user?.user_metadata?.nombre || user?.email || 'U'} fotoUrl={user?.user_metadata?.foto_perfil_url || null} size="sm" />
              </LocalLink>
            )}

            <LocalLink href="/publicar" className={`${pill} hidden sm:inline-flex`}>
              {t('header.publishFree')}
              <ArrowUpRight size={15} aria-hidden="true" />
            </LocalLink>

            {!isPWA && (
              <button
                aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
                aria-expanded={mobileOpen}
                className={`${iconBtn} lg:hidden`}
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
          </div>
        </div>

        {/* Mega menú «Comprar» */}
        <div
          className={`absolute inset-x-0 top-full hidden origin-top transition-all duration-300 ease-out lg:block ${megaOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'}`}
          onMouseEnter={openMega}
        >
          <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
            <div className="grid grid-cols-12 gap-10 rounded-b-[28px] bg-sand-50 p-10 text-ink shadow-[0_40px_80px_-30px_rgba(11,20,16,0.45)] ring-1 ring-ink/8">
              <div className="col-span-8 grid grid-cols-3 gap-8">
                {familiasNav.map((f) => (
                  <div key={f.key}>
                    <p className="font-display text-[26px] leading-none">{f.nombre}</p>
                    <ul className="mt-5 space-y-1">
                      {f.tipos.map((tp) => (
                        <li key={tp.id}>
                          <LocalLink href={tp.href} className="group -mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-[15px] font-medium text-ink/75 transition-colors hover:bg-ink/5 hover:text-ink">
                            {tp.nombre}
                            <ArrowRight size={14} className="-translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                          </LocalLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="col-span-4 flex flex-col justify-between rounded-[20px] bg-ink p-7 text-sand-50">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-50/55">{t('header.megaTools')}</p>
                  <ul className="mt-4 space-y-3 text-[15px] font-medium">
                    <li><LocalLink href="/calcular-itp" className="link-draw">{t('header.megaItp')}</LocalLink></li>
                    <li><LocalLink href="/compra-segura-camper" className="link-draw">{t('header.megaSafe')}</LocalLink></li>
                    <li><LocalLink href="/marcas" className="link-draw">{t('header.navBrands')}</LocalLink></li>
                  </ul>
                </div>
                <LocalLink href="/catalogo" className="group mt-8 inline-flex items-center justify-between gap-3 rounded-full bg-ember px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-white hover:text-ink">
                  {t('header.megaAll')}
                  <ArrowUpRight size={16} className="transition-transform duration-500 group-hover:rotate-45" aria-hidden="true" />
                </LocalLink>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Fondo atenuado bajo el mega menú */}
      <div
        className={`fixed inset-0 top-[72px] z-40 hidden bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 lg:block ${megaOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onMouseEnter={() => setMegaOpen(false)}
        aria-hidden="true"
      />

      {/* ============ BÚSQUEDA ============ */}
      <div
        className={`fixed inset-0 z-[70] transition-opacity duration-300 ${searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('header.searchTitle')}
        aria-hidden={!searchOpen}
      >
        <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
        <div className={`relative bg-sand-50 text-ink shadow-2xl transition-transform duration-500 ease-out ${searchOpen ? 'translate-y-0' : '-translate-y-8'}`}>
          <div className="mx-auto max-w-[1100px] px-5 pb-14 pt-8 sm:px-8 sm:pt-10">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink/50">{t('header.navSearch')}</p>
              <button onClick={() => setSearchOpen(false)} aria-label={t('header.searchClose')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/8">
                <X size={20} />
              </button>
            </div>
            <form action={isEn ? '/en/buscar' : '/buscar'} method="GET" className="mt-6">
              <label htmlFor="header-search" className="sr-only">{t('header.searchAria')}</label>
              <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
                <Search size={28} className="shrink-0 text-ink/40" aria-hidden="true" />
                <input
                  ref={searchInput}
                  id="header-search"
                  type="text"
                  name="q"
                  autoComplete="off"
                  placeholder={t('header.searchTitle')}
                  className="font-display w-full bg-transparent text-[clamp(1.8rem,5vw,3.6rem)] leading-none text-ink placeholder:text-ink/30 focus:outline-none focus:shadow-none"
                />
                <button type="submit" className="hidden h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-white transition-colors hover:bg-ember sm:inline-flex">
                  {t('header.navSearch')} <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-3 text-[13px] text-ink/45">{t('header.searchHint')}</p>
            </form>
            <p className="mt-10 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink/50">{t('header.popular')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Ducato', 'California', 'Hymer', 'Gran volumen', 'Overland', 'Knaus'].map((q) => (
                <LocalLink key={q} href={`/buscar?q=${encodeURIComponent(q)}`} className="rounded-full border border-ink/15 px-4 py-2 text-[14px] font-medium transition-colors hover:border-ink hover:bg-ink hover:text-white">
                  {q}
                </LocalLink>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ MENÚ MÓVIL ============ */}
      {!isPWA && (
        <div
          data-lenis-prevent className={`fixed inset-0 z-[60] overflow-y-auto bg-ink text-sand-50 transition-all duration-500 ease-out lg:hidden ${mobileOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
          aria-hidden={!mobileOpen}
        >
          <div className="px-5 pb-16 pt-[96px]">
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {mobileLinks.map((l, i) => (
                <li key={l.href + l.label}>
                  <LocalLink
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between py-4 ${(l as any).sub ? 'pl-4 text-[17px] text-sand-50/70' : 'font-display text-[30px] leading-none'}`}
                    style={{ transitionDelay: `${i * 25}ms` }}
                  >
                    {l.label}
                    <ArrowUpRight size={(l as any).sub ? 15 : 20} className="text-white/40" aria-hidden="true" />
                  </LocalLink>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3">
              <LocalLink href="/publicar" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 rounded-full bg-ember py-4 text-[16px] font-semibold text-white">
                {t('header.publishFree')} <ArrowUpRight size={17} aria-hidden="true" />
              </LocalLink>
              {!user ? (
                <>
                  <LocalLink href="/login" onClick={() => setMobileOpen(false)} className="rounded-full border border-white/25 py-4 text-center text-[16px] font-semibold">{t('header.signIn')}</LocalLink>
                  <LocalLink href="/register" onClick={() => setMobileOpen(false)} className="py-2 text-center text-[15px] text-sand-50/70 underline underline-offset-4">{t('header.signUpFree')}</LocalLink>
                </>
              ) : (
                <>
                  <LocalLink href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-full border border-white/25 py-4 text-center text-[16px] font-semibold">{t('header.myPanel')}</LocalLink>
                  <LocalLink href="/creditos" onClick={() => setMobileOpen(false)} className="py-2 text-center text-[15px] text-sand-50/70">
                    {t('header.credits')}{creditoChecked && creditoBalance !== null && creditoBalance > 0 ? t('header.creditsAvailable').replace('{count}', String(creditoBalance)) : ''}
                  </LocalLink>
                </>
              )}
              <a
                href={altLocaleHref}
                onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref }}
                className="py-2 text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-sand-50/50"
              >
                {isEn ? 'Español' : 'English'}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
