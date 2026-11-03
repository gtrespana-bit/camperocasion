'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

export type Word = { t: string; em?: boolean }

/**
 * Párrafo monumental cuyas palabras se «encienden» según el scroll.
 * El servidor entrega el texto completo y legible; solo en el navegador se
 * atenúa y se va revelando.
 */
export default function ScrollWords({ words, className = '' }: { words: Word[]; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null)

  useIso(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.setAttribute('data-js', '')
    const spans = Array.from(el.querySelectorAll<HTMLElement>('.sw-w'))
    const n = spans.length
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.2)))
      const t = p * (n + 5)
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, Math.max(0, (t - i) / 4))
        spans[i].style.opacity = String(0.14 + 0.86 * k)
      }
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
  }, [])

  return (
    <p ref={root} className={`sw ${className}`}>
      {words.map((w, i) => (
        <span key={i} className={`sw-w transition-opacity duration-150 ${w.em ? 'italic' : ''}`}>
          {w.t}{' '}
        </span>
      ))}
    </p>
  )
}
