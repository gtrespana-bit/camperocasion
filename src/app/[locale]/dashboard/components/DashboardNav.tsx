'use client'

import {
  BarChart3,
  Package,
  MessageSquare,
  CreditCard,
  Heart,
  Handshake,
  Store,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

export type DashboardTab =
  | 'resumen'
  | 'productos'
  | 'mensajes'
  | 'creditos'
  | 'tratos'
  | 'tienda'
  | 'favoritos'
  | 'cuenta'

const GRUPOS: { titulo: string; items: { id: DashboardTab; label: string; icon: LucideIcon }[] }[] = [
  {
    titulo: '',
    items: [{ id: 'resumen', label: 'Inicio', icon: BarChart3 }],
  },
  {
    titulo: 'Venta',
    items: [
      { id: 'productos', label: 'Anuncios', icon: Package },
      { id: 'tienda', label: 'Mi tienda', icon: Store },
      { id: 'creditos', label: 'Créditos', icon: CreditCard },
    ],
  },
  {
    titulo: 'Actividad',
    items: [
      { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
      { id: 'tratos', label: 'Tratos', icon: Handshake },
      { id: 'favoritos', label: 'Guardados', icon: Heart },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [{ id: 'cuenta', label: 'Confianza y perfil', icon: ShieldCheck }],
  },
]

export const TABS_VALIDOS: DashboardTab[] = GRUPOS.flatMap(g => g.items.map(i => i.id))

/** Tabs antiguas del query string → las nuevas. */
export function normalizarTab(raw: string | null): DashboardTab {
  if (!raw) return 'resumen'
  if (raw === 'reservas' || raw === 'inspecciones') return 'tratos'
  if (raw === 'verificacion' || raw === 'reputacion') return 'cuenta'
  if ((TABS_VALIDOS as string[]).includes(raw)) return raw as DashboardTab
  return 'resumen'
}

export default function DashboardNav({
  active,
  onChange,
  onLogout,
}: {
  active: DashboardTab
  onChange: (tab: DashboardTab) => void
  onLogout: () => void
}) {
  const boton = (item: { id: DashboardTab; label: string; icon: LucideIcon }) => {
    const Icon = item.icon
    const on = active === item.id
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange(item.id)}
        aria-current={on ? 'page' : undefined}
        className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2
          ${on
            ? 'bg-brand-primary text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
      >
        <Icon size={17} aria-hidden="true" />
        {item.label}
      </button>
    )
  }

  return (
    <>
      {/* Móvil: chips en una sola fila, agrupados visualmente por color no por 10 tabs. */}
      <nav
        aria-label="Secciones del panel"
        className="lg:hidden mb-6 -mx-4 px-4 overflow-x-auto hide-scrollbar"
      >
        <div className="flex gap-1.5 min-w-min pb-1">
          {GRUPOS.flatMap(g => g.items).map(item => {
            const Icon = item.icon
            const on = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={on ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent
                  ${on ? 'bg-brand-primary text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap text-slate-600 border border-slate-200 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Escritorio: menú lateral fijo, el patrón de un panel profesional. */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-24 self-start">
        <nav aria-label="Secciones del panel" className="space-y-5">
          {GRUPOS.map((grupo, i) => (
            <div key={grupo.titulo || 'inicio'}>
              {grupo.titulo ? (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {grupo.titulo}
                </p>
              ) : null}
              <div className="space-y-0.5">{grupo.items.map(boton)}</div>
              {i === 0 && <div className="mt-4 border-t border-slate-200" />}
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="mt-8 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
        >
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </aside>
    </>
  )
}
