import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import Image from 'next/image'
import { setRequestLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import PublicHero from '@/components/editorial/PublicHero'
import { supabase } from '@/lib/supabase-server-client'
import BadgeVerificado from '@/components/BadgeVerificado'
import { Store, MapPin } from 'lucide-react'

/**
 * Directorio de camperizadores y vendedores profesionales.
 *
 * Doble función: al comprador le da una vía de entrada distinta a la del
 * catálogo (buscar por taller, no por vehículo) y al profesional le da un
 * motivo para abrir tienda, porque aparecer aquí es tráfico gratis.
 */

export const revalidate = 600

const SITIO = 'https://camperocasion.online'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const english = locale === 'en'
  const title = english ? 'Camper converters and professional sellers in Spain' : 'Camperizadores y profesionales en España'
  const description = english
    ? 'Browse campervan converters, workshops and professional sellers in Spain. Explore their listings and locations.'
    : 'Directorio de talleres y profesionales de campers y autocaravanas en España. Consulta stock, ubicación y valoraciones.'
  const canonicalEs = `${SITIO}/tiendas`
  const canonical = english ? `${SITIO}/en/tiendas` : canonicalEs
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { 'es-ES': canonicalEs, 'x-default': canonicalEs },
    },
    robots: { index: !english, follow: true },
    openGraph: { title, description, url: canonical, siteName: 'CamperOcasión', locale: english ? 'en_US' : 'es_ES' },
  }
}

async function getTiendas() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, slug, nombre, descripcion, ciudad, estado, verificado, foto_perfil_url, tipo_vendedor')
    .eq('tienda_activa', true)
    .not('slug', 'is', null)
    .order('nombre')
    .limit(200)

  // Sin la migración aplicada, la columna no existe: lista vacía en lugar de 500.
  if (error) return []
  return data || []
}

export default async function TiendasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const english = locale === 'en'
  const copy = english ? {
    home: 'Home', directory: 'Shops', name: 'Camper converters and professional sellers in Spain',
    description: 'Browse campervan converters, workshops and professional sellers in Spain.',
    heroTitle: 'Camper converters and professional sellers', heroDesc: 'Explore workshops and professional sellers with active listings on CamperOcasión. Browse their inventory and location.',
    emptyTitle: 'No shops are published yet', emptyDesc: 'Are you a converter or professional seller? Open your own shopfront with the Professional plan and show your inventory on a branded page.',
    openShop: 'Explore plans and open my shop', shop: 'Shop', converter: 'Camper converter', professional: 'Professional seller',
    ctaTitle: 'Selling campers professionally?', ctaDesc: 'Open your own shopfront: a page with your logo, inventory and a shareable link for your website or social media.', viewPlans: 'View plans',
  } : {
    home: 'Inicio', directory: 'Tiendas', name: 'Camperizadores y concesionarios de camper en España',
    description: 'Directorio de talleres de camperización y vendedores profesionales de furgonetas camper y autocaravanas en España.',
    heroTitle: 'Camperizadores y profesionales', heroDesc: 'Talleres de camperización y vendedores profesionales con stock en CamperOcasión. Consulta su catálogo, ubicación y opiniones.',
    emptyTitle: 'Todavía no hay tiendas publicadas', emptyDesc: '¿Eres camperizador o vendedor profesional? Abre tu escaparate con el plan Profesional por 19 €/mes y enseña todo tu stock en una página propia.',
    openShop: 'Ver planes y abrir mi tienda', shop: 'Tienda', converter: 'Camperizador', professional: 'Profesional',
    ctaTitle: '¿Vendes campers de forma profesional?', ctaDesc: 'Abre tu escaparate con un pack: una página con tu logo, tu stock completo y tu dirección web propia que puedes enlazar desde tu Instagram.', viewPlans: 'Ver planes',
  }
  const prefix = english ? '/en' : ''

  const tiendas = await getTiendas()

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: copy.home, item: SITIO + (english ? '/en' : '/') },
      { '@type': 'ListItem', position: 2, name: copy.directory, item: SITIO + prefix + '/tiendas' },
    ],
  }
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': SITIO + prefix + '/tiendas#collection',
    name: copy.name,
    description: copy.description,
    url: SITIO + prefix + '/tiendas',
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': SITIO + prefix + '/tiendas#breadcrumb' },
    ...(tiendas.length > 0 ? { mainEntity: { '@id': SITIO + prefix + '/tiendas#itemlist' } } : {}),
  }
  const itemListJsonLd = tiendas.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': SITIO + prefix + '/tiendas#itemlist',
    name: copy.heroTitle,
    numberOfItems: tiendas.length,
    itemListElement: tiendas.slice(0, 30).map((t: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITIO + prefix + '/tienda/' + t.slug,
      name: t.nombre || copy.shop,
    })),
  } : null
  const graphJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, collectionJsonLd, ...(itemListJsonLd ? [itemListJsonLd] : [])],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(graphJsonLd) }} />
      <div className="public-page min-h-screen">
        <PublicHero eyebrow="CamperOcasión" title={copy.heroTitle} description={copy.heroDesc} compact />
        <div className="public-shell py-12 lg:py-20">

      {tiendas.length === 0 ? (
        <div className="public-card p-10 text-center">
          <Store size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-700 font-semibold mb-1">{copy.emptyTitle}</p>
          <p className="text-sm text-gray-500 mb-5">
            {copy.emptyDesc}
          </p>
          <LocalLink
            href="/para-profesionales"
            className="inline-block bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark transition"
          >
            {copy.openShop}
          </LocalLink>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tiendas.map(t => {
              const ubicacion = [t.ciudad, t.estado].filter(Boolean).join(', ')
              return (
                <LocalLink
                  key={t.id}
                  href={`/tienda/${t.slug}`}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition flex gap-4"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0 grid place-items-center">
                    {t.foto_perfil_url ? (
                      <Image
                        src={t.foto_perfil_url}
                        alt={t.nombre || copy.shop}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-bold text-gray-900 truncate">{t.nombre}</h2>
                      {t.verificado && <BadgeVerificado size="sm" />}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      {t.tipo_vendedor === 'camperizador' ? copy.converter : copy.professional}
                    </p>
                    {ubicacion && (
                      <p className="text-sm text-gray-600 inline-flex items-center gap-1">
                        <MapPin size={13} className="text-brand-accent" />
                        {ubicacion}
                      </p>
                    )}
                    {t.descripcion && (
                      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{t.descripcion}</p>
                    )}
                  </div>
                </LocalLink>
              )
            })}
          </div>

          <div className="bg-gradient-to-br from-brand-primary to-brand-dark text-white rounded-2xl p-8 mt-10 text-center">
            <h2 className="text-2xl font-bold mb-2">{copy.ctaTitle}</h2>
            <p className="opacity-90 mb-5 max-w-xl mx-auto">
              {copy.ctaDesc}
            </p>
            <LocalLink
              href="/para-profesionales"
              className="inline-block bg-white text-brand-primary px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition"
            >
              {copy.viewPlans}
            </LocalLink>
          </div>
        </>
      )}
        </div>
      </div>
    </>
  )
}
