"use client"

import { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Package, MessageSquare, CreditCard, Eye, Heart, LogOut, X, Zap, Star, ShieldCheck, BarChart3, Settings, CalendarClock, ClipboardCheck, Store } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { routing } from '@/i18n/routing'

// Components
import DashboardHeader from './components/DashboardHeader'
import TabResumen from './components/TabResumen'
import TabMensajes from './components/tabs/TabMensajes'
import TabCreditos from './components/tabs/TabCreditos'
import TabFavoritos from './components/tabs/TabFavoritos'
import BoostModal from './components/modals/BoostModal'
import DestacadoModal from './components/modals/DestacadoModal'

// Lazy-load heavy tabs
const TabProductos = lazy(() => import('./components/tabs/TabProductos'))
const TabReservas = lazy(() => import('./components/tabs/TabReservas'))
const TabInspecciones = lazy(() => import('./components/tabs/TabInspecciones'))
const TabTienda = lazy(() => import('./components/tabs/TabTienda'))
const SolicitarVerificacion = dynamic(() => import('@/components/SolicitarVerificacion'), { ssr: false })
const TabReputacion = dynamic(() => import('./components/tabs/TabReputacion'), { ssr: false })

// Hooks
import { useDashboard } from './hooks/useDashboard'
import { supabase } from '@/lib/supabase'

function PasswordModal({ user, setToast, onClose }: { user: any; setToast: (s: string | null) => void; onClose: () => void }) {
  const t = useTranslations('dashboard')
  const [pwActual, setPwActual] = useState('')
  const [pwNueva, setPwNueva] = useState('')
  const [pwRepetir, setPwRepetir] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwGuardando, setPwGuardando] = useState(false)

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwNueva !== pwRepetir) { setPwError(t('pwMismatch')); return }
    if (pwNueva.length < 8) { setPwError(t('pwMinLength')); return }
    setPwGuardando(true)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: pwActual,
    })
    if (signInError || !signInData.user) {
      setPwError(t('pwWrong'))
      setPwGuardando(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: pwNueva })
    if (error) {
      setPwError(error.message)
    } else {
      setToast(t('pwSuccess'))
    }
    setPwGuardando(false)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">{t('passwordTitle')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        {pwError && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">⚠️ {pwError}</div>}
        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwCurrent')}</label>
            <input type="password" value={pwActual} onChange={e => setPwActual(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwCurrentPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwNew')}</label>
            <input type="password" value={pwNueva} onChange={e => setPwNueva(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwNewPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwRepeat')}</label>
            <input type="password" value={pwRepetir} onChange={e => setPwRepetir(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwRepeatPlaceholder')} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50">{t('cancelEdit')}</button>
            <button type="submit" disabled={pwGuardando} className="flex-1 py-3 bg-brand-primary text-white rounded-lg font-bold hover:bg-brand-dark disabled:opacity-50">{pwGuardando ? t('pwSaving') : t('pwChange')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const data = useDashboard()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState('resumen')
  const [cambiarPw, setCambiarPw] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [boostTarget, setBoostTarget] = useState<{ productId: string; titulo: string } | null>(null)
  const [destacadoTarget, setDestacadoTarget] = useState<{ productId: string; titulo: string } | null>(null)

  // Read tab from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab) setActiveTab(tab)
  }, [])

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) { data.setToast(t('imageTooLarge')); return }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', user.id)

    const res = await fetch('/api/foto-perfil', {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()

    if (!res.ok) {
      data.setToast(t('photoError') + json.error)
      return
    }

    data.setFotoUrl(json.url)
  }

  // Build locale-aware redirect path
  const redirectPath = (path: string) => {
    const currentLocale = (() => {
      for (const locale of routing.locales) {
        if (locale === routing.defaultLocale) continue
        if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale
      }
      return routing.defaultLocale
    })()
    if (currentLocale === routing.defaultLocale) return path
    return `/${currentLocale}${path === '/' ? '' : path}`
  }

  async function handleLogout() {
    // ✅ FIX: Call API route to clear server-side cookies,
    // then signOut from singleton to clear localStorage + notify AuthProvider
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue even if API call fails
    }
    await supabase.auth.signOut()
    router.push(redirectPath('/'))
  }

  async function handleBoost(productId: string) {
    // Igual que el destacado: el boost lo aplica el servidor y de paso
    // invalida la caché para que el anuncio suba al primer puesto al instante.
    const res = await fetch('/api/productos/promocionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, tipo: 'boost' }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result?.ok) {
      data.setToast(`Error: ${result?.error || t('boostError')}`)
    } else {
      data.setCreditos(result.balance)
      data.setToast(t('boostApplied'))
      const { data: prods } = await supabase.from('productos').select('id, slug, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, imagen_url, destacado, destacado_hasta, boosteado_en, estado_moderacion, vendido, vendido_en, comprador_id').eq('user_id', user!.id).order('creado_en', { ascending: false })
      data.setProductos(prods || [])
    }
    setBoostTarget(null)
    setTimeout(() => data.setToast(null), 4000)
  }

  async function handleDestacar(productId: string, horas: number) {
    // El cobro va por el servidor: además de descontar los créditos invalida
    // la portada y el catálogo, así que el anuncio aparece destacado al
    // instante (antes el usuario pagaba y seguía viéndolo sin destacar).
    const res = await fetch('/api/productos/promocionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, tipo: 'destacado', horas }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result?.ok) {
      data.setToast(`Error: ${result?.error || t('featuredError')}`)
    } else {
      data.setCreditos(result.balance)
      data.setToast(t('featuredActivated', { hours: horas }))
      const { data: prods } = await supabase.from('productos').select('id, slug, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, imagen_url, destacado, destacado_hasta, boosteado_en, estado_moderacion, vendido, vendido_en, comprador_id').eq('user_id', user!.id).order('creado_en', { ascending: false })
      data.setProductos(prods || [])
    }
    setDestacadoTarget(null)
    setTimeout(() => data.setToast(null), 4000)
  }

  if (authLoading) {
    // Show loading state while authentication is being resolved
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('loginRequired')}</h2>
          <p className="text-gray-500 mb-6">{t('loginRequiredDesc')}</p>
          <LocalLink href="/login" className="inline-block bg-brand-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-brand-dark transition">{t('loginButton')}</LocalLink>
        </div>
      </div>
    )
  }

  const numPubsVendidas = data.productos.filter((p: any) => !p.activo && p.estado_moderacion !== 'rechazado').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Toast */}
      {data.toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium animate-bounce max-w-xs">
          {data.toast}
        </div>
      )}

      {/* Modals */}
      {boostTarget && (
        <BoostModal
          titulo={boostTarget.titulo}
          onClose={() => setBoostTarget(null)}
          onBoost={() => handleBoost(boostTarget.productId)}
        />
      )}
      {destacadoTarget && (
        <DestacadoModal
          titulo={destacadoTarget.titulo}
          creditos={data.creditos}
          onClose={() => setDestacadoTarget(null)}
          onDestacar={(h) => handleDestacar(destacadoTarget.productId, h)}
        />
      )}
      {cambiarPw && (
        <PasswordModal user={user} setToast={data.setToast} onClose={() => setCambiarPw(false)} />
      )}

      {/* Header */}
      <DashboardHeader
        user={user}
        nombre={data.nombre} setNombre={data.setNombre}
        telefono={data.telefono} setTelefono={data.setTelefono}
        estado={data.estado} setEstado={data.setEstado}
        ciudad={data.ciudad} setCiudad={data.setCiudad}
        tipoVendedor={data.tipoVendedor} setTipoVendedor={data.setTipoVendedor}
        fotoUrl={data.fotoUrl} setFotoUrl={data.setFotoUrl}
        verificado={data.verificado}
        nivelConfianza={data.nivelConfianza}
        resenasCount={data.resenas.length}
        promedioResenas={data.promedioResenas}
        setToast={data.setToast}
        setGuardando={setGuardandoPerfil}
        onPassword={() => setCambiarPw(true)}
        onLogout={handleLogout}
        onFotoChange={handleFoto}
      />

      {/* Resumen */}
      <div className="bg-gradient-to-r from-brand-primary to-blue-800 rounded-xl p-5 text-white mb-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">{t('performance')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div>
            <p className="text-2xl font-black">{data.visitasTotales}</p>
            <p className="text-xs text-blue-200">{t('totalViews')}</p>
          </div>
          <div>
            <p className="text-2xl font-black">{data.productos.length ? Math.round(data.visitasTotales / data.productos.length) : 0}</p>
            <p className="text-xs text-blue-200">{t('avgPerProduct')}</p>
          </div>
          <div>
            <p className="text-2xl font-black">{data.pubCount}</p>
            <p className="text-xs text-blue-200">{t('activeProducts')}</p>
          </div>
          <div>
            <p className="text-2xl font-black">{data.productos.filter((p: any) => p.boosteado_en || (p.destacado && p.destacado_hasta > new Date().toISOString())).length}</p>
            <p className="text-xs text-blue-200">{t('promotedNow')}</p>
          </div>
          <div>
            <p className="text-2xl font-black">{data.favoritosCount}</p>
            <p className="text-xs text-blue-200">{t('favorites')}</p>
          </div>
          <div>
            <p className="text-2xl font-black">{data.creditos}</p>
            <p className="text-xs text-blue-200">{t('creditsLabel')}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span>{t('freeCredit')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>{t('pubProgress', { count: data.pubCount })}</span>
              <div className="w-24 bg-white/30 rounded-full h-1.5">
                <div className="bg-brand-accent h-1.5 rounded-full transition-all" style={{ width: `${Math.min((data.pubCount / 10) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar mb-6 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'resumen', label: t('tabSummary'), icon: BarChart3 },
          { id: 'productos', label: t('tabListings'), icon: Package },
          { id: 'mensajes', label: t('tabMessages'), icon: MessageSquare },
          { id: 'creditos', label: t('tabCredits'), icon: CreditCard },
          { id: 'reservas', label: t('tabReservations'), icon: CalendarClock },
          { id: 'inspecciones', label: t('tabInspecciones'), icon: ClipboardCheck },
          { id: 'tienda', label: 'Mi tienda', icon: Store },
          { id: 'favoritos', label: t('tabFavorites'), icon: Heart },
          { id: 'verificacion', label: t('tabVerification'), icon: ShieldCheck },
          { id: 'reputacion', label: t('tabReputation'), icon: Star },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === item.id ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'resumen' && <TabResumen userId={user!.id} />}
      {activeTab === 'productos' && (
        <Suspense fallback={<div className="p-12 text-center text-gray-500">{t('loadingListings')}</div>}>
          <TabProductos
            productos={data.productos}
            onBoost={setBoostTarget}
            onDestacar={setDestacadoTarget}
            userId={user?.id ?? ''}
          />
        </Suspense>
      )}
      {activeTab === 'mensajes' && <TabMensajes />}
      {activeTab === 'creditos' && (
        <TabCreditos creditos={data.creditos} refreshCreditos={data.refreshAll} />
      )}
      {activeTab === 'reservas' && (
        <Suspense fallback={<div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">Cargando…</div>}>
          <TabReservas userId={user!.id} />
        </Suspense>
      )}
      {activeTab === 'inspecciones' && (
        <Suspense fallback={<div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">Cargando…</div>}>
          <TabInspecciones />
        </Suspense>
      )}
      {activeTab === 'tienda' && (
        <Suspense fallback={<div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">Cargando…</div>}>
          <TabTienda />
        </Suspense>
      )}
      {activeTab === 'favoritos' && <TabFavoritos favoritos={data.favoritos} />}
      {activeTab === 'verificacion' && <SolicitarVerificacion />}
      {activeTab === 'reputacion' && (
        <TabReputacion
          verificado={data.verificado}
          nivelConfianza={data.nivelConfianza}
          badgesAuto={data.badgesAuto}
          resenas={data.resenas}
          promedioResenas={data.promedioResenas}
          numPubsActivas={data.pubCount}
          numPubsVendidas={numPubsVendidas}
          creadoEn={data.creadoEn}
          ultimaActividad={data.ultimaActividad}
        />
      )}
    </div>
  )
}
