import WorkHeader from '@/components/editorial/WorkHeader'
import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import CalculadoraITP from '../CalculadoraITP'
import { faqComunidad } from '../contenido'
import { faqComunidadEn, plazoITPEn } from '../contenido-en'
import { CHECKLIST_COMPRA_SEGURA_EN } from '../checklist-en'
import { vehicleScope } from '../mensajes-en'
import { CHECKLIST_COMPRA_SEGURA, REVISADO_EN, TIPOS_ITP, getComunidadITP } from '@/lib/itp'
import { getTranslations } from 'next-intl/server'
import { descripcionSeo, tituloSeo } from '@/lib/seo'

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

  const english = locale === 'en'
  const canonicalEs = `https://camperocasion.online/calcular-itp/${comunidad.slug}`
  const canonical = english ? `https://camperocasion.online/en/calcular-itp/${comunidad.slug}` : canonicalEs
  const titulo = english
    ? `Used campervan transfer tax (ITP) in ${comunidad.nombre} (${new Date().getFullYear()})`
    : `ITP camper en ${comunidad.nombre} (${new Date().getFullYear()})`
  const description = `Cuánto se paga de ITP al comprar una camper o autocaravana de ocasión en ${comunidad.nombre}: tipo` +
    ` general del ${comunidad.tipo} %${comunidad.tipoIncrementado ? `, ${comunidad.tipoIncrementado.tipo} % para ${comunidad.tipoIncrementado.aplica}` : ''}` +
    `${comunidad.cuotaFija ? `, cuota fija desde ${comunidad.cuotaFija.minAnios} años` : ''}` +
    `${comunidad.exencionPorAntiguedad ? `, exento desde ${comunidad.exencionPorAntiguedad.minAnios} años` : ''}` +
    `. Plazo: ${comunidad.plazoDias} ${comunidad.plazoDiasHabiles ? 'días hábiles' : 'días'}. Calculadora gratuita y checklist de compra segura.`

  const descriptionSeo = descripcionSeo(english
    ? `Estimate ITP on a used campervan in ${comunidad.nombre}: general rate ${comunidad.tipo}%, form ${comunidad.modelo}, and a filing period of ${plazoITPEn(comunidad)}. Verify the rules with the regional tax authority.`
    : description)

  return {
    title: tituloSeo(titulo),
    description: descriptionSeo,
    robots: { index: !english, follow: true },
    keywords: english ? ['campervan transfer tax Spain', `ITP ${comunidad.nombre}`, 'used camper tax calculator'] : [
      `impuesto comprar camper segunda mano ${comunidad.nombre.toLowerCase()}`,
      `ITP camper ${comunidad.nombre.toLowerCase()}`,
      `ITP autocaravana segunda mano ${comunidad.nombre.toLowerCase()}`,
      `ITP vehículo vivienda ${comunidad.nombre.toLowerCase()}`,
      `modelo ${comunidad.modelo} ${comunidad.nombre.toLowerCase()}`,
      `cuánto se paga de ITP por una furgoneta camper`,
    ],
    alternates: {
      canonical,
      languages: { 'es-ES': canonicalEs, 'x-default': canonicalEs },
    },
    openGraph: { title: titulo, description: descriptionSeo, type: 'website', locale: english ? 'en_US' : 'es_ES', url: canonical, images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: titulo }] },
    twitter: { card: 'summary_large_image', title: titulo, description: descriptionSeo, images: ['https://camperocasion.online/api/og/catalog?categoria=camper'] },
  }
}

export default async function ITPComunidadPage({ params }: Props) {
  const { ccaa, locale } = await params
  const english = locale === 'en'
  const comunidad = getComunidadITP(ccaa)
  if (!comunidad) notFound()

  const faq = english ? faqComunidadEn(comunidad.slug) : faqComunidad(comunidad.slug)
  const checklist = english ? CHECKLIST_COMPRA_SEGURA_EN : CHECKLIST_COMPRA_SEGURA
  const notesEn = [
    `General rate: ${comunidad.tipo}% on the higher of the agreed price and depreciated official value.`,
    ...(comunidad.tipoIncrementado ? [`Higher rate: ${comunidad.tipoIncrementado.tipo}% for ${vehicleScope(comunidad.tipoIncrementado.aplica)}.`] : []),
    ...(comunidad.cuotaFija ? [`An age-based flat fee may apply from ${comunidad.cuotaFija.minAnios} years for ${vehicleScope(comunidad.cuotaFija.aplicaA)}. Confirm whether your camper's registration classification qualifies.`] : []),
    ...(comunidad.exencionPorAntiguedad ? [`An age-based exemption may apply from ${comunidad.exencionPorAntiguedad.minAnios} years for ${vehicleScope(comunidad.exencionPorAntiguedad.aplicaA)}${comunidad.exencionPorAntiguedad.valorMaximo ? ` below €${comunidad.exencionPorAntiguedad.valorMaximo}` : ''}.`] : []),
    ...(comunidad.tipoCeroEmisiones != null ? [`Zero-emissions label: ${comunidad.tipoCeroEmisiones}%${comunidad.tipoEco != null ? `; ECO label: ${comunidad.tipoEco}%` : ''}.`] : []),
    `Form ${comunidad.modelo}; listed filing period: ${plazoITPEn(comunidad)} from the contract.`,
  ]
  const otras = TIPOS_ITP.filter(c => c.slug !== comunidad.slug)

  const SITIO = 'https://camperocasion.online'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: english ? 'Home' : 'Inicio', item: SITIO + (english ? '/en' : '/') },
      { '@type': 'ListItem', position: 2, name: english ? 'ITP calculator' : 'Calculadora de ITP', item: SITIO + (english ? '/en' : '') + '/calcular-itp' },
      { '@type': 'ListItem', position: 3, name: comunidad.nombre, item: SITIO + (english ? '/en' : '') + '/calcular-itp/' + comunidad.slug },
    ],
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd,
      {
        '@type': 'FAQPage',
        '@id': SITIO + (english ? '/en' : '') + '/calcular-itp/' + comunidad.slug + '#faq',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.pregunta,
          acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Breadcrumbs items={[
        { label: english ? 'ITP calculator' : 'Calculadora de ITP', href: '/calcular-itp' },
        { label: comunidad.nombre, href: `/calcular-itp/${comunidad.slug}` },
      ]} />

      <div className="public-shell max-w-6xl py-10 md:py-14">
        <WorkHeader
          title={english ? `Used campervan ITP in ${comunidad.nombre}` : `ITP de una camper de segunda mano en ${comunidad.nombre}`}
          description={english
            ? `If you live in ${comunidad.nombre} and buy a used camper from a private seller, estimate the transfer tax and review your region’s rules before filing.`
            : `Si compras una camper o autocaravana de ocasión a un particular y resides en ${comunidad.nombre}, aquí puedes estimar el impuesto que pagarás y consultar las especialidades de tu comunidad.`}
        />

        {/* Datos de la comunidad */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{english ? 'General rate' : 'Tipo general'}</p>
            <p className="text-2xl font-black text-brand-primary">{comunidad.tipo} %</p>
            {comunidad.tipoIncrementado && (
              <p className="text-xs text-gray-600 mt-1">
                {comunidad.tipoIncrementado.tipo} % {english ? `for ${vehicleScope(comunidad.tipoIncrementado.aplica)}` : `para ${comunidad.tipoIncrementado.aplica}`}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{english ? 'Older vehicles' : 'Vehículos antiguos'}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {comunidad.cuotaFija
                ? `${english ? 'Flat fee from' : 'Cuota fija desde'} ${comunidad.cuotaFija.minAnios} ${english ? 'years' : 'años'} (${comunidad.cuotaFija.tramos.filter(t => t.cuota > 0 || t.sinAutoliquidar).map(t => `${t.cuota} €`).join(' / ')})`
                : comunidad.exencionPorAntiguedad
                  ? `${english ? 'Exempt from' : 'Exento desde'} ${comunidad.exencionPorAntiguedad.minAnios} ${english ? 'years' : 'años'}`
                  : (english ? 'No age-based flat fee or exemption' : 'Sin cuota fija ni exención por antigüedad')}
            </p>
            {comunidad.tipoCeroEmisiones != null && (
              <p className="text-xs text-gray-600 mt-1">{english ? 'Zero emissions' : 'Cero emisiones'}: {comunidad.tipoCeroEmisiones} %</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{english ? 'Filing period' : 'Plazo'}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {english ? plazoITPEn(comunidad) : `${comunidad.plazoDias} ${comunidad.plazoDiasHabiles ? 'días hábiles' : 'días'}`} {english ? 'from the contract' : 'desde el contrato'}
            </p>
            <p className="text-xs text-gray-600 mt-1">{english ? 'Form' : 'Modelo'} {comunidad.modelo}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{english ? 'Official source' : 'Fuente oficial'}</p>
            <a
              href={comunidad.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              {english ? `${comunidad.nombre} tax authority` : `Sede de ${comunidad.nombre}`} <ExternalLink size={12} />
            </a>
            <p className="text-xs text-gray-500 mt-1">{english ? 'Last reviewed' : 'Revisado en'} {REVISADO_EN}</p>
          </div>
        </div>

        <Suspense fallback={<div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />}>
          <CalculadoraITP ccaaInicial={comunidad.slug} />
        </Suspense>

        <section className="mt-10 grid md:grid-cols-2 gap-6">
          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3">{english ? `What to know in ${comunidad.nombre}` : `Lo que hay que saber en ${comunidad.nombre}`}</h2>
            <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
              {(english ? notesEn : comunidad.notas).map(nota => <li key={nota}>{nota}</li>)}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              {english
                ? 'Regional tax rules can change. Check the amount and vehicle classification with the official authority before filing.'
                : 'Los tipos cambian por norma autonómica: verifica siempre el importe en la sede oficial antes de presentar la autoliquidación.'}
            </p>
            {english && <details className="mt-4 text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold">Original detailed notes (Spanish)</summary>
              <ul className="mt-2 list-disc pl-4 space-y-1">{comunidad.notas.map(nota => <li key={nota}>{nota}</li>)}</ul>
            </details>}
          </article>

          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3">{english ? 'Documents to check before signing' : 'Documentación a revisar antes de firmar'}</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {checklist.slice(0, 5).map(item => (
                <li key={item.titulo}>
                  <span className="font-semibold text-gray-800">{item.titulo}.</span> {item.detalle}
                </li>
              ))}
            </ul>
            <LocalLink href="/compra-segura-camper" className="mt-3 inline-block text-xs font-bold text-brand-primary hover:underline">
              {english ? 'View the full checklist →' : 'Ver el checklist completo →'}
            </LocalLink>
          </article>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">{english ? `Frequently asked questions in ${comunidad.nombre}` : `Preguntas frecuentes en ${comunidad.nombre}`}</h2>
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
          <h2 className="font-bold text-gray-900 mb-3">{english ? 'ITP in other communities' : 'ITP en otras comunidades'}</h2>
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
          <h2 className="font-bold text-gray-900 mb-2">{english ? `Looking for a camper in ${comunidad.nombre}?` : `¿Buscando camper en ${comunidad.nombre}?`}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {english
              ? 'Filter listings by province and vehicle details, and explore campers whose documentation has already been reviewed.'
              : 'En el catálogo puedes filtrar por provincia y por ficha técnica (plazas para dormir, baño, MMA, medidas) y quedarte solo con los anuncios que ya tienen la documentación del vehículo revisada.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <LocalLink href="/catalogo?verificada=1" className="bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition">
              {english ? 'Campers with verified homologation' : 'Campers con homologación verificada'}
            </LocalLink>
            <LocalLink href="/catalogo" className="bg-white border border-gray-300 text-gray-800 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition">
              {english ? 'View the full catalog' : 'Ver todo el catálogo'}
            </LocalLink>
          </div>
        </section>
      </div>
    </>
  )
}
