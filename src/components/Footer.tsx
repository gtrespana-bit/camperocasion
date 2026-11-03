'use client'

import BrandLogo from '@/components/BrandLogo'
import LocalLink from '@/components/LocalLink'
import { hayDatosTitular } from '@/lib/datos-legales'
import { useTranslations } from 'next-intl'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { ArrowUpRight } from 'lucide-react'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'

// Familias → tipos: la navegación del footer refleja la taxonomía real del
// vertical (la categoría única `camper` no se expone en la UI).
const FAMILIAS_FOOTER = FAMILIAS.map(f => ({
  key: f.key,
  tipos: f.subs
    .map(slug => categoriasData.camper.subs.find(s => s.slug === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map(s => ({
      label: s.label,
      href: `/catalogo?subcategoria=${encodeURIComponent(s.label)}`,
    })),
}))

// Provincias principales → landing pages SEO locales (/[provincia])
const PROVINCIAS_FOOTER = ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'alicante']
  .map(slug => CIUDADES_SEO.find(c => c.slug === slug))
  .filter((c): c is NonNullable<typeof c> => Boolean(c))

export function Footer() {
  const t = useTranslations()
  const info: [string, string][] = [
    [t('footer.brands'), '/marcas'],
    ['¿Cuánto vale mi camper?', '/cuanto-vale-mi-camper'],
    ['Blog', '/blog'],
    ['Calcular el ITP', '/calcular-itp'],
    ['Contrato de compraventa', '/contrato-compraventa'],
    ['Gestoría cambio de nombre', '/gestoria-cambio-nombre'],
    ['Compra segura', '/compra-segura-camper'],
    ['Planes para profesionales', '/para-profesionales'],
    [t('footer.howItWorks'), '/como-funciona'],
    [t('footer.aboutUs'), '/sobre-nosotros'],
    ['FAQ', '/faq'],
    [t('nav.contact'), '/contacto'],
  ]

  const h = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-50/45'
  const a = 'text-[14.5px] text-sand-50/75 transition-colors duration-300 hover:text-white'

  return (
    <footer className="relative mt-auto overflow-hidden bg-ink pb-24 text-sand-50 md:pb-0">
      <div className="mx-auto w-full max-w-[1360px] px-5 pt-20 sm:px-8 lg:pt-28">
        {/* Remate */}
        <div className="grid gap-10 border-b border-white/12 pb-16 lg:grid-cols-12 lg:items-end">
          <h2 className="font-display text-[clamp(2.6rem,6vw,5.6rem)] leading-[0.98] lg:col-span-8">
            {t('footer.tagline')}
          </h2>
          <div className="lg:col-span-4 lg:text-right">
            <LocalLink
              href="/publicar"
              className="group inline-flex items-center gap-3 rounded-full bg-ember py-4 pl-8 pr-5 text-[15px] font-semibold text-white transition-colors duration-500 hover:bg-white hover:text-ink"
            >
              {t('landing.cta.publish')}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-all duration-500 group-hover:bg-ink group-hover:text-white">
                <ArrowUpRight size={16} className="transition-transform duration-500 group-hover:rotate-45" aria-hidden="true" />
              </span>
            </LocalLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-16 md:grid-cols-12">
          <div className="col-span-2 md:col-span-4">
            <BrandLogo href="/" tone="light" size="md" />
            <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-sand-50/60">{t('footer.description')}</p>
          </div>

          <nav aria-label={t('footer.categories')} className="col-span-2 md:col-span-3">
            <h3 className={h}>{t('footer.categories')}</h3>
            <div className="mt-5 space-y-6">
              {FAMILIAS_FOOTER.map((f) => (
                <div key={f.key}>
                  <p className="font-display text-[20px] leading-none text-sand-50">{t(`familias.${f.key}.label`)}</p>
                  <ul className="mt-3 space-y-2">
                    {f.tipos.map((c) => (
                      <li key={c.label}><LocalLink href={c.href} className={a}>{c.label}</LocalLink></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <nav aria-label={t('footer.cities')} className="md:col-span-2">
            <h3 className={h}>{t('footer.cities')}</h3>
            <ul className="mt-5 space-y-2">
              {PROVINCIAS_FOOTER.map((c) => (
                <li key={c.slug}>
                  <LocalLink href={`/${c.slug}`} className={a}>{t('footer.classifiedsIn', { city: c.nombre })}</LocalLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('footer.information')} className="md:col-span-3">
            <h3 className={h}>{t('footer.information')}</h3>
            <ul className="mt-5 space-y-2">
              {info.map(([l, p]) => (
                <li key={p}><LocalLink href={p} className={a}>{l}</LocalLink></li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/12 py-7 text-[13px] text-sand-50/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} CamperOcasión. {t('footer.allRightsReserved')}</p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li><LocalLink href="/terminos-y-condiciones" className="transition-colors hover:text-white">{t('footer.terms')}</LocalLink></li>
            <li><LocalLink href="/politica-de-privacidad" className="transition-colors hover:text-white">{t('footer.privacy')}</LocalLink></li>
            <li><LocalLink href="/politica-de-cookies" className="transition-colors hover:text-white">{t('footer.cookies')}</LocalLink></li>
            {/* El aviso legal solo se enlaza cuando el titular está
                configurado: antes de eso la página no está completa y no
                debe presentarse como si lo estuviera. */}
            {hayDatosTitular() && (
              <li><LocalLink href="/aviso-legal" className="transition-colors hover:text-white">{t('footer.legalNotice')}</LocalLink></li>
            )}
          </ul>
        </div>
      </div>

      {/* Marca monumental, recortada por el borde inferior */}
      <div className="pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <p className="font-display whitespace-nowrap px-4 text-center text-[17.5vw] leading-[0.78] tracking-[-0.03em] text-white/[0.07]">
          Camper<em className="italic">Ocasión</em>
        </p>
      </div>
    </footer>
  )
}
