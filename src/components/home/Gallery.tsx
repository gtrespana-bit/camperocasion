import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, MapPin } from 'lucide-react'

export type GalleryItem = {
  id: string
  href: string
  title: string
  image: string
  price: string
  place: string
  condition: string
  ago: string | null
  badge: 'featured' | 'new' | null
}

type Labels = { featured: string; isNew: string; see: string; empty: string; emptyCta: string; progress: string }

/** Anuncios visibles antes que la narrativa: carril nativo en móvil y
 * cuadrícula comparable en escritorio. Sin secuestro del scroll vertical. */
export default function Gallery({ items, labels, header }: { items: GalleryItem[]; labels: Labels; header: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-bone to-[#E6ECF3] py-16 text-night lg:py-20">
      <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-8">{header}</div>

      {items.length === 0 ? (
        <div className="mx-auto mt-14 w-full max-w-[1360px] px-5 sm:px-8">
          <div className="flex flex-col items-start gap-6 border border-night/20 p-10">
            <p className="font-grotesk text-[clamp(1.8rem,3vw,2.8rem)] font-bold leading-tight">{labels.empty}</p>
            <LocalLink href="/publicar" className="btn btn-ink">
              {labels.emptyCta} <ArrowUpRight size={18} className="btn-ico" aria-hidden="true" />
            </LocalLink>
          </div>
        </div>
      ) : (
        <>
          <p className="micro mx-auto mt-8 max-w-[1360px] px-5 text-night/75 sm:px-8 lg:hidden">{labels.progress} →</p>
          <div className="mt-4 overflow-x-auto snap-x snap-mandatory px-5 pb-4 [scrollbar-width:none] sm:px-8 lg:mx-auto lg:mt-10 lg:max-w-[1360px] lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-4 lg:grid lg:w-full lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              {items.map((it, i) => (
                <LocalLink
                  key={it.id}
                  href={it.href}
                  data-cursor={labels.see}
                  className="group flex w-[76vw] shrink-0 snap-start flex-col border border-night/10 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-32px_rgba(15,23,42,0.35)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_1px_0_rgba(15,23,42,0.04),0_36px_60px_-28px_rgba(15,23,42,0.45)] sm:w-[46vw] lg:w-full"
                >
                  <div className="relative aspect-[5/4] overflow-hidden bg-night/10">
                    <div className="absolute inset-0">
                      <Image
                        src={it.image}
                        alt={it.title}
                        fill
                        sizes="(max-width: 1024px) 76vw, 460px"
                        quality={75}
                        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night/45 to-transparent" aria-hidden="true" />
                    <span className="t-num absolute bottom-3 left-4 text-[13px] text-white">{String(i + 1).padStart(2, '0')}</span>
                    {it.badge && (
                      <span className={`micro absolute left-0 top-4 px-3 py-1.5 ${it.badge === 'featured' ? 'bg-flare text-white' : 'bg-leaf text-[#04140A]'}`}>
                        {it.badge === 'featured' ? labels.featured : labels.isNew}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4 lg:p-5">
                    <h3 className="truncate text-[16.5px] font-semibold leading-tight">{it.title}</h3>
                    <p className="mt-2 flex items-center gap-2 truncate text-[12.5px] text-night/75">
                      {it.place && <><MapPin size={13} aria-hidden="true" className="shrink-0 text-leaf" />{it.place}</>}
                      {it.condition && <><span className="h-1 w-1 shrink-0 rounded-full bg-night/25" aria-hidden="true" />{it.condition}</>}
                      {it.ago && <><span className="h-1 w-1 shrink-0 rounded-full bg-night/25" aria-hidden="true" />{it.ago}</>}
                    </p>
                    <div className="mt-auto flex items-end justify-between border-t border-night/10 pt-4">
                      <p className="t-num text-[28px] leading-none">{it.price}</p>
                      <span className="flex h-9 w-9 items-center justify-center bg-night text-white transition-colors duration-500 group-hover:bg-leaf group-hover:text-[#04140A]">
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </LocalLink>
              ))}
            </div>
          </div>

        </>
      )}
    </section>
  )
}
