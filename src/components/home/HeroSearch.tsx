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
 * Buscador de la portada: una sola barra segmentada (qué · tipo · dónde ·
 * presupuesto) que lleva al catálogo con los filtros ya aplicados.
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

  const field = 'group/field relative flex flex-col justify-center px-5 py-3 lg:py-4 min-w-0 transition-colors hover:bg-ink/[0.03] focus-within:bg-ink/[0.04]'
  const label = 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink/45'
  const control = 'mt-1 w-full bg-transparent text-[15px] font-medium text-ink placeholder:text-ink/35 focus:outline-none focus-visible:outline-none focus:shadow-none appearance-none cursor-pointer truncate pr-6'

  return (
    <form
      action={`${prefix}/catalogo`}
      method="GET"
      className="w-full rounded-[22px] bg-sand-50 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.4)_inset] ring-1 ring-ink/10 lg:rounded-full lg:p-2"
      role="search"
    >
      <div className="grid grid-cols-1 divide-y divide-ink/10 lg:grid-cols-[1.35fr_1fr_1fr_0.85fr_auto] lg:divide-x lg:divide-y-0 lg:items-stretch">
        <label className={`${field} lg:rounded-l-full`}>
          <span className={label}>{labels.query}</span>
          <input
            type="text"
            name="q"
            placeholder={labels.queryPlaceholder}
            className={control.replace('appearance-none cursor-pointer', 'cursor-text')}
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
          <ChevronDown size={15} className="pointer-events-none absolute right-5 top-1/2 mt-1 -translate-y-1/2 text-ink/40" aria-hidden="true" />
        </label>

        <label className={field}>
          <span className={label}>{labels.province}</span>
          <select name="ciudad" defaultValue="" className={control}>
            <option value="">{labels.allProvinces}</option>
            {provinces.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-5 top-1/2 mt-1 -translate-y-1/2 text-ink/40" aria-hidden="true" />
        </label>

        <label className={field}>
          <span className={label}>{labels.budget}</span>
          <select name="precioMax" defaultValue="" className={control}>
            <option value="">{labels.anyBudget}</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>{labels.upTo} {b.toLocaleString('es-ES')} €</option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-5 top-1/2 mt-1 -translate-y-1/2 text-ink/40" aria-hidden="true" />
        </label>

        <div className="p-2 lg:p-0 lg:pl-2">
          <button
            type="submit"
            className="group/btn flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-[15px] font-semibold text-white transition-all duration-500 ease-out hover:bg-ember lg:h-full"
          >
            {labels.submit}
            <ArrowUpRight size={17} className="transition-transform duration-500 ease-out group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  )
}
