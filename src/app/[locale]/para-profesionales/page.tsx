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

export const metadata: Metadata = {
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

const extras = [
  {
    icon: Store,
    title: 'Escaparate propio',
    desc: 'Una URL /tienda/tu-taller para tu web, Instagram, ferias y Google. Tus anuncios, tu marca.',
  },
  {
    icon: Camera,
    title: 'Más fotos, mejor anuncio',
    desc: 'Hasta 30 fotos por vehículo. Una ficha completa responde antes las dudas del comprador.',
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
    a: 'No se borra nada. Los anuncios ya publicados siguen visibles; lo que no podrás hacer es publicar nuevos hasta pasar a Profesional, pausar o marcar alguno como vendido.',
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

  const SITIO = 'https://camperocasion.online'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
          { '@type': 'ListItem', position: 2, name: 'Para profesionales', item: SITIO + '/para-profesionales' },
        ],
      },
      {
        '@type': 'Product',
        '@id': SITIO + '/para-profesionales#plans',
        name: 'Planes para profesionales y camperizadores',
        description: 'Un solo plan: 19 €/mes o 190 €/año. 15 anuncios, escaparate y estadísticas. Sin comisión por venta ni permanencia.',
        brand: { '@type': 'Brand', name: 'CamperOcasión' },
        offers: PLANES_PRO.map(p => ({
          '@type': 'Offer',
          name: p.nombre,
          price: String(p.precioMes),
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          url: SITIO + '/para-profesionales',
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
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

      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-10">
          <p className="text-sm font-semibold text-brand-accent uppercase tracking-wide mb-2">
            Talleres, camperizadores y compraventas
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4 max-w-3xl">
            Publica todo tu stock. Sin comisión por venta.
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            Un solo plan: Profesional, 19 €/mes, mensual o anual y sin permanencia. 15 anuncios,
            escaparate, estadísticas y destacados. Si solo vendes tu camper, el plan gratuito es
            todo lo que necesitas.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            {[
              'Sin comisión por venta',
              'Cancela en 2 clics',
              '2 meses gratis en el anual',
              'Factura con NIF/CIF',
            ].map(chip => (
              <span key={chip} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <Check size={13} className="text-emerald-600" aria-hidden="true" /> {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Modelo mental: tres cosas distintas que no hay que confundir */}
        <section aria-labelledby="modelo" className="mb-10">
          <h2 id="modelo" className="text-xl font-black text-slate-900 mb-1">
            Tres cosas distintas (y ninguna es «el tipo de cuenta»)
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            En CamperOcasión separamos quién eres, cuánto puedes publicar y cuánta visibilidad quieres comprar.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Users size={18} className="text-brand-accent" aria-hidden="true" /> Tipo de vendedor
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">Gratis, siempre</p>
              <p className="text-sm text-slate-600 mt-2">
                Particular, camperizador o profesional. Define tu sello y los filtros del catálogo.
                Se cambia en tu perfil y no cuesta nada.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-accent bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Sparkles size={18} className="text-brand-accent" aria-hidden="true" /> Plan
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">19 €/mes, todo incluido</p>
              <p className="text-sm text-slate-600 mt-2">
                15 anuncios activos, 20 fotos, 5 destacados al mes, escaparate y estadísticas.
                Sin comisión por venta y sin permanencia.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <CreditCard size={18} className="text-brand-accent" aria-hidden="true" /> Créditos
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-1">Pago por uso, sin caducidad</p>
              <p className="text-sm text-slate-600 mt-2">
                Visibilidad puntual: subir al nº 1 o destacar un anuncio concreto.
                Se compran aparte y no caducan.
              </p>
            </div>
          </div>
        </section>

        <h2 className="text-2xl font-black text-slate-900 mb-1">Gratis o Profesional</h2>
        <p className="text-sm text-slate-600 mb-5">
          Los precios son en euros. El plan anual equivale a 10 mensualidades: pagas 10 y usas 12.
        </p>

        <PlanesClient />

        {/* Comparativa */}
        <section aria-labelledby="comparativa" className="mt-14">
          <h2 id="comparativa" className="text-2xl font-black text-slate-900 mb-4">
            Comparativa rápida
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Comparación de planes de CamperOcasión</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="px-4 py-3 font-bold text-slate-900">Qué incluye</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold text-slate-700">Gratis</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold text-brand-accent">Profesional<br /><span className="text-xs font-normal">19 €/mes</span></th>
                </tr>
              </thead>
              <tbody>
                {filasComparativa.map((fila, i) => (
                  <tr key={fila.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-slate-700">{fila.label}</th>
                    {[fila.gratis, fila.profesional].map((valor, j) => (
                      <td key={j} className={`px-4 py-3 text-center ${j === 1 ? 'bg-emerald-50/60 font-semibold text-emerald-900' : 'text-slate-700'}`}>
                        {valor === 'Sí' ? (
                          <Check size={16} className="mx-auto text-emerald-600" aria-label="Incluido" />
                        ) : valor === '—' ? (
                          <Minus size={16} className="mx-auto text-slate-300" aria-label="No incluido" />
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
            El escaparate se abre con el plan Profesional. Si ya tenías una tienda activa antes de este cambio, se mantiene.
          </p>
        </section>

        {/* Qué resuelve */}
        <section className="mt-14">
          <h2 className="text-2xl font-black text-slate-900 mb-4">Qué consigues con Profesional</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map(e => (
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
            <h3 className="font-bold">Sin letra pequeña</h3>
            <p className="text-sm text-slate-300 mt-1">
              Sin permanencia, sin comisión por venta y sin renovación sorpresa: avisamos antes de cada cobro y puedes cancelar desde el panel.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CreditCard size={22} className="text-brand-accent mb-2" aria-hidden="true" />
            <h3 className="font-bold text-slate-900">Pago con Stripe</h3>
            <p className="text-sm text-slate-600 mt-1">
              Tarjeta, Apple Pay y Google Pay. Factura automática con tu NIF/CIF. No almacenamos datos de tarjeta.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Users size={22} className="text-brand-accent mb-2" aria-hidden="true" />
            <h3 className="font-bold text-slate-900">Hecho para el sector camper</h3>
            <p className="text-sm text-slate-600 mt-1">
              Compradores que buscan camper, no coches. Filtros técnicos de verdad: MMA, plazas, autonomía, homologación.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mt-14">
          <h2 id="faq" className="text-2xl font-black text-slate-900 mb-4">
            Preguntas frecuentes
          </h2>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map(f => (
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
          <h2 className="text-2xl font-black">Empieza gratis. Hazte Profesional cuando vendas de forma habitual.</h2>
          <p className="text-slate-300 mt-2 max-w-2xl">
            Publica tu primera camper sin pagar nada. Si eres taller o compraventa, 19 €/mes te dan
            capacidad, escaparate y estadísticas sin comisiones por venta.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LocalLink href="/publicar" className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white hover:bg-brand-accent-dark">
              Publicar gratis
            </LocalLink>
            <LocalLink href="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              Crear cuenta
            </LocalLink>
          </div>
        </section>
      </div>
    </>
  )
}
