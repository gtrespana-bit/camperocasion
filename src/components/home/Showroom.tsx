'use client'

import { useState } from 'react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'

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
  featured: string
  isNew: string
  open: string
}

function Badge({ item, labels }: { item: RailItem; labels: Labels }) {
  if (!item.badge) return null
  return (
    <span className={`rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] ${item.badge === 'featured' ? 'bg-ember text-white' : 'bg-white/90 text-ink'}`}>
      {item.badge === 'featured' ? labels.featured : labels.isNew}
    </span>
  )
}

/** Tarjeta para móvil / tablet: carril con snap. */
function RailCard({ item, index, labels }: { item: RailItem; index: number; labels: Labels }) {
  return (
    <LocalLink href={item.href} className="group block w-[78vw] shrink-0 sm:w-[340px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-sand-200">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 78vw, 340px"
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
          loading={index < 2 ? 'eager' : 'lazy'}
          quality={75}
        />
        {item.badge && <div className="absolute left-3 top-3"><Badge item={item} labels={labels} /></div>}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-medium">{item.title}</h3>
          <p className="mt-1 truncate font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink/50">
            {[item.place, item.condition].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="font-display shrink-0 text-[28px] leading-none tabular">{item.price}</p>
      </div>
    </LocalLink>
  )
}

/**
 * Escaparate de anuncios.
 *  · Escritorio: una vitrina grande que cambia al pasar el puntero por la
 *    lista de la derecha (también con teclado: el foco activa el anuncio).
 *  · Móvil: carril horizontal con snap.
 * Todos los anuncios están en el HTML del servidor.
 */
export default function Showroom({ tabs, labels }: { tabs: RailTab[]; labels: Labels }) {
  const [tabKey, setTabKey] = useState(tabs[0]?.key)
  const [hover, setHover] = useState(0)
  const current = tabs.find((t) => t.key === tabKey) ?? tabs[0]

  const pick = (key: string) => {
    setTabKey(key)
    setHover(0)
  }

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 hide-scrollbar" aria-label="Tipos de vehículo">
          {tabs.map((tab) => {
            const on = tab.key === tabKey
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={on}
                onClick={() => pick(tab.key)}
                className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-[13.5px] font-medium transition-all duration-300 ${on ? 'border-ink bg-ink text-white' : 'border-ink/15 text-ink/60 hover:border-ink/40 hover:text-ink'}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        {current && (
          <LocalLink href={current.href} className="hidden items-center gap-2 text-[14px] font-medium sm:inline-flex">
            <span className="link-draw pb-0.5">{labels.viewAll}</span> <ArrowRight size={15} aria-hidden="true" />
          </LocalLink>
        )}
      </div>

      <div className="mt-10">
        {tabs.map((tab) => {
          const hidden = tab.key !== tabKey
          const items = tab.items
          const list = items.slice(0, 6)
          const idx = Math.min(hover, Math.max(0, list.length - 1))
          return (
            <div key={tab.key} role="tabpanel" hidden={hidden}>
              {items.length === 0 ? (
                <div className="flex flex-col items-start gap-5 rounded-[22px] border border-dashed border-ink/20 p-10">
                  <p className="font-display text-4xl">{labels.empty}</p>
                  <LocalLink href="/publicar" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-ember">
                    {labels.emptyCta} <ArrowUpRight size={16} aria-hidden="true" />
                  </LocalLink>
                </div>
              ) : (
                <>
                  {/* Escritorio: vitrina + índice */}
                  <div className="hidden gap-12 lg:grid lg:grid-cols-12">
                    <div className="relative col-span-7 aspect-[4/3] overflow-hidden rounded-[26px] bg-ink">
                      {list.map((item, i) => (
                        <LocalLink
                          key={item.id}
                          href={item.href}
                          tabIndex={-1}
                          aria-hidden={i !== idx}
                          className={`absolute inset-0 block transition-all duration-[900ms] ease-out ${i === idx ? 'scale-100 opacity-100' : 'pointer-events-none scale-[1.06] opacity-0'}`}
                        >
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="(max-width: 1360px) 58vw, 780px"
                            className="object-cover"
                            loading={i < 2 ? 'eager' : 'lazy'}
                            quality={80}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-ink/20" aria-hidden="true" />
                          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-8 text-white">
                            <div className="min-w-0">
                              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
                                {[item.place, item.condition, item.ago].filter(Boolean).join(' · ')}
                              </p>
                              <h3 className="mt-2 max-w-md text-[22px] font-medium leading-tight">{item.title}</h3>
                            </div>
                            <p className="font-display shrink-0 text-[clamp(3rem,5vw,4.8rem)] leading-none tabular">{item.price}</p>
                          </div>
                        </LocalLink>
                      ))}
                      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-2">
                        {list[idx] && <Badge item={list[idx]} labels={labels} />}
                      </div>
                      <span className="pointer-events-none absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink">
                        <ArrowUpRight size={20} />
                      </span>
                    </div>

                    <ol className="col-span-5 flex flex-col justify-between">
                      {list.map((item, i) => (
                        <li key={item.id} className="border-t border-ink/12 first:border-t-0 last:border-b">
                          <LocalLink
                            href={item.href}
                            onMouseEnter={() => setHover(i)}
                            onFocus={() => setHover(i)}
                            className={`group relative grid grid-cols-[34px_1fr_auto] items-center gap-3 py-[18px] transition-all duration-500 ${i === idx ? 'opacity-100' : 'opacity-45 hover:opacity-80'}`}
                          >
                            <span className="font-mono text-[11px] tracking-[0.1em] text-ink/50">{String(i + 1).padStart(2, '0')}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[16px] font-medium">{item.title}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                                <MapPin size={11} aria-hidden="true" className="shrink-0" />
                                {[item.place, item.condition].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <span className="font-display text-[26px] leading-none tabular">{item.price}</span>
                            <span className={`absolute -left-4 top-1/2 h-0 w-px -translate-y-1/2 bg-ember transition-all duration-500 ${i === idx ? 'h-8' : ''}`} aria-hidden="true" />
                          </LocalLink>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Móvil / tablet: carril */}
                  <div className="rail -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:gap-5 sm:px-8 lg:hidden">
                    {items.map((item, i) => (
                      <RailCard key={item.id} item={item} index={i} labels={labels} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
