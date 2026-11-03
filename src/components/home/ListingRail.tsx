'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'

export type RailItem = {
  id: string
  href: string
  title: string
  image: string
  price: string
  place: string
  condition: string
  ago: string | null
  badge: 'featured' | 'new' | null
}

export type RailTab = {
  key: string
  label: string
  href: string
  items: RailItem[]
}

type Labels = {
  viewAll: string
  empty: string
  emptyCta: string
  prev: string
  next: string
  featured: string
  isNew: string
}

function Card({ item, index, labels }: { item: RailItem; index: number; labels: Labels }) {
  return (
    <LocalLink href={item.href} className="group block w-[76vw] shrink-0 sm:w-[330px] lg:w-[360px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-sand-200">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 76vw, 360px"
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
          loading={index < 3 ? 'eager' : 'lazy'}
          quality={75}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
        {item.badge && (
          <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${item.badge === 'featured' ? 'bg-ember text-white' : 'bg-sand-50/95 text-ink'}`}>
            {item.badge === 'featured' ? labels.featured : labels.isNew}
          </span>
        )}
        <span className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-sand-50 text-ink opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-medium text-ink">{item.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-ink/55">
            {item.place && (<><MapPin size={12} aria-hidden="true" className="shrink-0" /><span className="truncate">{item.place}</span></>)}
            {item.place && item.condition && <span aria-hidden="true">·</span>}
            {item.condition && <span className="truncate">{item.condition}</span>}
          </p>
        </div>
        <p className="font-display shrink-0 text-[28px] leading-none text-ink tabular">{item.price}</p>
      </div>
      {item.ago && <p className="mt-2 text-[12px] text-ink/40">{item.ago}</p>}
    </LocalLink>
  )
}

/**
 * Carril de anuncios con pestañas por tipo, snap horizontal, flechas y una
 * barra de progreso. Todos los anuncios están en el HTML del servidor.
 */
export default function ListingRail({ tabs, labels }: { tabs: RailTab[]; labels: Labels }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const rails = useRef<Record<string, HTMLDivElement | null>>({})
  const [progress, setProgress] = useState({ left: 0, width: 100 })
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const el = active ? rails.current[active] : null
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const width = max <= 0 ? 100 : (el.clientWidth / el.scrollWidth) * 100
    const left = max <= 0 ? 0 : (el.scrollLeft / max) * (100 - width)
    setProgress({ left, width })
    setEdges({ start: el.scrollLeft < 8, end: max <= 0 || el.scrollLeft > max - 8 })
  }, [active])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const scrollBy = (dir: 1 | -1) => {
    const el = active ? rails.current[active] : null
    if (!el) return
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 hide-scrollbar" aria-label="Tipos de vehículo">
          {tabs.map((tab) => {
            const on = tab.key === active
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(tab.key)}
                className={`relative whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-medium transition-colors duration-300 ${on ? 'bg-ink text-white' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          {current && (
            <LocalLink href={current.href} className="mr-2 hidden items-center gap-1.5 text-[14px] font-medium text-ink sm:inline-flex">
              <span className="link-draw pb-0.5">{labels.viewAll}</span> <ArrowRight size={15} aria-hidden="true" />
            </LocalLink>
          )}
          <button onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={labels.prev} className="hidden h-11 items-center justify-center sm:flex w-11 rounded-full border border-ink/15 text-ink transition-all duration-300 hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30">
            <ArrowLeft size={17} />
          </button>
          <button onClick={() => scrollBy(1)} disabled={edges.end} aria-label={labels.next} className="hidden h-11 items-center justify-center sm:flex w-11 rounded-full border border-ink/15 text-ink transition-all duration-300 hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30">
            <ArrowRight size={17} />
          </button>
        </div>
      </div>

      <div className="mt-8">
        {tabs.map((tab) => (
          <div key={tab.key} role="tabpanel" hidden={tab.key !== active}>
            {tab.items.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-[18px] border border-dashed border-ink/20 p-10">
                <p className="font-display text-3xl text-ink">{labels.empty}</p>
                <LocalLink href="/publicar" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-ember">
                  {labels.emptyCta} <ArrowUpRight size={16} aria-hidden="true" />
                </LocalLink>
              </div>
            ) : (
              <div
                ref={(el) => { rails.current[tab.key] = el }}
                onScroll={measure}
                className="rail -mx-5 flex gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:gap-6"
              >
                {tab.items.map((item, i) => (
                  <Card key={item.id} item={item} index={i} labels={labels} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 h-px w-full bg-ink/10" aria-hidden="true">
        <div className="relative h-px bg-ink transition-[margin,width] duration-150" style={{ marginLeft: `${progress.left}%`, width: `${progress.width}%` }} />
      </div>
    </div>
  )
}
