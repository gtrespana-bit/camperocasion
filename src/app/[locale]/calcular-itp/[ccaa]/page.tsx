import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import CalculadoraITP from '../CalculadoraITP'
import { faqComunidad } from '../contenido'
import { CHECKLIST_COMPRA_SEGURA, REVISADO_EN, TIPOS_ITP, getComunidadITP } from '@/lib/itp'
import { getTranslations } from 'next-intl/server'

type Props = {
  params: Promise<{ ccaa: string; locale: string }>
}

// Todas las comunidades del registro. Al ser la ruta dinámica (sin
// generateStaticParams, por el mismo motivo que las landings provinciales:
// el layout raíz usa cookies() y prerenderizar provoca DynamicServerError),
// solo se emiten las que existen en el registro.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ccaa, locale } = await params
  const comunidad = getComunidadITP(ccaa)

  if (!comunidad) {
    const t = await getTranslations({ locale, namespace: 'notFound' })
    return { title: t('title'), description: t('description') }
  }

  const canonical = `https://camperocasion.online/calcular-itp/${comunidad.slug}`
  const titulo = `ITP de una camper de segunda mano en ${comunidad.nombre} (${new Date().getFullYear()})`
  const description = `Cuánto se paga de ITP al comprar una camper o autocaravana de ocasión en ${comunidad.nombre}: tipo` +
    ` general del ${comunidad.tipo} %${comunidad.tipoIncrementado ? `, ${comunidad.tipoIncrementado.tipo} % para ${comunidad.tipoIncrementado.aplica}` : ''}` +
    `${comunidad.cuotaFija ? `, cuota fija desde ${comunidad.cuotaFija.minAnios} años` : ''}` +
    `${comunidad.exencionPorAntiguedad ? `, exento desde ${comunidad.exencionPorAntiguedad.minAnios} años` : ''}` +
    `. Plazo: ${comunidad.plazoDias} ${comunidad.plazoDiasHabiles ? 'días hábiles' : 'días'}. Calculadora gratuita y checklist de compra segura.`

  return {
    title: titulo,
    description,
    keywords: [
      `impuesto comprar camper segunda mano ${comunidad.nombre.toLowerCase()}`,
      `ITP camper ${comunidad.nombre.toLowerCase()}`,
      `ITP autocaravana segunda mano ${comunidad.nombre.toLowerCase()}`,
      `ITP vehículo vivienda ${comunidad.nombre.toLowerCase()}`,
      `modelo ${comunidad.modelo} ${comunidad.nombre.toLowerCase()}`,
      `cuánto se paga de ITP por una furgoneta camper`,
    ],
    alternates: {
      canonical,
      languages: { 'es-ES': canonical, 'x-default': canonical },
    },
    openGraph: { title: titulo, description, type: 'website', locale: 'es_ES', url: canonical },
  }
}

export default async function ITPComunidadPage({ params }: Props) {
  const { ccaa } = await params
  const comunidad = getComunidadITP(ccaa)
  if (!comunidad) notFound()

  const faq = faqComunidad(comunidad.slug)
  const otras = TIPOS_ITP.filter(c => c.slug !== comunidad.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[
        { label: 'Calculadora de ITP', href: '/calcular-itp' },
        { label: comunidad.nombre, href: `/calcular-itp/${comunidad.slug}` },
      ]} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          ITP de una camper de segunda mano en {comunidad.nombre}
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mb-6">
          Si compras una furgoneta camper o una autocaravana de ocasión a un particular y resides en{' '}
          {comunidad.nombre}, el impuesto lo pagas tú y se autoliquida aquí. Este es el tipo que aplica, las
          especialidades de la comunidad y la estimación para tu operación.
        </p>

        {/* Datos de la comunidad */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo general</p>
            <p className="text-2xl font-black text-brand-primary">{comunidad.tipo} %</p>
            {comunidad.tipoIncrementado && (
              <p className="text-xs text-gray-600 mt-1">
                {comunidad.tipoIncrementado.tipo} % para {comunidad.tipoIncrementado.aplica}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Vehículos antiguos</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {comunidad.cuotaFija
                ? `Cuota fija desde ${comunidad.cuotaFija.minAnios} años (${comunidad.cuotaFija.tramos.filter(t => t.cuota > 0 || t.sinAutoliquidar).map(t => `${t.cuota} €`).join(' / ')})`
                : comunidad.exencionPorAntiguedad
                  ? `Exento desde ${comunidad.exencionPorAntiguedad.minAnios} años`
                  : 'Sin cuota fija ni exención por antigüedad'}
            </p>
            {comunidad.tipoCeroEmisiones != null && (
              <p className="text-xs text-gray-600 mt-1">Cero emisiones: {comunidad.tipoCeroEmisiones} %</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Plazo</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {comunidad.plazoDias} {comunidad.plazoDiasHabiles ? 'días hábiles' : 'días'} desde el contrato
            </p>
            <p className="text-xs text-gray-600 mt-1">Modelo {comunidad.modelo}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Fuente oficial</p>
            <a
              href={comunidad.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              Sede de {comunidad.nombre} <ExternalLink size={12} />
            </a>
            <p className="text-xs text-gray-500 mt-1">Revisado en {REVISADO_EN}</p>
          </div>
        </div>

        <Suspense fallback={<div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />}>
          <CalculadoraITP ccaaInicial={comunidad.slug} />
        </Suspense>

        <section className="mt-10 grid md:grid-cols-2 gap-6">
          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3">Lo que hay que saber en {comunidad.nombre}</h2>
            <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
              {comunidad.notas.map(nota => <li key={nota}>{nota}</li>)}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Los tipos cambian por norma autonómica: verifica siempre el importe en la sede oficial antes de
              presentar la autoliquidación.
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3">Documentación a revisar antes de firmar</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {CHECKLIST_COMPRA_SEGURA.slice(0, 5).map(item => (
                <li key={item.titulo}>
                  <span className="font-semibold text-gray-800">{item.titulo}.</span> {item.detalle}
                </li>
              ))}
            </ul>
            <LocalLink href="/compra-segura-camper" className="mt-3 inline-block text-xs font-bold text-brand-primary hover:underline">
              Ver el checklist completo →
            </LocalLink>
          </article>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Preguntas frecuentes en {comunidad.nombre}</h2>
          <div className="space-y-3">
            {faq.map(f => (
              <details key={f.pregunta} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <summary className="font-bold text-gray-800 px-5 py-4 cursor-pointer list-none marker:content-['▶'] hover:text-brand-primary">
                  {f.pregunta}
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600">{f.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Enlazado interno entre landings (SEO + navegación útil) */}
        <section className="mt-10">
          <h2 className="font-bold text-gray-900 mb-3">ITP en otras comunidades</h2>
          <div className="flex flex-wrap gap-2">
            {otras.map(c => (
              <LocalLink
                key={c.slug}
                href={`/calcular-itp/${c.slug}`}
                className="text-sm bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-brand-accent hover:text-brand-primary transition"
              >
                {c.nombre} <span className="text-gray-400">{c.tipo} %</span>
              </LocalLink>
            ))}
          </div>
        </section>

        <section className="mt-10 bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h2 className="font-bold text-gray-900 mb-2">¿Buscando camper en {comunidad.nombre}?</h2>
          <p className="text-sm text-gray-600 mb-4">
            En el catálogo puedes filtrar por provincia y por ficha técnica (plazas para dormir, baño, MMA, medidas)
            y quedarte solo con los anuncios que ya tienen la documentación del vehículo revisada.
          </p>
          <div className="flex flex-wrap gap-3">
            <LocalLink href="/catalogo?verificada=1" className="bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition">
              Campers con homologación verificada
            </LocalLink>
            <LocalLink href="/catalogo" className="bg-white border border-gray-300 text-gray-800 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              Ver todo el catálogo
            </LocalLink>
          </div>
        </section>
      </div>
    </>
  )
}
