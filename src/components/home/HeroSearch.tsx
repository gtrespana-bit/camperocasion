'use client'

import { usePathname } from 'next/navigation'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

export type SearchGroup = { label: string; options: { value: string; label: string }[] }

type Labels = {
  query: string
  queryPlaceholder: string
  type: string
  allTypes: string
  province: string
  allProvinces: string
  budget: string
  anyBudget: string
  upTo: string
  submit: string
}

const BUDGETS = [15000, 25000, 35000, 50000, 70000, 100000]

/**
 * Buscador de la portada: una barra de cristal oscuro segmentada (qué · tipo ·
 * dónde · presupuesto) que lleva al catálogo con los filtros ya aplicados.
 * Es un formulario GET real: funciona sin JS.
 */
export default function HeroSearch({
  groups,
  provinces,
  labels,
}: {
  groups: SearchGroup[]
  provinces: string[]
  labels: Labels
}) {
  const pathname = usePathname() || '/'
  const prefix = pathname === '/en' || pathname.startsWith('/en/') ? '/en' : ''

  const field = 'group/field relative flex min-w-0 flex-col justify-center px-5 py-3.5 transition-colors hover:bg-white/[0.06] focus-within:bg-white/[0.08] lg:py-4'
  const label = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45'
  const control = 'mt-1 w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15px] font-medium text-white placeholder:text-white/35 focus:shadow-none focus:outline-none focus-visible:outline-none [&>option]:text-night [&>optgroup]:text-night'
  const chevron = 'pointer-events-none absolute right-5 top-1/2 mt-1 -translate-y-1/2 text-white/40'

  return (
    <form
      action={`${prefix}/catalogo`}
      method="GET"
      className="w-full border border-white/20 bg-night/45 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      role="search"
    >
      <div className="grid grid-cols-1 divide-y divide-white/12 lg:grid-cols-[1.35fr_1fr_1fr_0.85fr_auto] lg:divide-x lg:divide-y-0 lg:items-stretch">
        <label className={field}>
          <span className={label}>{labels.query}</span>
          <input
            type="text"
            name="q"
            placeholder={labels.queryPlaceholder}
            className={control.replace('cursor-pointer appearance-none', 'cursor-text')}
            autoComplete="off"
          />
        </label>

        <label className={field}>
          <span className={label}>{labels.type}</span>
          <select name="subcategoria" defaultValue="" className={control}>
            <option value="">{labels.allTypes}</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={15} className={chevron} aria-hidden="true" />
        </label>

        <label className={field}>
          <span className={label}>{labels.province}</span>
          <select name="ciudad" defaultValue="" className={control}>
            <option value="">{labels.allProvinces}</option>
            {provinces.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={15} className={chevron} aria-hidden="true" />
        </label>

        <label className={field}>
          <span className={label}>{labels.budget}</span>
          <select name="precioMax" defaultValue="" className={control}>
            <option value="">{labels.anyBudget}</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>{labels.upTo} {b.toLocaleString('es-ES')} €</option>
            ))}
          </select>
          <ChevronDown size={15} className={chevron} aria-hidden="true" />
        </label>

        <button type="submit" className="btn btn-green h-14 w-full justify-center gap-3 lg:h-auto lg:w-[168px]">
          {labels.submit}
          <ArrowUpRight size={17} className="btn-ico" aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}
