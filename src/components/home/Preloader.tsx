'use client'

import { useLayoutEffect } from 'react'

const useIso = typeof window === 'undefined' ? () => {} : useLayoutEffect

/**
 * Cortina de entrada: solo en la primera visita de la sesión. El HTML del
 * servidor la pinta (sin parpadeo) y todo el movimiento es CSS puro; el script
 * en línea decide, antes del primer pintado, si debe mostrarse.
 */
export default function Preloader({ label }: { label: string }) {
  useIso(() => {
    const root = document.documentElement
    // Navegación interna de vuelta a la portada: nunca repetir la cortina.
    if (root.dataset.preDone) {
      root.dataset.pre = '0'
      return
    }
    const id = window.setTimeout(() => {
      root.dataset.preDone = '1'
      root.dataset.pre = '0'
    }, 2900)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var d=document.documentElement;if(sessionStorage.getItem('co-pre')||matchMedia('(prefers-reduced-motion: reduce)').matches){d.dataset.pre='0'}else{d.dataset.pre='1';sessionStorage.setItem('co-pre','1')}}catch(e){document.documentElement.dataset.pre='0'}",
        }}
      />
      <div id="co-pre" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-7 sm:px-8">
          <span className="micro text-white/70">{label}</span>
          <span className="micro text-white/40">ES · 2026</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-8">
          <p className="t-mega flex items-end text-[clamp(8rem,30vw,28rem)] leading-[0.76]">
            <span className="pre-count tabular-nums" />
            <span className="mb-[0.08em] ml-[0.04em] text-[0.32em] text-leaf-300">%</span>
          </p>
          <div className="mt-6 h-px w-full bg-white/15">
            <div className="pre-bar h-px w-full bg-white" />
          </div>
        </div>
      </div>
    </>
  )
}
