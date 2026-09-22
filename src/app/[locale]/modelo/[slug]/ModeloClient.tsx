'use client'

import { useMemo, useState } from 'react'
import LocalLink from '@/components/LocalLink'
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
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return anuncios
    return anuncios.filter(a => (a.titulo || '').toLowerCase().includes(q))
  }, [anuncios, busqueda])

  const fmt = (n: number) => formatPrecio(n)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Cabecera */}
      <nav className="text-sm text-gray-500 mb-4">
        <LocalLink href="/marcas" className="hover:underline">Marcas</LocalLink>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{modelo.fabricante}</span>
        <span className="mx-1.5">/</span>
        <span className="text-gray-900 font-medium">{etiqueta}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
        {modelo.valor} de ocasión:{' '}
        <span className="text-brand-accent">precios reales {ANIO}</span>
      </h1>

      <p className="text-lg text-gray-600 max-w-3xl mb-8">
        {est ? (
          <>
            Una <strong>{modelo.valor}</strong> de segunda mano cuesta{' '}
            <strong>{fmt(est.mediana)}</strong> de mediana en España. Lo calculamos con los{' '}
            <strong>{est.muestra} anuncios</strong> publicados ahora mismo en CamperOcasión,
            no con estimaciones.
          </>
        ) : (
          <>
            Todavía no hay anuncios suficientes de <strong>{modelo.valor}</strong> para publicar
            precios de mercado fiables. En cuanto haya, aparecerán aquí calculados con
            anuncios reales.
          </>
        )}
      </p>

      {/* Estadísticas */}
      {est ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Tarjeta
              destacada
              valor={fmt(est.mediana)}
              etiqueta="Precio mediano"
              nota="La mitad cuesta menos, la mitad más"
            />
            <Tarjeta
              valor={`${fmt(est.p25)} – ${fmt(est.p75)}`}
              etiqueta="Rango habitual"
              nota="Lo que se paga normalmente"
            />
            {est.kmMediana != null && (
              <Tarjeta
                valor={`${est.kmMediana.toLocaleString('es-ES')} km`}
                etiqueta="Kilometraje mediano"
                icono={<Gauge size={15} />}
              />
            )}
            {est.anioMediano != null && (
              <Tarjeta
                valor={String(est.anioMediano)}
                etiqueta="Año mediano"
                icono={<Calendar size={15} />}
              />
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex gap-2.5 mb-10">
            <Info size={17} className="shrink-0 mt-0.5" />
            <p>
              Usamos la <strong>mediana</strong> y no la media porque un solo anuncio muy caro
              distorsionaría el resultado. El <strong>rango habitual</strong> deja fuera el 25 %
              más barato y el 25 % más caro: es lo que de verdad te vas a encontrar.
              Datos actualizados cada hora con los anuncios activos.
            </p>
          </div>

          {/* Precio por antigüedad */}
          {tramos.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <TrendingUp size={22} className="text-brand-accent" />
                Cuánto cuesta según los años
              </h2>
              <p className="text-gray-500 mb-4">
                Precio de una {modelo.valor} según su antigüedad. Solo se muestran los tramos
                con anuncios suficientes.
              </p>

              <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-semibold">Antigüedad</th>
                      <th className="px-4 py-3 font-semibold">Precio mediano</th>
                      <th className="px-4 py-3 font-semibold">Rango habitual</th>
                      <th className="px-4 py-3 font-semibold">Km mediano</th>
                      <th className="px-4 py-3 font-semibold text-right">Anuncios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tramos.map(t => (
                      <tr key={t.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.etiqueta}</td>
                        <td className="px-4 py-3 font-bold text-brand-primary">{fmt(t.mediana)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmt(t.p25)} – {fmt(t.p75)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.kmMediana != null ? `${t.kmMediana.toLocaleString('es-ES')} km` : '—'}
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
              <h3 className="font-bold text-lg">¿Cuánto pagarás de impuestos?</h3>
              <p className="opacity-90 text-sm">
                Al comprar de particular pagas el ITP, y cambia mucho según tu comunidad.
                Calcúlalo con el precio mediano de esta {modelo.valor}.
              </p>
            </div>
            <LocalLink
              href={`/calcular-itp?precio=${est.mediana}`}
              className="bg-white text-brand-primary px-5 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition whitespace-nowrap text-center"
            >
              Calcular ITP
            </LocalLink>
          </div>
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10 flex gap-3">
          <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Sin datos de precio todavía</p>
            <p>
              Preferimos no enseñar un precio antes que enseñar uno que no se sostenga.
              Necesitamos al menos 5 anuncios activos de este modelo para calcular
              estadísticas fiables.
            </p>
          </div>
        </div>
      )}

      {/* Anuncios */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-2xl font-bold text-gray-900">
            {anuncios.length > 0
              ? `${anuncios.length} ${anuncios.length === 1 ? 'anuncio' : 'anuncios'} de ${modelo.valor}`
              : `Anuncios de ${modelo.valor}`}
          </h2>
          {anuncios.length > 4 && (
            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Filtrar por título…"
                aria-label={`Filtrar anuncios de ${modelo.valor}`}
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
                ? `Ahora mismo no hay ninguna ${modelo.valor} publicada.`
                : 'Ningún anuncio coincide con tu filtro.'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {anuncios.length === 0
                ? 'Guarda esta búsqueda y te avisamos en cuanto alguien publique una.'
                : ''}
            </p>
            <LocalLink
              href="/catalogo"
              className="inline-block bg-brand-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-brand-dark transition"
            >
              Ver todo el catálogo
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
            Sobre la {modelo.valor}
          </h2>
          <p className="text-gray-700">{modelo.nota}</p>
        </section>
      )}

      {/* Enlazado interno */}
      {hermanos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Otros modelos de {modelo.fabricante}
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
          ¿Vendes una {modelo.valor}?
        </h2>
        <p className="text-gray-600 mb-4">
          {est
            ? `Ahora ya sabes lo que vale: la mediana está en ${fmt(est.mediana)}. Publica gratis y llega a compradores que buscan justo este modelo.`
            : 'Publica gratis y llega a compradores que buscan justo este modelo.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <LocalLink
            href="/cuanto-vale-mi-camper"
            className="inline-block bg-brand-accent text-white px-6 py-3 rounded-xl font-bold hover:brightness-95 transition"
          >
            Calcular cuánto vale la mía
          </LocalLink>
          <LocalLink
            href="/publicar"
            className="inline-block border border-gray-200 bg-white text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            Publicar mi anuncio gratis
          </LocalLink>
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
