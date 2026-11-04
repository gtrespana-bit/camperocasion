'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Cifra con ruedas de odómetro: cada dígito es una columna 0-9 que rueda hasta
 * su valor al entrar en pantalla. El HTML del servidor ya muestra el valor final.
 */
export default function Odometer({ value, suffix = '', className = '' }: { value: number; suffix?: string; className?: string }) {
  const root = useRef<HTMLSpanElement>(null)
  const text = String(value)

  useIso(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return
    const cols = Array.from(el.querySelectorAll<HTMLElement>('[data-d]'))
    cols.forEach((c) => { c.style.transition = 'none'; c.style.transform = 'translateY(0)' })
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        cols.forEach((c, i) => {
          const d = Number(c.dataset.d)
          c.style.transition = `transform ${1.5 + i * 0.18}s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.06}s`
          c.style.transform = `translateY(-${d * 10}%)`
        })
        io.disconnect()
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <span ref={root} className={`inline-flex ${className}`} aria-label={`${value}${suffix}`}>
      {text.split('').map((ch, i) => (
        <span key={i} aria-hidden="true" className="relative inline-block h-[1em] overflow-hidden leading-none">
          <span data-d={ch} className="flex flex-col" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block h-[1em] leading-none">{n}</span>
            ))}
          </span>
        </span>
      ))}
      {suffix && <span aria-hidden="true" className="leading-none">{suffix}</span>}
    </span>
  )
}
