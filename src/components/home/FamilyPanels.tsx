'use client'

import { useState } from 'react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type FamilyPanel = {
  key: string
  label: string
  desc: string
  image: string
  alt: string
  href: string
  tipos: { label: string; href: string; hint: string }[]
}

/**
 * Tres paneles a pantalla casi completa. En escritorio el panel activo se
 * expande y los otros se pliegan a una etiqueta vertical; en móvil se apilan.
 */
export default function FamilyPanels({ families, explore }: { families: FamilyPanel[]; explore: string }) {
  const [active, setActive] = useState(0)

  return (
    <div className="flex flex-col gap-3 md:h-[min(78vh,720px)] md:min-h-[540px] md:flex-row md:gap-3">
      {families.map((f, i) => {
        const on = i === active
        return (
          <article
            key={f.key}
            data-active={on}
            onMouseEnter={() => setActive(i)}
            onFocusCapture={() => setActive(i)}
            onClick={() => setActive(i)}
            className="group/panel panel-grow relative h-[460px] overflow-hidden rounded-[26px] bg-ink md:h-auto md:flex-1 md:data-[active=true]:flex-[3.3]"
          >
            <Image
              src={f.image}
              alt={f.alt}
              fill
              sizes="(max-width: 768px) 94vw, 62vw"
              className="object-cover transition-transform duration-[1800ms] ease-out md:scale-110 md:group-data-[active=true]/panel:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-ink/30" aria-hidden="true" />

            {/* Estado plegado (solo escritorio) */}
            <div className="pointer-events-none absolute inset-0 hidden transition-opacity duration-500 md:block md:group-data-[active=true]/panel:opacity-0">
              <span className="absolute left-6 top-6 font-mono text-[11px] tracking-[0.16em] text-white/80">0{i + 1}</span>
              <span
                className="font-display absolute bottom-7 left-6 text-[34px] leading-none text-white [writing-mode:vertical-rl] rotate-180"
              >
                {f.label}
              </span>
            </div>

            {/* Contenido activo */}
            <div className="absolute inset-x-0 bottom-0 p-6 transition-all duration-700 ease-out sm:p-8 md:translate-y-4 md:p-10 md:opacity-0 md:group-data-[active=true]/panel:translate-y-0 md:group-data-[active=true]/panel:opacity-100 md:group-data-[active=true]/panel:delay-200">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">0{i + 1} / 0{families.length}</p>
              <h3 className="font-display mt-3 text-[clamp(2.4rem,4.4vw,4.4rem)] leading-[0.95] text-white">{f.label}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75">{f.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {f.tipos.map((tp) => (
                  <LocalLink
                    key={tp.label}
                    href={tp.href}
                    title={tp.hint}
                    tabIndex={on ? 0 : -1}
                    className="rounded-full border border-white/30 bg-white/5 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-colors duration-300 hover:border-white hover:bg-white hover:text-ink"
                  >
                    {tp.label}
                  </LocalLink>
                ))}
              </div>
              <LocalLink
                href={f.href}
                tabIndex={on ? 0 : -1}
                className="group mt-6 inline-flex items-center gap-3 text-[14px] font-medium text-white"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                  <ArrowUpRight size={18} />
                </span>
                <span className="link-draw pb-0.5">{explore}</span>
              </LocalLink>
            </div>
          </article>
        )
      })}
    </div>
  )
}
