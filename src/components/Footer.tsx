'use client'

import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { categoriasData } from '@/lib/categorias'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'

// Subcategorías camper → filtros del catálogo
const SUBCATEGORIAS_FOOTER = categoriasData.camper.subs.map(s => ({
  label: s.label,
  href: `/catalogo?categoria=camper&subcategoria=${encodeURIComponent(s.label)}`,
}))

// Provincias principales → landing pages SEO locales (/[provincia])
const PROVINCIAS_FOOTER = ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'alicante']
  .map(slug => CIUDADES_SEO.find(c => c.slug === slug))
  .filter((c): c is NonNullable<typeof c> => Boolean(c))

export function Footer() {
  const t = useTranslations()

  return (
    <footer className="bg-brand-dark text-gray-300 mt-auto pb-20 md:pb-0">
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div>
              <LocalLink href="/" className="inline-flex items-center gap-2 mb-3">
                <Image src="/logo-camperocasion.png" alt="CamperOcasión" width={28} height={28} className="h-7 w-7 object-contain rounded-lg drop-shadow-[0_0_4px_rgba(255,255,255,0.4)] bg-white/80 p-0.5" />
                <span className="font-black text-lg"><span className="text-white">Camper</span><span className="text-green-400">Ocasión</span></span>
              </LocalLink>
              <p className="text-sm leading-relaxed">{t('footer.description')}</p>
            </div>
            <nav aria-label={t('footer.categories')}>
              <h3 className="text-white font-bold mb-3">{t('footer.categories')}</h3>
              <ul className="space-y-2 text-sm">
                {SUBCATEGORIAS_FOOTER.map(c => (
                  <li key={c.label}>
                    <LocalLink href={c.href} className="hover:text-green-400 transition">
                      {c.label}
                    </LocalLink>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={t('footer.cities')}>
              <h3 className="text-white font-bold mb-3">{t('footer.cities')}</h3>
              <ul className="space-y-2 text-sm">
                {PROVINCIAS_FOOTER.map(c => (
                  <li key={c.slug}>
                    <LocalLink href={`/${c.slug}`} className="hover:text-green-400 transition">
                      {t('footer.classifiedsIn', { city: c.nombre })}
                    </LocalLink>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={t('footer.information')}>
              <h3 className="text-white font-bold mb-3">{t('footer.information')}</h3>
              <ul className="space-y-2 text-sm">
                {[
                  ['Blog', '/blog'],
                  ['Calcular el ITP', '/calcular-itp'],
                  ['Compra segura', '/compra-segura-camper'],
                  [t('footer.howItWorks'), '/como-funciona'],
                  [t('footer.aboutUs'), '/sobre-nosotros'],
                  ['FAQ', '/faq'],
                  [t('nav.contact'), '/contacto'],
                ].map(([l, p]) => (
                  <li key={p}><LocalLink href={p} className="hover:text-green-400 transition">{l}</LocalLink></li>
                ))}
              </ul>
            </nav>
            <div>
              <h3 className="text-white font-bold mb-3">{t('footer.legal')}</h3>
              <ul className="space-y-2 text-sm">
                <li><LocalLink href="/terminos-y-condiciones" className="hover:text-green-400 transition">{t('footer.terms')}</LocalLink></li>
                <li><LocalLink href="/politica-de-privacidad" className="hover:text-green-400 transition">{t('footer.privacy')}</LocalLink></li>
              </ul>
              <p className="text-xs text-gray-300 mt-4">{t('footer.madeWithLove')}</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm">
            <p>© {new Date().getFullYear()} CamperOcasión. {t('footer.allRightsReserved')}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
