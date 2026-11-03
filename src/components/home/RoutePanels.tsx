'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type RoutePanel = {
  key: string
  label: string
  desc: string
  image: string
  alt: string
  href: string
  tipos: { label: string; href: string }[]
}

/**
 * Tres «rutas» a pantalla completa que se apilan: cada una queda fijada y la
 * siguiente la cubre mientras la anterior se aleja y se oscurece.
 */
export default function RoutePanels({ panels, explore, kicker }: { panels: RoutePanel[]; explore: string; kicker: string }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>('[data-panel]')
      items.forEach((panel, i) => {
        const img = panel.querySelector('[data-pimg]')
        const inner = panel.querySelector('[data-pinner]')
        const veil = panel.querySelector('[data-pveil]')
        // Paralaje de la fotografía mientras el panel cruza la pantalla
        if (img) {
          gsap.fromTo(img, { yPercent: -7, scale: 1.14 }, {
            yPercent: 7, scale: 1.04, ease: 'none',
            scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true },
          })
        }
        // El panel anterior se aleja al llegar el siguiente
        const next = items[i + 1]
        if (next && inner && veil) {
          gsap.to(inner, {
            scale: 0.9, ease: 'none',
            scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
          })
          gsap.to(veil, {
            opacity: 0.78, ease: 'none',
            scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
          })
        }
      })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root}>
      {panels.map((p, i) => (
        <section
          key={p.key}
          data-panel
          className="sticky top-0 h-[100svh] overflow-hidden bg-night"
          style={{ zIndex: i + 1 }}
        >
          <div data-pinner className="absolute inset-0 origin-top overflow-hidden will-change-transform">
            <div data-pimg className="absolute -inset-y-[8%] inset-x-0 will-change-transform">
              <Image
                src={p.image}
                alt={p.alt}
                fill
                sizes="100vw"
                quality={80}
                className="object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/15 to-night/40" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-r from-night/55 to-transparent" aria-hidden="true" />
            <div data-pveil className="absolute inset-0 bg-night opacity-0" aria-hidden="true" />

            <div className="relative mx-auto flex h-full w-full max-w-[1360px] flex-col justify-between px-5 pb-8 pt-28 sm:px-8 lg:pb-12">
              <div className="flex items-start justify-between">
                <p className="micro text-white/70">{kicker}</p>
                <p className="t-num text-[15px] text-white/80">
                  <span className="text-white">0{i + 1}</span>
                  <span className="mx-2 opacity-40">—</span>
                  <span className="opacity-60">0{panels.length}</span>
                </p>
              </div>

              <div>
                <h3 className="t-mega max-w-[14ch] text-[clamp(3.6rem,12.4vw,14rem)] text-white">{p.label}</h3>
                <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-end">
                  <p className="max-w-md text-[16px] leading-relaxed text-white/75 lg:col-span-4">{p.desc}</p>
                  <ul className="flex flex-wrap gap-2 lg:col-span-5">
                    {p.tipos.map((tp) => (
                      <li key={tp.label}>
                        <LocalLink
                          href={tp.href}
                          className="inline-flex h-10 items-center border border-white/30 px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm transition-colors duration-300 hover:border-white hover:bg-white hover:text-night"
                        >
                          {tp.label}
                        </LocalLink>
                      </li>
                    ))}
                  </ul>
                  <div className="lg:col-span-3 lg:text-right">
                    <LocalLink href={p.href} data-cursor={explore} className="btn btn-light w-full sm:w-auto">
                      {explore}
                      <ArrowUpRight size={18} className="btn-ico" aria-hidden="true" />
                    </LocalLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
