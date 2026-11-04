import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight } from 'lucide-react'

export type RoutePanel = {
  key: string
  label: string
  desc: string
  image: string
  alt: string
  href: string
  tipos: { label: string; href: string }[]
}

/** Las tres familias se comparan de un vistazo, sin fijar pantallas ni ocultar
 * el catálogo que viene después. Cada enlace conserva su filtro original. */
export default function RoutePanels({ panels, explore, kicker }: { panels: RoutePanel[]; explore: string; kicker: string }) {
  return (
    <section className="bg-[#F5F7FA] py-14 text-night lg:py-20" aria-label={kicker}>
      <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-8">
        <p className="micro mb-6 flex items-center gap-3 text-night/75">
          <span className="t-num text-leaf-700">03</span><span className="h-px w-8 bg-night/45" aria-hidden="true" />{kicker}
        </p>
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {panels.map((p, i) => (
            <article key={p.key} className="relative isolate flex min-h-[460px] flex-col overflow-hidden bg-night px-6 pb-6 pt-6 text-white sm:min-h-[490px] lg:min-h-[540px] lg:px-7 lg:pb-7">
              <Image
                src={p.image}
                alt={p.alt}
                fill
                sizes="(max-width: 1023px) 100vw, 33vw"
                quality={75}
                className="-z-20 object-cover transition-transform duration-700 motion-safe:hover:scale-[1.035]"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/65 to-night/20" aria-hidden="true" />
              <p className="t-num text-sm text-white/85">0{i + 1} <span className="text-white/55">/ 0{panels.length}</span></p>
              {/* El título empieza a la misma altura en las tres tarjetas.
                  Los chips ocupan una banda inferior común: 1 o 3 opciones no
                  desplazan ni el título ni el CTA de las tarjetas vecinas. */}
              <div className="mt-10 flex flex-1 flex-col lg:mt-12">
                <div>
                  <h2 className="min-h-[4.75rem] max-w-[17ch] font-grotesk text-[clamp(1.85rem,2.4vw,2.45rem)] font-bold leading-[1.1] tracking-tight [text-wrap:balance]">{p.label}</h2>
                  <p className="mt-3 min-h-[4.75rem] max-w-[34ch] text-sm leading-relaxed text-white/85">{p.desc}</p>
                </div>
                <div className="mt-auto">
                  <ul className="flex min-h-[9rem] flex-wrap content-end items-end gap-2 border-t border-white/30 pt-4">
                    {p.tipos.map((tp) => (
                      <li key={tp.label}>
                        <LocalLink href={tp.href} className="inline-flex min-h-10 items-center border border-white/45 bg-night/35 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-white hover:bg-white hover:text-night focus-visible:bg-white focus-visible:text-night">
                          {tp.label}
                        </LocalLink>
                      </li>
                    ))}
                  </ul>
                  <LocalLink href={p.href} className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-leaf-300 pb-1 text-sm font-semibold text-white transition-colors hover:text-leaf-300">
                    {explore} <ArrowUpRight size={17} aria-hidden="true" />
                  </LocalLink>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
