'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

/**
 * Cursor propio solo para puntero fino. Un punto que se transforma:
 *  · sobre enlaces y botones crece y se invierte (mix-blend-mode),
 *  · sobre [data-cursor="Texto"] se convierte en un disco con esa etiqueta.
 */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)').matches
    if (!fine || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = root.current
    const lab = label.current
    if (!el || !lab) return

    document.documentElement.classList.add('has-cursor')
    gsap.set(el, { xPercent: -50, yPercent: -50, x: -100, y: -100 })
    const qx = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' })
    const qy = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' })
    let shown = false

    const move = (e: PointerEvent) => {
      if (!shown) {
        shown = true
        gsap.set(el, { x: e.clientX, y: e.clientY })
        el.style.opacity = '1'
      }
      qx(e.clientX)
      qy(e.clientY)
    }

    const setState = (state: 'idle' | 'link' | 'label', text = '') => {
      el.dataset.state = state
      lab.textContent = text
    }
    const over = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (!t || !t.closest) return
      const tagged = t.closest<HTMLElement>('[data-cursor]')
      if (tagged) return setState('label', tagged.dataset.cursor || '')
      if (t.closest('a, button, summary, [role="tab"]')) return setState('link')
      setState('idle')
    }
    const leave = () => { el.style.opacity = '0'; shown = false }

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-state="idle"
      style={{ opacity: 0 }}
      className="group/c pointer-events-none fixed left-0 top-0 z-[90] hidden transition-opacity duration-300 [@media(pointer:fine)]:block"
    >
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-white mix-blend-difference transition-[width,height,background-color] duration-500 ease-out group-data-[state=link]/c:h-10 group-data-[state=link]/c:w-10 group-data-[state=label]/c:h-[104px] group-data-[state=label]/c:w-[104px] group-data-[state=label]/c:bg-flare group-data-[state=label]/c:mix-blend-normal">
        <span ref={label} className="micro text-night opacity-0 transition-opacity duration-300 group-data-[state=label]/c:opacity-100" />
      </div>
    </div>
  )
}
