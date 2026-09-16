import type { Metadata } from 'next'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import CalculadoraITP from './CalculadoraITP'
import { CALCULADORA_FAQ, SECCIONES_CALCULADORA } from './contenido'
import { TIPOS_ITP, REVISADO_EN } from '@/lib/itp'

const CANONICAL = 'https://camperocasion.online/calcular-itp'

export const metadata: Metadata = {
  title: 'Calculadora de ITP para comprar una camper de segunda mano',
  description:
    'Calcula el ITP de tu camper o autocaravana de ocasión: tipo por comunidad autónoma, cuota fija para vehículos antiguos, depreciación por antigüedad y coste total del cambio de nombre. Actualizado a 2026.',
  keywords: [
    'calculadora ITP camper',
    'impuesto comprar autocaravana segunda mano',
    'ITP vehículo vivienda',
    'modelo 620 camper',
    'cuánto se paga de ITP por una furgoneta camper',
    'ITP por comunidad autónoma',
  ],
  alternates: {
    canonical: CANONICAL,
    languages: { 'es-ES': CANONICAL, 'x-default': CANONICAL },
  },
  openGraph: {
    title: 'Calculadora de ITP para comprar una camper de segunda mano',
    description:
      'Del 3 % de Galicia al 6 % de Cantabria, Castilla-La Mancha, Comunitat Valenciana y Extremadura: calcula lo que pagarás de ITP por tu camper y qué documentación revisar antes de firmar.',
    type: 'website',
    locale: 'es_ES',
    url: CANONICAL,
  },
}

type PageProps = {
  searchParams: Promise<{ precio?: string; ccaa?: string }>
}

export default async function CalcularITPPage({ searchParams }: PageProps) {
  const { precio, ccaa } = await searchParams
  // Un anuncio concreto puede enlazar aquí con su precio (y su provincia) ya
  // puestos, para que la calculadora sea útil en un clic.
  const precioInicial = Number(String(precio || '').replace(/[^\d.]/g, '')) || undefined
  const ccaaInicial = ccaa && TIPOS_ITP.some(c => c.slug === ccaa) ? ccaa : undefined

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CALCULADORA_FAQ.map(f => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: 'Calculadora de ITP', href: '/calcular-itp' }]} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          Calculadora de ITP para comprar una camper de segunda mano
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mb-8">
          El <strong>Impuesto sobre Transmisiones Patrimoniales</strong> lo paga el comprador cuando la camper se
          compra a un particular, y es un impuesto autonómico: cambia el tipo, la cuota y hasta la forma de
          calcularlo según dónde vivas. Aquí tienes la estimación, el desglose y lo que conviene mirar antes de
          firmar.
        </p>

        <Suspense fallback={<div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />}>
          <CalculadoraITP ccaaInicial={ccaaInicial} precioInicial={precioInicial} />
        </Suspense>

        {/* ── Contenido de apoyo (SEO + utilidad real) ─────────────── */}
        <section className="mt-12 grid md:grid-cols-3 gap-6">
          {SECCIONES_CALCULADORA.map(seccion => (
            <article key={seccion.titulo} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-2">{seccion.titulo}</h2>
              {seccion.parrafos.map(p => <p key={p} className="text-sm text-gray-600 mb-2">{p}</p>)}
              {seccion.puntos && (
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  {seccion.puntos.map(punto => <li key={punto}>{punto}</li>)}
                </ul>
              )}
            </article>
          ))}
        </section>

        {/* ── Tipos por comunidad: enlaces a las landings ──────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-gray-900 mb-2">ITP por comunidad autónoma</h2>
          <p className="text-gray-600 mb-5">
            Tipos revisados en {REVISADO_EN} y enlaces a la sede tributaria de cada comunidad para verificarlos.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TIPOS_ITP.map(c => (
              <LocalLink
                key={c.slug}
                href={`/calcular-itp/${c.slug}`}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-brand-accent hover:shadow-md transition"
              >
                <p className="font-bold text-gray-900 group-hover:text-brand-primary">{c.nombre}</p>
                <p className="text-sm text-gray-600">
                  {c.tipo} % general
                  {c.tipoIncrementado && ` · ${c.tipoIncrementado.tipo} % ${c.tipoIncrementado.masDeCVFiscales ? 'para más de 15 CV fiscales' : 'para más de 2.000 cc'}`}
                  {c.cuotaFija && ` · cuota fija desde ${c.cuotaFija.minAnios} años`}
                  {c.exencionPorAntiguedad && ` · exento desde ${c.exencionPorAntiguedad.minAnios} años`}
                </p>
                <p className="text-xs text-gray-500 mt-1.5">
                  Plazo: {c.plazoDias} {c.plazoDiasHabiles ? 'días hábiles' : 'días'} · Modelo {c.modelo}
                </p>
              </LocalLink>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-gray-900 mb-5">Preguntas frecuentes sobre el ITP de una camper</h2>
          <div className="space-y-3">
            {CALCULADORA_FAQ.map(faq => (
              <details key={faq.pregunta} className="bg-white rounded-xl border border-gray-100 shadow-sm group">
                <summary className="font-bold text-gray-800 px-5 py-4 cursor-pointer list-none marker:content-['▶'] hover:text-brand-primary">
                  {faq.pregunta}
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600">{faq.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 bg-brand-primary text-white rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-black mb-2">Antes de pagar, comprueba que la camper es lo que dice ser</h2>
          <p className="text-white/80 text-sm mb-4 max-w-2xl">
            El ITP es solo una parte del coste: la otra es comprar un vehículo que en la ficha técnica ponga lo que
            el anuncio promete. Revisa el checklist de compra segura y busca anuncios con la documentación del
            vehículo ya revisada por nuestro equipo.
          </p>
          <div className="flex flex-wrap gap-3">
            <LocalLink href="/compra-segura-camper" className="bg-white text-brand-primary text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              Checklist de compra segura
            </LocalLink>
            <LocalLink href="/catalogo?verificada=1" className="bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition">
              Campers con homologación verificada
            </LocalLink>
          </div>
        </section>
      </div>
    </>
  )
}
