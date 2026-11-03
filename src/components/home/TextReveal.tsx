'use client'

import { useEffect, useLayoutEffect, useRef, type ElementType } from 'react'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

export type RevealLine = { t: string; outline?: boolean; cls?: string }

/**
 * Titular dividido en palabras que suben desde una máscara al entrar en
 * pantalla. Progresivo: el texto completo está en el HTML del servidor; solo
 * en el navegador y bajo el pliegue se arma la animación.
 */
export default function TextReveal({
  lines,
  as: Tag = 'h2',
  className = '',
  inline = false,
}: {
  lines: RevealLine[]
  as?: ElementType
  className?: string
  inline?: boolean
}) {
  const ref = useRef<HTMLElement | null>(null)

  useIso(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return
    el.setAttribute('data-armed', '')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-in')
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  let n = 0
  return (
    <Tag ref={ref} className={`tr ${className}`}>
      {lines.map((line, li) => (
        <span key={li} className={`${inline ? 'inline' : 'block'} ${line.outline ? 'outline-text' : ''} ${line.cls || ''}`}>
          {line.t.split(' ').map((w, wi) => (
            <span key={wi} className="tr-w" style={{ '--i': n++ } as React.CSSProperties}>
              <span>{w}</span>
              {'\u00A0'}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  )
}
