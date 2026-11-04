'use client'

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'

// useLayoutEffect avisa en SSR; en el servidor no hace falta, así que se degrada.
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Revela su contenido al entrar en pantalla.
 *
 * Progresivo por diseño: el HTML del servidor es siempre visible (SEO, sin JS,
 * lectores de pantalla). Solo en el navegador, y solo si el bloque está por
 * debajo del pliegue, se oculta antes del primer pintado y se anima al llegar.
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
}: {
  children: ReactNode
  as?: ElementType
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLElement | null>(null)

  useIso(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const top = el.getBoundingClientRect().top
    if (top < window.innerHeight * 0.9) return
    el.classList.add('reveal')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-in')
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const style = { '--d': `${delay}s` } as CSSProperties
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  )
}
