'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type JourneyStep = {
  key: string
  title: string
  desc: string
  image: string
  alt: string
  links: { label: string; href: string }[]
}

/**
 * Relato fijado al scroll: la sección queda anclada y, a medida que se baja,
 * cambian la fotografía y el paso. Cada paso enlaza a una herramienta real.
 */
export default function Journey({ steps, eyebrow, title, index }: { steps: JourneyStep[]; eyebrow: string; title: string; index: string }) {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [fill, setFill] = useState(0)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      const p = Math.min(0.9999, Math.max(0, -r.top / total))
      const v = p * steps.length
      setActive(Math.floor(v))
      setFill(v - Math.floor(v))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [steps.length])

  return (
    <section ref={root} className="relative bg-ink text-sand-50" style={{ height: `${steps.length * 85 + 40}vh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Fotografías */}
        {steps.map((s, i) => (
          <div key={s.key} className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${i === active ? 'opacity-100' : 'opacity-0'}`} aria-hidden={i !== active}>
            <Image
              src={s.image}
              alt={s.alt}
              fill
              sizes="100vw"
              quality={80}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`object-cover transition-transform duration-[2400ms] ease-out ${i === active ? 'scale-100' : 'scale-[1.12]'}`}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-ink/55" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/10 to-transparent" aria-hidden="true" />

        <div className="relative mx-auto flex h-full w-full max-w-[1360px] flex-col justify-between px-5 pb-10 pt-28 sm:px-8 lg:pb-16">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">
                <span className="text-ember-300">{index}</span><span className="mx-2 opacity-40">/</span>{eyebrow}
              </p>
              <h2 className="font-display mt-4 max-w-2xl text-[clamp(2.2rem,4.6vw,4.6rem)] leading-[0.98] text-balance">{title}</h2>
            </div>
            <p className="hidden font-mono text-[12px] tracking-[0.14em] text-white/70 sm:block">
              <span className="text-white">{String(active + 1).padStart(2, '0')}</span> / {String(steps.length).padStart(2, '0')}
            </p>
          </div>

          <div className="grid items-end gap-10 lg:grid-cols-12">
            {/* Textos */}
            <div className="relative min-h-[260px] lg:col-span-6 lg:min-h-[300px]">
              {steps.map((s, i) => {
                const on = i === active
                return (
                  <div
                    key={s.key}
                    aria-hidden={!on}
                    className={`absolute inset-x-0 bottom-0 transition-all duration-[900ms] ease-out ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
                  >
                    <p className="font-display text-[clamp(4rem,9vw,8rem)] italic leading-[0.8] text-ember-300">0{i + 1}</p>
                    <h3 className="font-display mt-4 text-[clamp(2rem,3.6vw,3.4rem)] leading-[1]">{s.title}</h3>
                    <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-white/75">{s.desc}</p>
                    <div className="mt-6 flex flex-wrap gap-2.5">
                      {s.links.map((l) => (
                        <LocalLink
                          key={l.href}
                          href={l.href}
                          tabIndex={on ? 0 : -1}
                          className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 py-2.5 pl-5 pr-3 text-[13.5px] font-medium backdrop-blur-sm transition-colors duration-300 hover:border-white hover:bg-white hover:text-ink"
                        >
                          {l.label}
                          <ArrowUpRight size={15} className="transition-transform duration-500 group-hover:rotate-45" aria-hidden="true" />
                        </LocalLink>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Índice de pasos */}
            <ol className="hidden lg:col-span-4 lg:col-start-9 lg:block">
              {steps.map((s, i) => (
                <li key={s.key} className="relative border-t border-white/20 py-4 last:border-b">
                  <span
                    className="absolute left-0 top-[-1px] h-px bg-white"
                    style={{ width: i < active ? '100%' : i === active ? `${fill * 100}%` : '0%' }}
                    aria-hidden="true"
                  />
                  <p className={`flex items-baseline gap-4 text-[15px] transition-colors duration-500 ${i === active ? 'text-white' : 'text-white/40'}`}>
                    <span className="font-mono text-[11px] tracking-[0.1em]">0{i + 1}</span>
                    {s.title}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
