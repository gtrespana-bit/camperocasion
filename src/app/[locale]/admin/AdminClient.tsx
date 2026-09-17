'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, Package, ShieldAlert, Users, ShieldCheck, CreditCard, History,
  Tag, Megaphone, Download, Settings2, LogIn, LogOut, ArrowLeft, Menu, X, Sparkles, FileCheck2, Handshake,
  ClipboardCheck, FileSignature,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { useAuth } from '@/components/AuthProvider'
import { ADMIN_EMAILS } from '@/lib/admin-config'
import AdminDashboard from './components/AdminDashboard'
import AdminPublicaciones from './components/AdminPublicaciones'
import AdminUsuarios from './components/AdminUsuarios'
import AdminModeracion from './components/AdminModeracion'
import AdminTransacciones from './components/AdminTransacciones'
import AdminAuditoria from './components/AdminAuditoria'
import AdminCategorias from './components/AdminCategorias'
import AdminComunicacion from './components/AdminComunicacion'
import AdminExportar from './components/AdminExportar'
import AdminAjustes from './components/AdminAjustes'
import VerificacionTab from './VerificacionTab'
import AdminHomologacion from './AdminHomologacion'
import AdminReservas from './AdminReservas'
import AdminInspecciones from './AdminInspecciones'
import AdminGestoria from './AdminGestoria'
import { Badge } from './components/AdminUi'
import { apiJson, type Perfil } from './components/admin-utils'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Vista general' },
  { id: 'publicaciones', label: 'Publicaciones', icon: Package, description: 'Gestión de productos' },
  { id: 'moderacion', label: 'Moderación', icon: ShieldAlert, description: 'Reportes y pendientes' },
  { id: 'usuarios', label: 'Usuarios', icon: Users, description: 'Perfiles y créditos' },
  { id: 'verificacion', label: 'Verificación', icon: ShieldCheck, description: 'Vendedores' },
  { id: 'homologacion', label: 'Homologación', icon: FileCheck2, description: 'Expediente del vehículo' },
  { id: 'reservas', label: 'Reservas', icon: Handshake, description: 'Reservas con señal' },
  { id: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck, description: 'Inspección precompra' },
  { id: 'gestoria', label: 'Gestoría', icon: FileSignature, description: 'Cambio de nombre DGT' },
  { id: 'transacciones', label: 'Transacciones', icon: CreditCard, description: 'Pagos y créditos' },
  { id: 'auditoria', label: 'Auditoría', icon: History, description: 'Historial de cambios' },
  { id: 'categorias', label: 'Categorías', icon: Tag, description: 'Organización' },
  { id: 'comunicacion', label: 'Comunicación', icon: Megaphone, description: 'Banners del sitio' },
  { id: 'exportar', label: 'Exportar', icon: Download, description: 'CSV y JSON' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2, description: 'Salud del sistema' },
]

export default function AdminPage() {
  const { user, session, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const [counts, setCounts] = useState({ transacciones: 0, publicaciones: 0, moderacion: 0, verificacion: 0, homologacion: 0, inspecciones: 0, gestoria: 0 })

  const isAdmin = ADMIN_EMAILS.includes((user?.email || '').toLowerCase())
  const activeNav = NAV.find((n) => n.id === tab) || NAV[0]

  function notify(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!session || !user) return
    if (!isAdmin) {
      setToast('No tienes permisos de admin')
      setTimeout(() => router.push('/'), 1500)
      return
    }
    const urlTab = searchParams?.get('tab')
    if (urlTab && NAV.some((n) => n.id === urlTab)) setTab(urlTab)
  }, [user, session, isAdmin, searchParams, router])

  async function loadPerfiles() {
    try {
      const res = await apiJson<{ ok: boolean; usuarios: Perfil[] }>('/api/admin/usuarios')
      const m: Record<string, Perfil> = {}
      ;(res.usuarios || []).forEach((p) => (m[p.id] = p))
      setPerfiles(m)
    } catch {
      // El panel puede seguir funcionando sin el enriquecimiento.
    }
  }

  async function loadCounts() {
    try {
      const res = await fetch('/api/admin/counts', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) return
      const c = json.counts || {}
      setCounts({
        transacciones: c.transacciones || 0,
        publicaciones: c.publicaciones || 0,
        moderacion: (c.publicaciones || 0) + (c.denuncias || 0),
        verificacion: c.verificacion || 0,
        homologacion: c.homologacion || 0,
        inspecciones: c.inspecciones || 0,
        gestoria: c.gestoria || 0,
      })
    } catch {
      // Sin contadores la navegación sigue disponible.
    }
  }

  useEffect(() => {
    if (isAdmin && session) {
      loadPerfiles()
      loadCounts()
    }
  }, [isAdmin, session, tab])

  function navigate(next: string) {
    setTab(next)
    setMobileOpen(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', next)
      window.history.replaceState(null, '', url.toString())
    }
  }

  async function handleLogout() {
    try {
      const { supabase } = await import('@/lib/supabase')
      await supabase.auth.signOut()
    } catch {
      // continuar con el logout del servidor
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST', keepalive: true })
    } catch {
      // no crítico
    }
    window.location.href = '/'
  }

  function badgeFor(tabKey: string): number {
    if (tabKey === 'transacciones') return counts.transacciones
    if (tabKey === 'publicaciones') return counts.publicaciones
    if (tabKey === 'moderacion') return counts.moderacion
    if (tabKey === 'verificacion') return counts.verificacion
    if (tabKey === 'homologacion') return counts.homologacion
    if (tabKey === 'inspecciones') return (counts as any).inspecciones || 0
    if (tabKey === 'gestoria') return (counts as any).gestoria || 0
    return 0
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <div className="text-center text-gray-600">
          <span className="mx-auto mb-3 inline-block h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <p>Comprobando tu sesión…</p>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary"><ShieldCheck size={22} /></span>
          <h1 className="text-2xl font-black text-gray-800">Inicia sesión para continuar</h1>
          <p className="mt-3 text-gray-600">El panel administrativo está disponible únicamente para usuarios autorizados.</p>
          <button
            type="button"
            onClick={() => router.push('/login?redirect=/admin')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          >
            <LogIn size={18} /> Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-black text-gray-800">🔒 Acceso denegado</h2>
          <p className="text-gray-500">No tienes permisos para esta página.</p>
          <button onClick={() => router.push('/')} className="mt-4 text-brand-primary hover:underline">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div role="status" aria-live="polite" aria-atomic="true" className="fixed right-4 top-4 z-[100] rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}

      {/* mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Abrir navegación">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="text-sm font-black text-gray-800">{activeNav.label}</span>
          </div>
          <LocalLink href="/" className="text-xs font-semibold text-brand-primary hover:underline">Ver sitio</LocalLink>
        </div>
        {mobileOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${tab === n.id ? 'bg-brand-primary text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                <n.icon size={15} /> {n.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-[1600px]">
        {/* sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-5 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary text-white"><Sparkles size={20} /></span>
            <div>
              <p className="text-sm font-black text-gray-900">Admin CamperOcasión</p>
              <p className="text-xs text-gray-500">Control total</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${tab === n.id ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <n.icon size={17} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{n.label}</span>
                  <span className={`block text-[11px] ${tab === n.id ? 'text-white/70' : 'text-gray-400'}`}>{n.description}</span>
                </span>
                {badgeFor(n.id) ? <Badge tone={tab === n.id ? 'dark' : 'red'}>{badgeFor(n.id)}</Badge> : null}
              </button>
            ))}
          </nav>

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="truncate text-xs font-bold text-gray-800">{user.email}</p>
              <p className="text-[11px] text-gray-500">Administrador</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
                <ArrowLeft size={14} /> Sitio
              </button>
              <button onClick={handleLogout} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                <LogOut size={14} /> Salir
              </button>
            </div>
          </div>
        </aside>

        {/* content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <div>
              <h1 className="text-2xl font-black text-gray-900">{activeNav.label}</h1>
              <p className="text-sm text-gray-500">{activeNav.description} · {user.email}</p>
            </div>
            <LocalLink href="/" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
              <ArrowLeft size={14} /> Volver al sitio
            </LocalLink>
          </div>

          <div className="space-y-5">
            {tab === 'dashboard' && <AdminDashboard notify={notify} jump={navigate} />}
            {tab === 'publicaciones' && <AdminPublicaciones notify={notify} />}
            {tab === 'moderacion' && <AdminModeracion notify={notify} adminEmail={user.email || ''} />}
            {tab === 'usuarios' && <AdminUsuarios notify={notify} />}
            {tab === 'verificacion' && <VerificacionTab notify={notify} />}
            {tab === 'homologacion' && <AdminHomologacion notify={notify} />}
            {tab === 'reservas' && <AdminReservas notify={notify} />}
            {tab === 'transacciones' && <AdminTransacciones notify={notify} perfiles={perfiles} onPerfilesChange={setPerfiles} />}
            {tab === 'auditoria' && <AdminAuditoria notify={notify} />}
            {tab === 'categorias' && <AdminCategorias notify={notify} />}
            {tab === 'comunicacion' && <AdminComunicacion notify={notify} />}
            {tab === 'exportar' && <AdminExportar notify={notify} />}
            {tab === 'ajustes' && <AdminAjustes notify={notify} />}
          </div>
        </main>
      </div>
    </div>
  )
}
