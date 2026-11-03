'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type Province = { slug: string; name: string; coord: string; image: string }

/**
 * Lista monumental de provincias. Al pasar el puntero, una fotografía sigue al
 * cursor y el resto de filas se apaga. En táctil es una lista limpia.
 */
export default function ProvinceList({ items, label }: { items: Province[]; label: string }) {
  const [active, setActive] = useState(-1)
  const preview = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = preview.current
    if (!el) return
    if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.set(el, { xPercent: -50, yPercent: -50 })
    const qx = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' })
    const qy = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' })
    const qr = gsap.quickTo(el, 'rotation', { duration: 0.8, ease: 'power3' })
    let lastX = 0
    const move = (e: PointerEvent) => {
      qx(e.clientX + 40)
      qy(e.clientY)
      qr(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.35))
      lastX = e.clientX
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <>
      <ul className="border-b border-white/15 lg:grid lg:grid-flow-col lg:grid-rows-6 lg:gap-x-16 lg:border-b-0" onMouseLeave={() => setActive(-1)}>
        {items.map((p, i) => (
          <li key={p.slug} className="border-t border-white/15 last:border-b lg:[&:nth-child(6)]:border-b">
            <LocalLink
              href={`/${p.slug}`}
              aria-label={`${label} ${p.name}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(-1)}
              className={`group flex items-center justify-between gap-6 py-3.5 transition-opacity duration-500 sm:py-4 ${active === -1 || active === i ? 'opacity-100' : 'opacity-25'}`}
            >
              <span className="flex items-baseline gap-5 sm:gap-8">
                <span className="t-num w-6 text-[13px] text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <span className="t-mega home-province-name min-w-0 transition-[transform,color] duration-700 ease-out group-hover:translate-x-3 group-hover:text-leaf-300">{p.name}</span>
              </span>
              <span className="flex items-center gap-5">
                <span className="micro hidden text-white/45 xl:block">{p.coord}</span>
                <ArrowUpRight size={26} className="shrink-0 -translate-x-3 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 max-sm:hidden" aria-hidden="true" />
              </span>
            </LocalLink>
          </li>
        ))}
      </ul>

      <div
        ref={preview}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-40 hidden h-[300px] w-[240px] overflow-hidden transition-[opacity,clip-path] duration-500 [@media(pointer:fine)]:block"
        style={{ opacity: active === -1 ? 0 : 1, clipPath: active === -1 ? 'inset(50% 50% 50% 50%)' : 'inset(0% 0% 0% 0%)' }}
      >
        {items.map((p, i) => (
          <Image
            key={p.slug}
            src={p.image}
            alt=""
            fill
            sizes="240px"
            className={`object-cover transition-opacity duration-500 ${i === active ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>
    </>
  )
}
