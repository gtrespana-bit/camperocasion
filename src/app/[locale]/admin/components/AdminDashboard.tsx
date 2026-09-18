'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Users, Package, Zap, ShieldCheck, CreditCard, Star, Eye, AlertTriangle,
  Clock, ArrowRight, Activity, Megaphone, CheckCircle2, DollarSign,
  ShoppingBag, UserPlus, Wallet, FileCheck2,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { productUrl } from '@/lib/product-url'
import {
  Card, StatCard, Badge, Loading, Empty, RefreshButton, Button,
  formatNumber, formatMoney, timeAgo,
} from './AdminUi'
import { type Perfil, type Transaccion } from './admin-utils'

type NavJump = (tab: string) => void

type DashboardData = {
  users: number
  products: number
  active: number
  sold: number
  pendingModeration: number
  activeReports: number
  pendingVerifications: number
  pendingHomologaciones?: number
  pendingTransactions: number
  verified: number
  reviews: number
  revenueUsd: number
  revenueToday: number
  transactionsToday: number
  totalVisits: number
  last7Products: number[]
  last7Transactions: number[]
}

export default function AdminDashboard({
  notify,
  jump,
}: {
  notify: (msg: string) => void
  jump: NavJump
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [recentProducts, setRecentProducts] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<Perfil[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaccion[]>([])
  const [status, setStatus] = useState<Record<string, boolean> | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastRefreshed = useRef<Date>(new Date())

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const dashResponse = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      const dashJson = await dashResponse.json().catch(() => ({}))
      if (!dashResponse.ok || !dashJson.ok) {
        throw new Error(dashJson.error || 'No se pudieron cargar los datos del dashboard')
      }
      const counts = dashJson.counts || {}

      const txResponse = await fetch('/api/admin/transacciones?limit=500')
      const txJson = await txResponse.json().catch(() => ({}))
      const trans = txJson.transacciones || []
      const approvedPurchases = trans.filter((t: any) => t.estado === 'aprobado' && t.tipo === 'compra')
      const revenueUsd = approvedPurchases.reduce((s: number, t: any) => s + (Number(t.precio_usd) || 0), 0)
      const today = new Date().toISOString().slice(0, 10)
      const todayTx = approvedPurchases.filter((t: any) => (t.creado_en || '').startsWith(today))
      const revenueToday = todayTx.reduce((s: number, t: any) => s + (Number(t.precio_usd) || 0), 0)

      const statusRes = await fetch('/api/admin/status').catch(() => null)
      const statusJson = statusRes?.ok ? await statusRes.json().catch(() => null) : null

      const recentProducts = dashJson.recentProducts || []
      const topProducts = dashJson.topProducts || []

      setData({
        users: counts.users || 0,
        products: counts.products || 0,
        active: counts.active || 0,
        sold: counts.sold || 0,
        pendingModeration: counts.pendingModeration || 0,
        activeReports: counts.activeReports || 0,
        pendingVerifications: counts.pendingVerifications || 0,
        pendingHomologaciones: counts.pendingHomologaciones || 0,
        pendingTransactions: counts.pendingTransactions || 0,
        verified: counts.verified || 0,
        reviews: counts.reviews || 0,
        revenueUsd,
        revenueToday,
        transactionsToday: todayTx.length,
        totalVisits: topProducts.reduce((s: number, p: any) => s + (p.visitas || 0), 0),
        last7Products: dashJson.last7Products || [],
        last7Transactions: dashJson.last7Transactions || [],
      })
      setRecentProducts(recentProducts)
      setTopProducts(topProducts)
      setRecentUsers(dashJson.recentUsers || [])
      setRecentTransactions(approvedPurchases.slice(0, 8))
      setStatus(statusJson?.config || null)
      lastRefreshed.current = new Date()
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos')
      notify('❌ ' + (e?.message || 'Error cargando dashboard'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const maxProductsTrend = Math.max(...(data?.last7Products || []), 1)
  const maxTxTrend = Math.max(...(data?.last7Transactions || []), 1)

  const taskItems = useMemo(() => {
    const items: Array<{ label: string; count: number; tab: string; tone: string; icon: any }> = []
    if (data?.pendingTransactions) items.push({ label: 'Transacciones por aprobar', count: data.pendingTransactions, tab: 'transacciones', tone: 'text-red-600 bg-red-50', icon: CreditCard })
    if (data?.pendingModeration) items.push({ label: 'Publicaciones en moderación', count: data.pendingModeration, tab: 'moderacion', tone: 'text-yellow-700 bg-yellow-50', icon: ShoppingBag })
    if (data?.pendingVerifications) items.push({ label: 'Verificaciones pendientes', count: data.pendingVerifications, tab: 'verificacion', tone: 'text-blue-600 bg-blue-50', icon: ShieldCheck })
    if (data?.pendingHomologaciones) items.push({ label: 'Expedientes de homologación', count: data.pendingHomologaciones, tab: 'homologacion', tone: 'text-emerald-700 bg-emerald-50', icon: FileCheck2 })
    if (data?.activeReports) items.push({ label: 'Denuncias activas', count: data.activeReports, tab: 'moderacion', tone: 'text-orange-600 bg-orange-50', icon: AlertTriangle })
    return items.slice(0, 6)
  }, [data])

  if (loading) return <Loading label="Preparando el centro de operaciones…" />

  if (error && !data) {
    return (
      <Card>
        <Empty icon="⚠️" title="No se pudo cargar el dashboard" subtitle={error} action={<Button variant="outline" onClick={() => load(true)}>Reintentar</Button>} />
      </Card>
    )
  }

  if (!data) return null

  const kpis = [
    { label: 'Usuarios', value: formatNumber(data.users), icon: Users, accent: 'bg-blue-50 text-blue-600', onClick: () => jump('usuarios'), helper: `${formatNumber(data.verified)} verificados` },
    { label: 'Publicaciones', value: formatNumber(data.products), icon: ShoppingBag, accent: 'bg-purple-50 text-purple-600', onClick: () => jump('publicaciones'), helper: `${formatNumber(data.active)} activas · ${formatNumber(data.sold)} vendidas` },
    { label: 'Ingresos (créditos)', value: formatMoney(data.revenueUsd), icon: DollarSign, accent: 'bg-emerald-50 text-emerald-600', onClick: () => jump('transacciones'), helper: `+${formatMoney(data.revenueToday)} hoy` },
    { label: 'Ventas hoy', value: formatNumber(data.transactionsToday), icon: Wallet, accent: 'bg-yellow-50 text-yellow-700', onClick: () => jump('transacciones'), helper: 'compras aprobadas' },
    { label: 'Visitas', value: formatNumber(data.totalVisits), icon: Eye, accent: 'bg-orange-50 text-orange-600', onClick: () => jump('publicaciones'), helper: 'top publicaciones' },
    { label: 'Reseñas', value: formatNumber(data.reviews), icon: Star, accent: 'bg-amber-50 text-amber-600', onClick: () => jump('publicaciones'), helper: 'confianza en la plataforma' },
    { label: 'Pendientes', value: formatNumber(data.pendingTransactions), icon: Clock, accent: 'bg-red-50 text-red-600', onClick: () => jump('transacciones'), helper: data.pendingTransactions ? 'requieren tu acción' : 'todo al día' },
    { label: 'Moderación', value: formatNumber(data.pendingModeration + data.activeReports), icon: ShieldCheck, accent: 'bg-gray-100 text-gray-700', onClick: () => jump('moderacion'), helper: `${data.pendingModeration} pubs · ${data.activeReports} denuncias` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Centro de operaciones</h2>
          <p className="text-sm text-gray-500">
            Vista en vivo del marketplace. Última actualización: {lastRefreshed.current.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <RefreshButton onClick={() => load(true)} loading={refreshing} title="Actualizar datos" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </div>

      {/* Pending tasks + trends */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          title="Cola de acción"
          subtitle="Lo que necesita tu atención ahora mismo"
          className="xl:col-span-1"
          bodyClassName="p-4"
        >
          {taskItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-700">Todo bajo control</p>
              <p className="text-xs text-gray-500">No hay tareas pendientes de moderación.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {taskItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => jump(item.tab)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-left transition hover:border-brand-primary/30 hover:bg-brand-primary/5"
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.tone}`}>
                      <item.icon size={17} />
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-bold text-white">{item.count}</span>
                    <ArrowRight size={14} className="text-gray-400" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Growth */}
        <Card
          title="Actividad de los últimos 7 días"
          subtitle="Publicaciones y compras de créditos por día"
          className="xl:col-span-2"
          bodyClassName="p-5"
        >
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <ShoppingBag size={13} className="text-brand-primary" /> Publicaciones nuevas
                </span>
                <span className="text-xs font-bold text-gray-800">{data.last7Products.reduce((a, b) => a + b, 0)} en total</span>
              </div>
              <div className="flex h-20 items-end gap-2">
                {data.last7Products.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-primary/80 to-brand-primary" style={{ height: `${Math.max(4, (v / maxProductsTrend) * 76)}px` }} />
                    <span className="text-[10px] text-gray-400">{new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <CreditCard size={13} className="text-emerald-600" /> Compras de créditos
                </span>
                <span className="text-xs font-bold text-gray-800">{data.last7Transactions.reduce((a, b) => a + b, 0)} en total</span>
              </div>
              <div className="flex h-20 items-end gap-2">
                {data.last7Transactions.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-400" style={{ height: `${Math.max(4, (v / maxTxTrend) * 76)}px` }} />
                    <span className="text-[10px] text-gray-400">{new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Config status */}
      <Card title="Salud de la plataforma" subtitle="Canales operativos de tu marketplace" bodyClassName="p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Base de datos', ok: true, icon: DatabaseIcon, hint: 'Supabase' },
            { label: 'Telegram', ok: !!status?.telegram, icon: Megaphone, hint: 'Alertas operatorias' },
            { label: 'Push web', ok: !!status?.push, icon: Zap, hint: 'Notificaciones' },
            { label: 'Email', ok: !!status?.email, icon: Star, hint: 'Correos transaccionales' },
            { label: 'Anuncios globales', ok: !!status?.anuncios, icon: Activity, hint: 'Banner público' },
            { label: 'Rate limiting', ok: !!status?.rateLimit, icon: ShieldCheck, hint: 'Protección anti-abuso' },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <s.icon size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                <p className="text-xs text-gray-500">{s.hint}</p>
              </div>
              <span className={`ml-auto mt-1 h-2 w-2 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-red-500'}`} title={s.ok ? 'OK' : 'No configurado'} />
            </div>
          ))}
        </div>
      </Card>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Publicaciones recientes" subtitle="Lo último que entró a la plataforma" className="xl:col-span-2" bodyClassName="p-0">
          <div className="divide-y divide-gray-50">
            {recentProducts.length === 0 && <Empty icon="📦" title="Aún no hay publicaciones" />}
            {recentProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-xl">
                  <span>{p.imagen_url ? '🖼️' : '📦'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <LocalLink href={productUrl(p)} className="block truncate text-sm font-semibold text-gray-800 hover:text-brand-primary">
                    {p.titulo}
                  </LocalLink>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-bold text-brand-primary">{formatMoney(p.precio_usd)}</span>
                    <span>·</span>
                    <span>{timeAgo(p.creado_en)}</span>
                    <span>·</span>
                    <span>{p.visitas || 0} visitas</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {!p.activo && <Badge tone="gray">Pausada</Badge>}
                  {p.vendido && <Badge tone="green">Vendida</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Nuevos usuarios" subtitle="Registros recientes" bodyClassName="p-0">
          <div className="divide-y divide-gray-50">
            {recentUsers.length === 0 && <Empty icon="👤" title="Aún no hay usuarios" />}
            {recentUsers.slice(0, 8).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${u.verificado ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {u.nombre?.slice(0, 1) || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{u.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">{u.ciudad || u.estado || '—'} · {timeAgo(u.creado_en)}</p>
                </div>
                {u.verificado && <Badge tone="blue">✓</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top products + recent transactions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Top publicaciones por visitas" subtitle="Los productos que más tracción tienen" bodyClassName="p-0">
          <div className="divide-y divide-gray-50">
            {topProducts.length === 0 && <Empty icon="📈" title="Sin datos todavía" />}
            {topProducts.slice(0, 8).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-black text-gray-600">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <LocalLink href={productUrl(p)} className="block truncate text-sm font-semibold text-gray-800 hover:text-brand-primary">{p.titulo}</LocalLink>
                  <p className="text-xs text-gray-500">{formatMoney(p.precio_usd)}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-primary"><Eye size={13} /> {formatNumber(p.visitas)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Últimas transacciones" subtitle="Créditos aprobados" bodyClassName="p-0">
          <div className="divide-y divide-gray-50">
            {recentTransactions.length === 0 && <Empty icon="💳" title="Aún no hay transacciones" />}
            {recentTransactions.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CreditCard size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">{formatNumber(t.monto)} créditos</p>
                  <p className="text-xs text-gray-500">{t.metodo_pago || 'Pago'} · {timeAgo(t.creado_en)}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">+{formatMoney(t.precio_usd)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card title="Acciones rápidas" subtitle="Atajos para el trabajo frecuente" bodyClassName="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Aprobar pagos', icon: CreditCard, onClick: () => jump('transacciones') },
            { label: 'Moderar contenido', icon: ShieldCheck, onClick: () => jump('moderacion') },
            { label: 'Verificar vendedor', icon: BadgeCheckIcon, onClick: () => jump('verificacion') },
            { label: 'Gestionar productos', icon: Package, onClick: () => jump('publicaciones') },
            { label: 'Auditar actividad', icon: Activity, onClick: () => jump('auditoria') },
          ].map((a) => (
            <button key={a.label} onClick={a.onClick} className="group flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary transition group-hover:bg-brand-primary group-hover:text-white"><a.icon size={17} /></span>
              <span className="text-xs font-semibold text-gray-700">{a.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function DatabaseIcon(props: any) {
  return <DatabaseIconInner {...props} />
}
function DatabaseIconInner(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}
function BadgeCheckIcon(props: any) {
  return <UserPlus {...props} />
}
