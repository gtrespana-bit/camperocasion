'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'

/** Atrae suavemente su contenido hacia el puntero cuando está cerca. */
export default function Magnetic({ children, strength = 0.28, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.55)' })
    const qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.55)' })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      qx((e.clientX - (r.left + r.width / 2)) * strength)
      qy((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => { qx(0); qy(0) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [strength])

  return <div ref={ref} className={`inline-block ${className}`}>{children}</div>
}
