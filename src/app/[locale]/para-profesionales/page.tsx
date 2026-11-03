import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import {
  BadgeEuro,
  Camera,
  Check,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  Minus,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import { PLANES_PRO } from '@/lib/planes-anuncios'
import PlanesClient from './PlanesClient'
import { comparisonEn, extrasEn, faqsEn } from './contenido-en'

const metadataEs: Metadata = {
  title: 'Planes para profesionales y camperizadores',
  description:
    'Publica todo tu stock sin comisión por venta. 19 €/mes, o 190 €/año con 2 meses gratis. 15 anuncios, escaparate, estadísticas y destacados.',
  alternates: {
    canonical: 'https://camperocasion.online/para-profesionales',
    languages: { 'es-ES': 'https://camperocasion.online/para-profesionales', 'x-default': 'https://camperocasion.online/para-profesionales' },
  },
  openGraph: {
    title: 'Planes para profesionales y camperizadores',
    description: 'Un solo plan: 19 €/mes o 190 €/año. 15 anuncios, escaparate y estadísticas. Sin comisión por venta ni permanencia.',
    url: 'https://camperocasion.online/para-profesionales',
    siteName: 'CamperOcasión',
    type: 'website',
    locale: 'es_ES',
    images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: 'Planes para profesionales' }],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (locale !== 'en') return metadataEs
  const title = 'Professional camper seller plans'
  const description = 'List up to 15 campervans with 20 photos each, five featured spots a month and a branded shopfront. €19/month or €190/year, with no sales commission.'
  const canonicalEs = 'https://camperocasion.online/para-profesionales'
  const canonical = 'https://camperocasion.online/en/para-profesionales'
  return {
    title, description,
    robots: { index: false, follow: true },
    alternates: { canonical, languages: { 'es-ES': canonicalEs, 'x-default': canonicalEs } },
    openGraph: { title, description, url: canonical, locale: 'en_US', type: 'website', siteName: 'CamperOcasión',
      images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: title }] },
  }
}

const extras = [
  {
    icon: Store,
    title: 'Escaparate propio',
    desc: 'Una URL /tienda/tu-taller para tu web, Instagram, ferias y Google. Tus anuncios, tu marca.',
  },
  {
    icon: Camera,
    title: 'Más fotos, mejor anuncio',
    desc: `Hasta ${PLANES_PRO[0].fotos} fotos por vehículo. Una ficha completa responde antes las dudas del comprador.`,
  },
  {
    icon: Star,
    title: 'Destacados incluidos',
    desc: '3, 5 o 15 destacados al mes sin gastar créditos. Los que más rotación tienen, arriba.',
  },
  {
    icon: FileCheck2,
    title: 'Prioridad en homologación',
    desc: 'Tu expediente se revisa antes. El sello de homologación verificada tarda menos.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Importa todo tu stock de una vez',
    desc: 'Sube el CSV de tu Excel o del DMS y publica hasta 100 anuncios con vista previa, sin formulario a formulario.',
  },
  {
    icon: TrendingUp,
    title: 'Sabes qué anuncio funciona',
    desc: 'Visitas, favoritos y contactos por anuncio, serie diaria y comparativa con el mercado de tu categoría. 90 días de histórico.',
  },
  {
    icon: BadgeEuro,
    title: 'Tarifa plana, no comisión',
    desc: 'Vendas una o diez, pagas lo mismo. No te quedas con un % de la operación.',
  },
  {
    icon: CreditCard,
    title: 'Factura para tu gestoría',
    desc: 'Añade tu NIF/CIF al pagar y descarga la factura cuando la necesites. Sin pedirla por email.',
  },
]

const filasComparativa: {
  label: string
  gratis: string
  profesional: string
}[] = [
  { label: 'Anuncios activos a la vez', gratis: '1', profesional: '15' },
  { label: 'Fotos por anuncio', gratis: '10', profesional: '20' },
  { label: 'Destacados incluidos al mes', gratis: '—', profesional: '5' },
  { label: 'Escaparate /tienda/tu-taller', gratis: '—', profesional: 'Sí' },
  { label: 'Estadísticas del vendedor', gratis: 'Totales', profesional: 'Completas' },
  { label: 'Importar stock desde CSV', gratis: '—', profesional: 'Hasta 100 filas' },
  { label: 'Prioridad en homologación', gratis: 'Normal', profesional: 'Alta' },
  { label: 'Créditos extra', gratis: 'Se compran', profesional: 'Se compran' },
  { label: 'Comisión por venta', gratis: '0 %', profesional: '0 %' },
]

const faqs = [
  {
    q: '¿Contratar un pack me convierte en profesional?',
    a: 'Sí, y es gratis. Tu «tipo de vendedor» (particular, camperizador o profesional) define cómo apareces y qué puedes hacer. El pack solo define cuánto stock puedes tener publicado. Si contratas un pack siendo particular, pasas automáticamente a profesional para que no pagues un cupo que no puedes usar.',
  },
  {
    q: '¿Es una comisión por venta?',
    a: 'No. CamperOcasión cobra una cuota fija por publicar, no un porcentaje de la venta. Puedes vender una furgoneta o diez y la cuota es la misma.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. Desde tu panel, en «Mi plan» → «Gestionar suscripción», puedes cambiar la tarjeta, descargar facturas o darte de baja. No hay permanencia ni penalización: mantienes el pack hasta el final del periodo que ya has pagado.',
  },
  {
    q: '¿Qué pasa si me paso del cupo?',
    a: 'No se borra nada. Si termina el plan o baja tu cupo, los anuncios que excedan el límite pueden pausarse. Podrás reactivarlos al recuperar cupo, o pausar o marcar otros como vendidos.',
  },
  {
    q: '¿Los créditos caducan?',
    a: 'No. Los créditos se compran aparte y no tienen fecha de caducidad. Sirven para subir un anuncio al nº 1 (1 crédito) o destacarlo 12, 24 o 48 horas (4, 6 o 10 créditos). Si tienes un pack, ya incluyes destacados cada mes.',
  },
  {
    q: '¿Puedo pagar con Bizum?',
    a: 'La suscripción Profesional se cobra con tarjeta (incluye Apple Pay y Google Pay), porque Bizum no permite cobros recurrentes. Para comprar créditos sí puedes pagar con Bizum, tarjeta o los métodos manuales.',
  },
  {
    q: '¿Hay factura?',
    a: 'Sí. Al pagar puedes añadir tu NIF/CIF y el domicilio fiscal. Stripe envía la factura por email y la tienes disponible en el portal de cliente.',
  },
  {
    q: '¿Hay prueba gratis?',
    a: 'Cuando la promoción está activa, cada cuenta profesional nueva tiene 30 días con el plan Profesional (15 anuncios y 5 destacados) sin cobro. En tu panel ves los días que quedan en todo momento. No se cobra automáticamente al terminar: si no contratas, pasas al plan gratuito.',
  },
]

export default async function ParaProfesionalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const english = locale === 'en'
  const extrasLocalized = english ? extras.map((item, index) => ({ ...item, ...extrasEn[index] })) : extras
  const comparisonLocalized = english ? comparisonEn : filasComparativa
  const faqsLocalized = english ? faqsEn : faqs
  const copy = english ? {
    breadcrumb: 'For professionals', planTitle: 'Professional camper seller plans',
    planDesc: 'One plan: €19/month or €190/year. 15 listings, your own shopfront and analytics, with no sales commission or minimum term.',
    eyebrow: 'Workshops, converters and dealers', heroTitle: 'List your inventory. No sales commission.',
    heroDescription: 'One Professional plan at €19/month, billed monthly or annually, with no minimum term. 15 listings, your own shopfront, analytics and featured spots. If you are only selling your own camper, the free plan is enough.',
    chips: ['No sales commission', 'Cancel from your dashboard', 'Two months free with annual billing', 'Invoice with tax ID'],
    modelTitle: 'Three different things, not three account types',
    modelDesc: 'CamperOcasión distinguishes who you are, how many vehicles you can list and how much extra visibility you want.',
    sellerTitle: 'Seller type', sellerPrice: 'Always free', sellerDesc: 'Private seller, converter or professional. This sets your profile badge and catalog filters. Change it in your profile at no cost.',
    planPrice: '€19/month, all included', planDescShort: '15 active listings, 20 photos each, five featured spots per month, a shopfront and analytics. No sales commission or minimum term.',
    creditsTitle: 'Credits', creditsPrice: 'Pay as you go, no expiry', creditsDesc: 'Optional visibility: boost or feature a specific listing. Credits are purchased separately and do not expire.',
    pricingTitle: 'Free or Professional', pricingDesc: 'Prices are in euros. Annual billing costs the same as ten monthly payments: pay for ten months and use twelve.',
    comparisonTitle: 'Quick comparison', comparisonCaption: 'CamperOcasión plan comparison', included: 'What is included', free: 'Free', professional: 'Professional',
    yes: 'Yes', includedLabel: 'Included', notIncluded: 'Not included',
    comparisonNote: 'Your shopfront opens with the Professional plan. Existing active shops from before this change remain available.',
    benefitsTitle: 'What you get with Professional',
    trust1: 'No hidden terms', trust1Desc: 'No minimum term or sales commission. You can cancel from your dashboard and keep your plan through the paid period.',
    trust2: 'Secure Stripe checkout', trust2Desc: 'Pay by card or supported wallet. Add your tax ID for an invoice. We do not store card details.',
    trust3: 'Built for the camper market', trust3Desc: 'Reach camper buyers with relevant vehicle filters: maximum authorised mass, berths, range and homologation.',
    faqTitle: 'Frequently asked questions', ctaTitle: 'Start free. Go Professional when selling becomes regular.',
    ctaDesc: 'List your first camper without paying. If you run a workshop or dealership, Professional gives you more capacity, a shopfront and analytics without sales commission.',
    publish: 'List for free', create: 'Create an account',
  } : {
    breadcrumb: 'Para profesionales', planTitle: 'Planes para profesionales y camperizadores',
    planDesc: 'Un solo plan: 19 €/mes o 190 €/año. 15 anuncios, escaparate y estadísticas. Sin comisión por venta ni permanencia.',
    eyebrow: 'Talleres, camperizadores y compraventas', heroTitle: 'Publica todo tu stock. Sin comisión por venta.',
    heroDescription: 'Un solo plan: Profesional, 19 €/mes, mensual o anual y sin permanencia. 15 anuncios, escaparate, estadísticas y destacados. Si solo vendes tu camper, el plan gratuito es todo lo que necesitas.',
    chips: ['Sin comisión por venta', 'Cancela en 2 clics', '2 meses gratis en el anual', 'Factura con NIF/CIF'],
    modelTitle: 'Tres cosas distintas (y ninguna es «el tipo de cuenta»)',
    modelDesc: 'En CamperOcasión separamos quién eres, cuánto puedes publicar y cuánta visibilidad quieres comprar.',
    sellerTitle: 'Tipo de vendedor', sellerPrice: 'Gratis, siempre', sellerDesc: 'Particular, camperizador o profesional. Define tu sello y los filtros del catálogo. Se cambia en tu perfil y no cuesta nada.',
    planPrice: '19 €/mes, todo incluido', planDescShort: '15 anuncios activos, 20 fotos, 5 destacados al mes, escaparate y estadísticas. Sin comisión por venta y sin permanencia.',
    creditsTitle: 'Créditos', creditsPrice: 'Pago por uso, sin caducidad', creditsDesc: 'Visibilidad puntual: subir al nº 1 o destacar un anuncio concreto. Se compran aparte y no caducan.',
    pricingTitle: 'Gratis o Profesional', pricingDesc: 'Los precios son en euros. El plan anual equivale a 10 mensualidades: pagas 10 y usas 12.',
    comparisonTitle: 'Comparativa rápida', comparisonCaption: 'Comparación de planes de CamperOcasión', included: 'Qué incluye', free: 'Gratis', professional: 'Profesional',
    yes: 'Sí', includedLabel: 'Incluido', notIncluded: 'No incluido',
    comparisonNote: 'El escaparate se abre con el plan Profesional. Si ya tenías una tienda activa antes de este cambio, se mantiene.',
    benefitsTitle: 'Qué consigues con Profesional',
    trust1: 'Sin letra pequeña', trust1Desc: 'Sin permanencia, sin comisión por venta y sin renovación sorpresa: avisamos antes de cada cobro y puedes cancelar desde el panel.',
    trust2: 'Pago con Stripe', trust2Desc: 'Tarjeta, Apple Pay y Google Pay. Factura automática con tu NIF/CIF. No almacenamos datos de tarjeta.',
    trust3: 'Hecho para el sector camper', trust3Desc: 'Compradores que buscan camper, no coches. Filtros técnicos de verdad: MMA, plazas, autonomía, homologación.',
    faqTitle: 'Preguntas frecuentes', ctaTitle: 'Empieza gratis. Hazte Profesional cuando vendas de forma habitual.',
    ctaDesc: 'Publica tu primera camper sin pagar nada. Si eres taller o compraventa, 19 €/mes te dan capacidad, escaparate y estadísticas sin comisiones por venta.',
    publish: 'Publicar gratis', create: 'Crear cuenta',
  }

  const SITIO = 'https://camperocasion.online'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: english ? 'Home' : 'Inicio', item: SITIO + (english ? '/en' : '/') },
          { '@type': 'ListItem', position: 2, name: copy.breadcrumb, item: SITIO + (english ? '/en' : '') + '/para-profesionales' },
        ],
      },
      {
        '@type': 'Product',
        '@id': SITIO + (english ? '/en' : '') + '/para-profesionales#plans',
        name: copy.planTitle,
        description: copy.planDesc,
        brand: { '@type': 'Brand', name: 'CamperOcasión' },
        offers: PLANES_PRO.map(p => ({
          '@type': 'Offer',
          name: english ? 'Professional' : p.nombre,
          price: String(p.precioMes),
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          url: SITIO + (english ? '/en' : '') + '/para-profesionales',
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqsLocalized.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <div className="public-hero">
        <div className="public-shell relative z-10">
          <p className="public-eyebrow">
            {copy.eyebrow}
          </p>
          <h1 className="public-hero-title t-mega">
            {copy.heroTitle}
          </h1>
          <p className="public-hero-description">
            {copy.heroDescription}
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-white">
            {copy.chips.map(chip => (
              <span key={chip} className="inline-flex items-center gap-1.5 border border-white/30 bg-white/10 px-3 py-1.5">
                <Check size={13} className="text-leaf-300" aria-hidden="true" /> {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="public-shell py-12 lg:py-20">
        {/* Modelo mental: tres cosas distintas que no hay que confundir */}
        <section aria-labelledby="modelo" className="mb-10">
          <h2 id="modelo" className="text-xl font-black text-slate-900 mb-1">
            {copy.modelTitle}
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            {copy.modelDesc}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Users size={18} className="text-brand-accent" aria-hidden="true" /> {copy.sellerTitle}
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">{copy.sellerPrice}</p>
              <p className="text-sm text-slate-600 mt-2">
                {copy.sellerDesc}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-accent bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Sparkles size={18} className="text-brand-accent" aria-hidden="true" /> Plan
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">{copy.planPrice}</p>
              <p className="text-sm text-slate-600 mt-2">
                {copy.planDescShort}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <CreditCard size={18} className="text-brand-accent" aria-hidden="true" /> {copy.creditsTitle}
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">{copy.creditsPrice}</p>
              <p className="text-sm text-slate-600 mt-2">
                {copy.creditsDesc}
              </p>
            </div>
          </div>
        </section>

        <h2 className="text-2xl font-black text-slate-900 mb-1">{copy.pricingTitle}</h2>
        <p className="text-sm text-slate-600 mb-5">
          {copy.pricingDesc}
        </p>

        <PlanesClient />

        {/* Comparativa */}
        <section aria-labelledby="comparativa" className="mt-14">
          <h2 id="comparativa" className="text-2xl font-black text-slate-900 mb-4">
            {copy.comparisonTitle}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{copy.comparisonCaption}</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="px-4 py-3 font-bold text-slate-900">{copy.included}</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold text-slate-700">{copy.free}</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold text-brand-accent">{copy.professional}<br /><span className="text-xs font-normal">19 €/mes</span></th>
                </tr>
              </thead>
              <tbody>
                {comparisonLocalized.map((fila, i) => (
                  <tr key={fila.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-slate-700">{fila.label}</th>
                    {[fila.gratis, fila.profesional].map((valor, j) => (
                      <td key={j} className={`px-4 py-3 text-center ${j === 1 ? 'bg-emerald-50/60 font-semibold text-emerald-900' : 'text-slate-700'}`}>
                        {valor === copy.yes ? (
                          <Check size={16} className="mx-auto text-emerald-600" aria-label={copy.includedLabel} />
                        ) : valor === '—' ? (
                          <Minus size={16} className="mx-auto text-slate-300" aria-label={copy.notIncluded} />
                        ) : (
                          valor
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {copy.comparisonNote}
          </p>
        </section>

        {/* Qué resuelve */}
        <section className="mt-14">
          <h2 className="text-2xl font-black text-slate-900 mb-4">{copy.benefitsTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extrasLocalized.map(e => (
              <div key={e.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                <e.icon size={22} className="text-brand-accent mb-2" aria-hidden="true" />
                <h3 className="font-bold text-slate-900">{e.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Confianza */}
        <section className="mt-14 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <ShieldCheck size={22} className="text-brand-accent-light mb-2" aria-hidden="true" />
            <h3 className="font-bold">{copy.trust1}</h3>
            <p className="text-sm text-slate-300 mt-1">
              {copy.trust1Desc}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CreditCard size={22} className="text-brand-accent mb-2" aria-hidden="true" />
            <h3 className="font-bold text-slate-900">{copy.trust2}</h3>
            <p className="text-sm text-slate-600 mt-1">
              {copy.trust2Desc}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Users size={22} className="text-brand-accent mb-2" aria-hidden="true" />
            <h3 className="font-bold text-slate-900">{copy.trust3}</h3>
            <p className="text-sm text-slate-600 mt-1">
              {copy.trust3Desc}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mt-14">
          <h2 id="faq" className="text-2xl font-black text-slate-900 mb-4">
            {copy.faqTitle}
          </h2>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqsLocalized.map(f => (
              <details key={f.q} className="group p-4 sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900">
                  {f.q}
                  <span className="text-slate-400 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl bg-brand-primary p-6 sm:p-8 text-white">
          <h2 className="text-2xl font-black">{copy.ctaTitle}</h2>
          <p className="text-slate-300 mt-2 max-w-2xl">
            {copy.ctaDesc}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LocalLink href="/publicar" className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white hover:bg-brand-accent-dark">
              {copy.publish}
            </LocalLink>
            <LocalLink href="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              {copy.create}
            </LocalLink>
          </div>
        </section>
      </div>
    </>
  )
}
