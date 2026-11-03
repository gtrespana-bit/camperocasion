'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type GalleryItem = {
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

type Labels = { featured: string; isNew: string; see: string; empty: string; emptyCta: string; progress: string }

/**
 * Galería horizontal fijada: el scroll vertical desplaza la tira de anuncios.
 * En móvil (o con reducir movimiento) es un carril nativo con snap.
 */
export default function Gallery({ items, labels, header }: { items: GalleryItem[]; labels: Labels; header: React.ReactNode }) {
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const sec = section.current
    const tr = track.current
    if (!sec || !tr || items.length === 0) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      const viewport = tr.parentElement as HTMLElement
      viewport.style.overflow = 'hidden'
      const dist = () => Math.max(0, tr.scrollWidth - viewport.clientWidth)
      const cards = Array.from(tr.querySelectorAll<HTMLElement>('[data-card]'))
      const total = cards.length

      const tween = gsap.to(tr, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top top',
          end: () => `+=${dist() + window.innerHeight * 0.25}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`
            if (count.current) count.current.textContent = String(Math.min(total, Math.max(1, Math.round(self.progress * (total - 1)) + 1))).padStart(2, '0')
          },
        },
      })

      // Paralaje interior de cada fotografía respecto a la tira
      cards.forEach((card) => {
        const img = card.querySelector('[data-gimg]')
        if (img) {
          gsap.fromTo(img, { xPercent: -9 }, {
            xPercent: 9, ease: 'none',
            scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
          })
        }
      })
      return () => { viewport.style.overflow = '' }
    })
    return () => mm.revert()
  }, [items.length])

  return (
    <section ref={section} className="relative overflow-hidden bg-bone py-20 text-night [--stroke:#0A0B0A] lg:flex lg:h-[100svh] lg:flex-col lg:justify-center lg:py-0">
      <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-8">{header}</div>

      {items.length === 0 ? (
        <div className="mx-auto mt-14 w-full max-w-[1360px] px-5 sm:px-8">
          <div className="flex flex-col items-start gap-6 border border-night/20 p-10">
            <p className="t-mega text-[clamp(2.4rem,6vw,5rem)]">{labels.empty}</p>
            <LocalLink href="/publicar" className="btn btn-ink">
              {labels.emptyCta} <ArrowUpRight size={18} className="btn-ico" aria-hidden="true" />
            </LocalLink>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-12 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:px-8 lg:mt-14 lg:overflow-visible lg:pb-0 lg:pl-[max(2rem,calc((100vw-1360px)/2+2rem))] [&::-webkit-scrollbar]:hidden">
            <div ref={track} className="flex w-max gap-4 lg:gap-6 lg:pr-[10vw]">
              {items.map((it, i) => (
                <LocalLink
                  key={it.id}
                  href={it.href}
                  data-card
                  data-cursor={labels.see}
                  className="group block w-[72vw] shrink-0 sm:w-[44vw] lg:w-[clamp(240px,min(24vw,calc((100svh-470px)*0.8)),400px)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-night/10">
                    <div data-gimg className="absolute inset-y-0 -inset-x-[10%] will-change-transform">
                      <Image
                        src={it.image}
                        alt={it.title}
                        fill
                        sizes="(max-width: 1024px) 72vw, 460px"
                        quality={75}
                        loading={i < 3 ? 'eager' : 'lazy'}
                        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                      />
                    </div>
                    <span className="t-num absolute left-4 top-4 text-[13px] text-white mix-blend-difference">{String(i + 1).padStart(2, '0')}</span>
                    {it.badge && (
                      <span className={`micro absolute right-4 top-4 px-2.5 py-1.5 ${it.badge === 'featured' ? 'bg-flare text-night' : 'bg-night text-white'}`}>
                        {it.badge === 'featured' ? labels.featured : labels.isNew}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-[17px] font-semibold leading-tight">{it.title}</h3>
                      <p className="micro mt-2 truncate !text-[10.5px] !tracking-[0.12em] text-night/55">
                        {[it.place, it.condition, it.ago].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="t-num shrink-0 text-[26px] leading-none">{it.price}</p>
                  </div>
                </LocalLink>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 hidden w-full max-w-[1360px] items-center gap-6 px-5 sm:px-8 lg:flex">
            <p className="t-num text-[15px]"><span ref={count}>01</span><span className="mx-2 opacity-35">/</span><span className="opacity-55">{String(items.length).padStart(2, '0')}</span></p>
            <div className="h-px flex-1 bg-night/20"><div ref={bar} className="h-px origin-left scale-x-0 bg-night" /></div>
            <p className="micro text-night/55">{labels.progress}</p>
          </div>
        </>
      )}
    </section>
  )
}
