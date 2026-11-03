'use client'

import { useEffect, useRef } from 'react'

const BASE = 62
const PEAK = 112
const RADIUS = 260

/**
 * Titular monumental en una grotesca de anchura variable. Cada letra se ensancha
 * al acercar el puntero (eje wdth de la fuente), como si el texto fuese materia.
 * Las líneas suben desde una máscara al cargar (CSS). Sin puntero fino: estático.
 */
export default function KineticTitle({ lines, className = '' }: { lines: string[]; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const chars = Array.from(el.querySelectorAll<HTMLElement>('.kc'))
    const cur = chars.map(() => BASE)
    const goal = chars.map(() => BASE)
    let centers: { x: number; y: number }[] = []
    let raf = 0
    let active = false

    const measure = () => {
      centers = chars.map((c) => {
        const r = c.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
    }
    const loop = () => {
      let moving = false
      for (let i = 0; i < chars.length; i++) {
        const diff = goal[i] - cur[i]
        if (Math.abs(diff) > 0.15) {
          cur[i] += diff * 0.14
          chars[i].style.fontVariationSettings = `'wdth' ${cur[i].toFixed(1)}, 'wght' 800`
          moving = true
        }
      }
      raf = moving || active ? requestAnimationFrame(loop) : 0
    }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const near = e.clientY > r.top - 140 && e.clientY < r.bottom + 140
      active = near
      if (!near) {
        for (let i = 0; i < goal.length; i++) goal[i] = BASE
      } else {
        // No remedir en cada movimiento: el layout cambia poco y es caro
        if (!centers.length) measure()
        for (let i = 0; i < chars.length; i++) {
          const dx = e.clientX - centers[i].x
          const dy = (e.clientY - centers[i].y) * 0.7
          const d = Math.hypot(dx, dy)
          goal[i] = BASE + (PEAK - BASE) * Math.exp(-(d * d) / (RADIUS * RADIUS))
        }
      }
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const reset = () => { centers = [] }
    const lateMeasure = window.setTimeout(measure, 2600)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', reset)
    return () => {
      window.clearTimeout(lateMeasure)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', reset)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <h1 ref={root} aria-label={lines.join(' ')} className={className}>
      {lines.map((line, li) => (
        <span key={li} className="mask-line" aria-hidden="true">
          <span style={{ '--d': `${0.2 + li * 0.14}s` } as React.CSSProperties}>
            {line.split('').map((ch, i) =>
              ch === ' ' ? <span key={i} className="inline-block w-[0.22em]" /> : <span key={i} className="kc">{ch}</span>,
            )}
          </span>
        </span>
      ))}
    </h1>
  )
}
