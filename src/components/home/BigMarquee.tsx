'use client'

import { useEffect, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { gsap } from 'gsap'

/**
 * Dos cintas de texto gigante en sentidos opuestos. La velocidad de scroll las
 * acelera y las inclina (CSS animation + Web Animations playbackRate).
 */
export default function BigMarquee({ words }: { words: string[] }) {
  const a = useRef<HTMLDivElement>(null)
  const b = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rows = [a.current, b.current].filter(Boolean) as HTMLDivElement[]
    let skew = 0
    const st = ScrollTrigger.create({
      trigger: rows[0]?.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity()
        const rate = 1 + Math.min(6, Math.abs(v) / 260)
        rows.forEach((r) => r.getAnimations().forEach((an) => { an.playbackRate = rate }))
        skew = gsap.utils.clamp(-7, 7, v / -300)
        gsap.to(rows, { skewX: skew, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
      },
    })
    return () => st.kill()
  }, [])

  const group = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={key !== 'a'}>
      {words.map((w, i) => (
        <li key={i} className="flex items-center">
          <span className={`t-mega whitespace-nowrap px-[2.2vw] text-[clamp(7rem,21vw,22rem)] ${i % 2 ? 'outline-text' : ''}`}>{w}</span>
          <span className="h-[2.4vw] w-[2.4vw] shrink-0 rotate-45 bg-night" aria-hidden="true" />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="select-none overflow-hidden" role="img" aria-label={words.join(' ')}>
      <div ref={a} className="marquee-fast">{[group('a'), group('b')]}</div>
      <div ref={b} className="marquee-fast rev -mt-[2vw]">{[group('c'), group('d')]}</div>
    </div>
  )
}
