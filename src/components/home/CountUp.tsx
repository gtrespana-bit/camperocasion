'use client'

import { useEffect, useRef, useState } from 'react'

/** Número que sube hasta su valor al entrar en pantalla. Sin JS muestra el valor final. */
export default function CountUp({ value, suffix = '', locale = 'es-ES' }: { value: number; suffix?: string; locale?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setN(0)
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const dur = 1400
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur)
        const eased = 1 - Math.pow(1 - p, 4)
        setN(Math.round(value * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])

  return <span ref={ref} className="tabular">{n.toLocaleString(locale)}{suffix}</span>
}
