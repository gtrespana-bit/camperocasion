'use client'

import { useEffect, useMemo, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { X, RefreshCw, Search, Loader2, type LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* formatters                                                          */
/* ------------------------------------------------------------------ */

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}

export function formatMoney(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '$0'
  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)}`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} d`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} meses`
  const years = Math.floor(months / 12)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

/* ------------------------------------------------------------------ */
/* badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeTone =
  | 'gray'
  | 'green'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'brand'
  | 'dark'

const TONES: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  brand: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  dark: 'bg-gray-900 text-white border-gray-900',
}

export function Badge({
  children,
  tone = 'gray',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* cards                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  padded?: boolean
}) {
  return (
    <section className={clsx('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  helper,
  icon,
  accent,
  onClick,
  trend,
  loading,
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  icon: LucideIcon
  accent?: string
  onClick?: () => void
  trend?: { value: string; positive: boolean }
  loading?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  const Icon = icon
  return (
    <Comp
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition sm:p-5',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-brand-primary/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', accent || 'bg-brand-primary/10 text-brand-primary')}>
          <Icon size={19} />
        </div>
        {trend && (
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-black tracking-tight text-gray-900">{loading ? '…' : value}</div>
        <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
        {helper && <div className="mt-1 text-[11px] text-gray-400">{helper}</div>}
      </div>
    </Comp>
  )
}

/* ------------------------------------------------------------------ */
/* loading / empty / search / refresh                                  */
/* ------------------------------------------------------------------ */

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <Loader2 className="h-7 w-7 animate-spin text-brand-primary" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function Empty({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="text-base font-bold text-gray-800">{title}</p>
      {subtitle && <p className="max-w-md text-sm text-gray-500">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      />
    </div>
  )
}

export function RefreshButton({
  onClick,
  loading,
  title = 'Actualizar',
}: {
  onClick: () => void
  loading?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={loading}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-brand-primary disabled:opacity-50"
    >
      <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  items: Array<{ id: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={clsx('inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            'rounded-lg font-semibold transition',
            size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            value === item.id
              ? 'bg-white text-brand-primary shadow-sm'
              : 'text-gray-500 hover:bg-white/70 hover:text-gray-800',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* modal + confirm                                                     */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-gray-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={clsx('max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl', sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-72px)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50',
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-primary hover:bg-brand-dark',
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-gray-600">{message}</div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* table helpers                                                       */
/* ------------------------------------------------------------------ */

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">{children}</thead>
}

export function Th({
  children,
  className,
  onClick,
  sortDir,
}: {
  children?: ReactNode
  className?: string
  onClick?: () => void
  sortDir?: 'asc' | 'desc' | null
}) {
  return (
    <th
      onClick={onClick}
      className={clsx('px-3 py-3 font-semibold', onClick && 'cursor-pointer select-none hover:text-brand-primary', className)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortDir && <span className="text-[10px] text-brand-primary">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-3 py-3 align-middle', className)}>{children}</td>
}

/* ------------------------------------------------------------------ */
/* mini bars / sparkline                                              */
/* ------------------------------------------------------------------ */

export function Sparkline({ points, color = '#0F172A' }: { points: number[]; color?: string }) {
  const path = useMemo(() => {
    const values = points.length >= 2 ? points : Array.from({ length: 7 }, () => 0)
    const max = Math.max(...values, 1)
    const h = 34
    const w = 96
    const step = w / Math.max(1, values.length - 1)
    return values
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`)
      .join(' ')
  }, [points])

  return (
    <svg width="96" height="34" viewBox="0 0 96 34" className="overflow-visible" aria-hidden="true">
      <polyline points={path.replace(/[ML]/g, '$& ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <line x1="0" y1="34" x2="96" y2="34" stroke="#e5e7eb" strokeWidth="1" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* generic button                                                      */
/* ------------------------------------------------------------------ */

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
  size?: 'xs' | 'sm' | 'md'
}) {
  const variants = {
    primary: 'bg-brand-primary text-white hover:bg-brand-dark focus-visible:ring-brand-primary',
    secondary: 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 focus-visible:ring-brand-primary/30',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  }
  const sizes = {
    xs: 'h-7 px-2.5 text-[11px]',
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  }
  return (
    <button
      className={clsx('inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}
