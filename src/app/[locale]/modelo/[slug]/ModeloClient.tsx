'use client'

import { useMemo, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import PublicHero from '@/components/editorial/PublicHero'
import { useLocale, useTranslations } from 'next-intl'
import ProductCard, { type ProductCardData } from '@/components/ProductCard'
import { formatPrecio, getPrecioEur } from '@/lib/precio'
import type { Estadisticas, EstadisticasTramo } from '@/lib/precios-mercado'
import type { MarcaModelo } from '@/lib/marcas'
import { TrendingUp, Info, Gauge, Calendar, Search, Car, Calculator } from 'lucide-react'

const ANIO = new Date().getFullYear()

export default function ModeloClient({
  modelo,
  etiqueta,
  anuncios,
  est,
  tramos,
  hermanos,
}: {
  modelo: MarcaModelo
  etiqueta: string
  anuncios: any[]
  est: Estadisticas | null
  tramos: EstadisticasTramo[]
  hermanos: { valor: string; etiqueta: string; slug: string }[]
}) {
  const i18n = useTranslations('modelPage')
  const locale = useLocale()
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return anuncios
    return anuncios.filter(a => (a.titulo || '').toLowerCase().includes(q))
  }, [anuncios, busqueda])

  const fmt = (n: number) => formatPrecio(n)

  return (
    <div className="public-page min-h-screen">
      <PublicHero compact eyebrow={`CamperOcasión · ${modelo.fabricante}`} title={i18n('heroTitle', { model: modelo.valor, year: ANIO })} description={est
        ? i18n('heroWithData', { model: modelo.valor, median: fmt(est.mediana), count: est.muestra })
        : i18n('heroNoData', { model: modelo.valor })} />
      <div className="public-shell py-12 lg:py-20">
        <nav className="mb-10 text-sm text-slate-600">
          <LocalLink href="/marcas" className="hover:text-leaf-600">{i18n('brands')}</LocalLink>
          <span className="mx-2">/</span>{modelo.fabricante}<span className="mx-2">/</span>{etiqueta}
        </nav>

      {/* Estadísticas */}
      {est ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Tarjeta
              destacada
              valor={fmt(est.mediana)}
              etiqueta={i18n('medianPrice')}
              nota={i18n('medianHint')}
            />
            <Tarjeta
              valor={`${fmt(est.p25)} – ${fmt(est.p75)}`}
              etiqueta={i18n('typicalRange')}
              nota={i18n('rangeHint')}
            />
            {est.kmMediana != null && (
              <Tarjeta
                valor={`${est.kmMediana.toLocaleString(locale === 'en' ? 'en-GB' : 'es-ES')} km`}
                etiqueta={i18n('medianMileage')}
                icono={<Gauge size={15} />}
              />
            )}
            {est.anioMediano != null && (
              <Tarjeta
                valor={String(est.anioMediano)}
                etiqueta={i18n('medianYear')}
                icono={<Calendar size={15} />}
              />
            )}
          </div>

          <div className="work-card p-4 text-sm text-night flex gap-2.5 mb-10">
            <Info size={17} className="shrink-0 mt-0.5 text-leaf" aria-hidden="true" />
            <p>{i18n('methodology')}</p>
          </div>

          {/* Precio por antigüedad */}
          {tramos.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <TrendingUp size={22} className="text-brand-accent" />
                {i18n('byAgeTitle')}
              </h2>
              <p className="text-gray-500 mb-4">
                {i18n('byAgeDesc', { model: modelo.valor })}
              </p>

              <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-semibold">{i18n('age')}</th>
                      <th className="px-4 py-3 font-semibold">{i18n('medianPrice')}</th>
                      <th className="px-4 py-3 font-semibold">{i18n('typicalRange')}</th>
                      <th className="px-4 py-3 font-semibold">{i18n('medianMileageShort')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{i18n('listings')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tramos.map(t => (
                      <tr key={t.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{locale === 'en' ? t.etiqueta.replace('años', 'years').replace('año', 'year') : t.etiqueta}</td>
                        <td className="px-4 py-3 font-bold text-brand-primary">{fmt(t.mediana)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmt(t.p25)} – {fmt(t.p75)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.kmMediana != null ? `${t.kmMediana.toLocaleString(locale === 'en' ? 'en-GB' : 'es-ES')} km` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{t.muestra}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Utilidad: ITP */}
          <div className="bg-gradient-to-br from-brand-primary to-brand-dark text-white rounded-2xl p-6 mb-12 flex flex-col sm:flex-row sm:items-center gap-4">
            <Calculator size={32} className="shrink-0 opacity-90" />
            <div className="flex-1">
              <h3 className="font-bold text-lg">{i18n('taxTitle')}</h3>
              <p className="opacity-90 text-sm">
                {i18n('taxDesc', { model: modelo.valor })}
              </p>
            </div>
            <LocalLink
              href={`/calcular-itp?precio=${est.mediana}`}
              className="bg-white text-brand-primary px-5 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition whitespace-nowrap text-center"
            >
              {i18n('taxButton')}
            </LocalLink>
          </div>
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10 flex gap-3">
          <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">{i18n('noDataTitle')}</p>
            <p>
              {i18n('noDataDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Anuncios */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-2xl font-bold text-gray-900">
            {anuncios.length > 0
              ? i18n('listingTitleCount', { model: modelo.valor, count: anuncios.length })
              : i18n('listingTitle', { model: modelo.valor })}
          </h2>
          {anuncios.length > 4 && (
            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder={i18n('filterPlaceholder')}
                aria-label={i18n('filterLabel', { model: modelo.valor })}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
            </div>
          )}
        </div>

        {filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Car size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium mb-1">
              {anuncios.length === 0
                ? i18n('emptyModel', { model: modelo.valor })
                : i18n('emptyFilter')}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {anuncios.length === 0
                ? i18n('emptyHint')
                : ''}
            </p>
            <LocalLink
              href="/catalogo"
              className="inline-block bg-brand-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-brand-dark transition"
            >
              {i18n('viewCatalog')}
            </LocalLink>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {filtrados.map((p: ProductCardData) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Contexto del modelo */}
      {modelo.nota && (
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {i18n('aboutTitle', { model: modelo.valor })}
          </h2>
          <p className="text-gray-700">{locale === 'en' ? i18n('aboutDesc', { model: modelo.valor, brand: modelo.fabricante }) : modelo.nota}</p>
        </section>
      )}

      {/* Enlazado interno */}
      {hermanos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {i18n('otherModels', { brand: modelo.fabricante })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {hermanos.map(h => (
              <LocalLink
                key={h.slug}
                href={`/modelo/${h.slug}`}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand-accent hover:text-brand-primary transition"
              >
                {h.etiqueta}
              </LocalLink>
            ))}
          </div>
        </section>
      )}

      {/* CTA vendedor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {i18n('sellTitle', { model: modelo.valor })}
        </h2>
        <p className="text-gray-600 mb-4">
          {est
            ? i18n('sellWithData', { median: fmt(est.mediana) })
            : i18n('sellNoData')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <LocalLink
            href="/cuanto-vale-mi-camper"
            className="inline-block bg-brand-accent text-white px-6 py-3 rounded-xl font-bold hover:brightness-95 transition"
          >
            {i18n('valueMine')}
          </LocalLink>
          <LocalLink
            href="/publicar"
            className="inline-block border border-gray-200 bg-white text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            {i18n('postMine')}
          </LocalLink>
        </div>
      </div>
      </div>
    </div>
  )
}

function Tarjeta({
  valor,
  etiqueta,
  nota,
  icono,
  destacada,
}: {
  valor: string
  etiqueta: string
  nota?: string
  icono?: React.ReactNode
  destacada?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        destacada ? 'bg-brand-primary text-white border-transparent' : 'bg-white border-gray-100'
      }`}
    >
      <p className={`text-xl md:text-2xl font-black ${destacada ? '' : 'text-gray-900'}`}>{valor}</p>
      <p
        className={`text-xs font-medium mt-0.5 inline-flex items-center gap-1 ${
          destacada ? 'text-white/80' : 'text-gray-600'
        }`}
      >
        {icono}
        {etiqueta}
      </p>
      {nota && (
        <p className={`text-[11px] mt-1 ${destacada ? 'text-white/70' : 'text-gray-400'}`}>{nota}</p>
      )}
    </div>
  )
}
