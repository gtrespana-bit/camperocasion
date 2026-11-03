'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, MapPin } from 'lucide-react'

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
    <section ref={section} className="relative overflow-hidden bg-gradient-to-b from-bone to-[#E6ECF3] py-20 text-night [--stroke:#0B1120] lg:flex lg:h-[100svh] lg:flex-col lg:justify-center lg:py-0">
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
          <p className="micro mx-auto mt-8 max-w-[1360px] px-5 text-night/75 sm:px-8 lg:hidden">{labels.progress} →</p>
          <div className="mt-4 overflow-x-auto snap-x snap-mandatory px-5 pb-4 [scrollbar-width:none] sm:px-8 lg:mt-14 lg:overflow-visible lg:pb-0 lg:pl-[max(2rem,calc((100vw-1360px)/2+2rem))] [&::-webkit-scrollbar]:hidden">
            <div ref={track} className="flex w-max gap-4 lg:gap-6 lg:pr-[10vw]">
              {items.map((it, i) => (
                <LocalLink
                  key={it.id}
                  href={it.href}
                  data-card
                  data-cursor={labels.see}
                  className="group flex w-[76vw] shrink-0 snap-start flex-col border border-night/10 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-32px_rgba(15,23,42,0.35)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_1px_0_rgba(15,23,42,0.04),0_36px_60px_-28px_rgba(15,23,42,0.45)] sm:w-[46vw] lg:w-[clamp(260px,min(28vw,calc((100svh-430px)*1.25)),460px)]"
                >
                  <div className="relative aspect-[5/4] overflow-hidden bg-night/10">
                    <div data-gimg className="absolute inset-y-0 -inset-x-[10%] will-change-transform">
                      <Image
                        src={it.image}
                        alt={it.title}
                        fill
                        sizes="(max-width: 1024px) 76vw, 460px"
                        quality={75}
                        loading={i < 3 ? 'eager' : 'lazy'}
                        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night/45 to-transparent" aria-hidden="true" />
                    <span className="t-num absolute bottom-3 left-4 text-[13px] text-white">{String(i + 1).padStart(2, '0')}</span>
                    {it.badge && (
                      <span className={`micro absolute left-0 top-4 px-3 py-1.5 ${it.badge === 'featured' ? 'bg-flare text-white' : 'bg-leaf text-[#04140A]'}`}>
                        {it.badge === 'featured' ? labels.featured : labels.isNew}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4 lg:p-5">
                    <h3 className="truncate text-[16.5px] font-semibold leading-tight">{it.title}</h3>
                    <p className="mt-2 flex items-center gap-2 truncate text-[12.5px] text-night/75">
                      {it.place && <><MapPin size={13} aria-hidden="true" className="shrink-0 text-leaf" />{it.place}</>}
                      {it.condition && <><span className="h-1 w-1 shrink-0 rounded-full bg-night/25" aria-hidden="true" />{it.condition}</>}
                      {it.ago && <><span className="h-1 w-1 shrink-0 rounded-full bg-night/25" aria-hidden="true" />{it.ago}</>}
                    </p>
                    <div className="mt-auto flex items-end justify-between border-t border-night/10 pt-4">
                      <p className="t-num text-[28px] leading-none">{it.price}</p>
                      <span className="flex h-9 w-9 items-center justify-center bg-night text-white transition-colors duration-500 group-hover:bg-leaf group-hover:text-[#04140A]">
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </LocalLink>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 hidden w-full max-w-[1360px] items-center gap-6 px-5 sm:px-8 lg:flex">
            <p className="t-num text-[15px]"><span ref={count}>01</span><span className="mx-2 opacity-35">/</span><span className="opacity-55">{String(items.length).padStart(2, '0')}</span></p>
            <div className="h-px flex-1 bg-night/20"><div ref={bar} className="h-[3px] -translate-y-px origin-left scale-x-0 bg-leaf" /></div>
            <p className="micro text-night/55">{labels.progress}</p>
          </div>
        </>
      )}
    </section>
  )
}
