'use client'

import BrandLogo from '@/components/BrandLogo'
import LocalLink from '@/components/LocalLink'
import { hayDatosTitular } from '@/lib/datos-legales'
import { useTranslations } from 'next-intl'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'

// Familias → tipos: la navegación del footer refleja la taxonomía real del
// vertical (la categoría única `camper` no se expone en la UI).
const FAMILIAS_FOOTER = FAMILIAS.map(f => ({
  key: f.key,
  icon: f.icon,
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

  return (
    <footer className="bg-brand-dark text-gray-300 mt-auto pb-20 md:pb-0">
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div>
              <BrandLogo href="/" tone="light" size="md" className="mb-3" />
              <p className="text-sm leading-relaxed">{t('footer.description')}</p>
            </div>
            <nav aria-label={t('footer.categories')}>
              <h3 className="text-white font-bold mb-3">{t('footer.categories')}</h3>
              <ul className="space-y-2 text-sm">
                {FAMILIAS_FOOTER.map(f => (
                  <li key={f.key}>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-2 first:mt-0">
                      {f.icon} {t(`familias.${f.key}.label`)}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {f.tipos.map(c => (
                        <li key={c.label}>
                          <LocalLink href={c.href} className="hover:text-green-400 transition">
                            {c.label}
                          </LocalLink>
                        </li>
                      ))}
                    </ul>
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
                  [t('footer.brands'), '/marcas'],
                  ['¿Cuánto vale mi camper?', '/cuanto-vale-mi-camper'],
                  ['Blog', '/blog'],
                  ['Calcular el ITP', '/calcular-itp'],
                  ['Contrato de compraventa', '/contrato-compraventa'],
                  ['Gestoría cambio de nombre', '/gestoria-cambio-nombre'],
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
                <li><LocalLink href="/politica-de-cookies" className="hover:text-green-400 transition">{t('footer.cookies')}</LocalLink></li>
                {/* El aviso legal solo se enlaza cuando el titular está
                    configurado: antes de eso la página no está completa y no
                    debe presentarse como si lo estuviera. */}
                {hayDatosTitular() && (
                  <li><LocalLink href="/aviso-legal" className="hover:text-green-400 transition">{t('footer.legalNotice')}</LocalLink></li>
                )}
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
