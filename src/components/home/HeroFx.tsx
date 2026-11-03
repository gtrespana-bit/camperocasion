'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Envoltorio del hero. Escribe tres variables CSS en el elemento:
 *  --hp  progreso de scroll (0 → 1) mientras el hero sale de pantalla
 *  --mx / --my  posición suavizada del puntero (-1 → 1) para el paralaje
 * Todo el movimiento vive en CSS (globals.css); aquí solo se miden valores.
 */
export default function HeroFx({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      const p = Math.min(1, Math.max(0, window.scrollY / (el.offsetHeight * 0.85)))
      el.style.setProperty('--hp', p.toFixed(4))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    let tx = 0, ty = 0, cx = 0, cy = 0, mraf = 0
    const loop = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.setProperty('--mx', cx.toFixed(4))
      el.style.setProperty('--my', cy.toFixed(4))
      mraf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : 0
    }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!mraf) mraf = requestAnimationFrame(loop)
    }
    const fine = window.matchMedia('(pointer: fine)').matches
    if (fine) el.addEventListener('pointermove', move)

    return () => {
      window.removeEventListener('scroll', onScroll)
      el.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(mraf)
    }
  }, [])

  return <section ref={ref} className={className}>{children}</section>
}
