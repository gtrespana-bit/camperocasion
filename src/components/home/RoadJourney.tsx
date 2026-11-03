'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, Check } from 'lucide-react'

export type RoadStep = {
  key: string
  title: string
  desc: string
  image: string
  alt: string
  links: { label: string; href: string }[]
  sheet?: { title: string; example: string; rows: { label: string; state: string }[] }
}

/**
 * El recorrido de compra como una carretera: una línea serpentea por la
 * sección, se dibuja con el scroll y un punto la recorre. Cada hito revela su
 * fotografía con una máscara.
 */
export default function RoadJourney({ steps }: { steps: RoadStep[] }) {
  const root = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const base = useRef<SVGPathElement>(null)
  const prog = useRef<SVGPathElement>(null)
  const dot = useRef<SVGCircleElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const el = root.current
    const sv = svg.current
    const pBase = base.current
    const pProg = prog.current
    const pDot = dot.current
    if (!el || !sv || !pBase || !pProg || !pDot) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let buildRef: (() => void) | null = null

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('[data-step]')
      let len = 1
      const build = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        sv.setAttribute('viewBox', `0 0 ${w} ${h}`)
        sv.setAttribute('width', String(w))
        sv.setAttribute('height', String(h))
        const cx = w / 2
        const top = el.getBoundingClientRect().top + window.scrollY
        const pts = rows.map((r, i) => {
          const rect = r.getBoundingClientRect()
          const y = rect.top + window.scrollY - top + rect.height / 2
          return { x: cx + (i % 2 === 0 ? -1 : 1) * Math.min(70, w * 0.04), y }
        })
        let d = `M ${cx} 0 C ${cx} ${pts[0].y * 0.5}, ${pts[0].x} ${pts[0].y * 0.5}, ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i]
          const my = (a.y + b.y) / 2
          d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`
        }
        const last = pts[pts.length - 1]
        d += ` C ${last.x} ${last.y + (h - last.y) * 0.5}, ${cx} ${last.y + (h - last.y) * 0.5}, ${cx} ${h}`
        pBase.setAttribute('d', d)
        pProg.setAttribute('d', d)
        len = pProg.getTotalLength()
        pProg.style.strokeDasharray = `${len}`
        pProg.style.strokeDashoffset = reduced ? '0' : `${len}`
        // Hitos sobre la línea
        sv.querySelectorAll<SVGCircleElement>('[data-mile]').forEach((c, i) => {
          if (pts[i]) { c.setAttribute('cx', String(pts[i].x)); c.setAttribute('cy', String(pts[i].y)) }
        })
      }
      build()
      buildRef = build
      ScrollTrigger.addEventListener('refreshInit', build)

      if (reduced) { pDot.style.display = 'none'; return }

      ScrollTrigger.create({
        trigger: el, start: 'top 60%', end: 'bottom 55%', scrub: 0.4,
        onUpdate: (self) => {
          pProg.style.strokeDashoffset = String(len * (1 - self.progress))
          const pt = pProg.getPointAtLength(len * self.progress)
          pDot.setAttribute('cx', String(pt.x))
          pDot.setAttribute('cy', String(pt.y))
        },
      })

      rows.forEach((row) => {
        const mask = row.querySelector('[data-mask]')
        const img = row.querySelector('[data-rimg]')
        const text = row.querySelectorAll('[data-rtext] > *')
        if (mask) {
          gsap.fromTo(mask, { clipPath: 'inset(100% 0% 0% 0%)' }, {
            clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut',
            scrollTrigger: { trigger: row, start: 'top 68%', toggleActions: 'play none none none' },
          })
        }
        if (img) {
          gsap.fromTo(img, { scale: 1.35, yPercent: -6 }, {
            scale: 1.05, yPercent: 6, ease: 'none',
            scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true },
          })
        }
        gsap.from(text, {
          y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: row, start: 'top 62%', toggleActions: 'play none none none' },
        })
      })
    }, el)

    return () => {
      if (buildRef) ScrollTrigger.removeEventListener('refreshInit', buildRef)
      ctx.revert()
    }
  }, [])

  return (
    <div ref={root} className="relative">
      <svg ref={svg} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden lg:block" fill="none">
        <path ref={base} stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
        <path ref={prog} stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
        {steps.map((s, i) => (
          <circle key={s.key} data-mile r="7" fill="#0B1120" stroke="#4ADE80" strokeWidth="2" cx="-50" cy="-50" />
        ))}
        <circle ref={dot} r="9" fill="#EA580C" stroke="rgba(234,88,12,0.35)" strokeWidth="8" cx="-50" cy="-50" />
      </svg>

      {steps.map((s, i) => {
        const imgLeft = i % 2 === 0
        return (
          <article key={s.key} data-step className="relative mx-auto grid w-full max-w-[1360px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:gap-0 lg:py-16">
            <div className={`lg:col-span-6 ${imgLeft ? 'lg:col-start-1' : 'lg:col-start-7 lg:row-start-1'}`}>
              <div data-mask className="relative aspect-[5/4] overflow-hidden bg-night-700">
                <div data-rimg className="absolute -inset-[8%] will-change-transform">
                  <Image src={s.image} alt={s.alt} fill sizes="(max-width: 1024px) 92vw, 40vw" quality={80} className="object-cover" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-night/55 via-transparent to-transparent" aria-hidden="true" />
                {s.sheet && (
                  <figure className="absolute inset-x-4 bottom-4 border border-white/20 bg-night/70 p-5 text-white backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:max-w-[360px] sm:p-6">
                    <figcaption className="micro flex items-center justify-between gap-3 text-white/60">
                      <span>{s.sheet.title}</span>
                      <span className="border border-white/25 px-2 py-0.5 !tracking-[0.06em] normal-case">{s.sheet.example}</span>
                    </figcaption>
                    <ul className="mt-4 divide-y divide-white/12">
                      {s.sheet.rows.map((r) => (
                        <li key={r.label} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
                          <span>{r.label}</span>
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-leaf-300">
                            <Check size={14} strokeWidth={2.6} aria-hidden="true" /> {r.state}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </figure>
                )}
              </div>
            </div>

            <div data-rtext className={`lg:col-span-5 ${imgLeft ? 'lg:col-start-8' : 'lg:col-start-1 lg:row-start-1'}`}>
              <p className="t-mega text-[clamp(4.5rem,9vw,8.5rem)] text-transparent [-webkit-text-stroke:1.5px_rgba(74,222,128,0.7)]">0{i + 1}</p>
              <h3 className="t-wide mt-6 text-[clamp(2rem,3.8vw,3.6rem)] leading-[0.98]">{s.title}</h3>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/70">{s.desc}</p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                {s.links.map((l) => (
                  <LocalLink
                    key={l.href}
                    href={l.href}
                    className="group inline-flex h-11 items-center gap-2 border border-white/30 px-4 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors duration-300 hover:border-leaf hover:bg-leaf hover:text-[#04140A]"
                  >
                    {l.label}
                    <ArrowUpRight size={15} className="transition-transform duration-500 group-hover:rotate-45" aria-hidden="true" />
                  </LocalLink>
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
