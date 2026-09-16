'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export function ScrollAnimate({ children, className = 'animate-on-scroll', delay = '' }: { children: ReactNode, className?: string, delay?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`${className} ${delay}`.trim()}>
      {children}
    </div>
  )
}
