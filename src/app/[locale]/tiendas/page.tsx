import type { Metadata } from 'next'
import Image from 'next/image'
import { setRequestLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
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

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Camperizadores y concesionarios de camper en España'
  const description =
    'Directorio de talleres de camperización y vendedores profesionales de furgonetas camper y autocaravanas en España. Consulta su stock, su ubicación y sus valoraciones.'
  return {
    title,
    description,
    alternates: {
      canonical: `${SITIO}/tiendas`,
      languages: { 'es-ES': `${SITIO}/tiendas`, 'x-default': `${SITIO}/tiendas` },
    },
    openGraph: { title, description, url: `${SITIO}/tiendas`, siteName: 'CamperOcasión', locale: 'es_ES' },
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

  const tiendas = await getTiendas()

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-3">
          Camperizadores y <span className="text-brand-accent">profesionales</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Talleres de camperización y vendedores profesionales con stock en CamperOcasión.
          Mira su catálogo completo, dónde están y qué dicen sus clientes.
        </p>
      </div>

      {tiendas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Store size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-700 font-semibold mb-1">Todavía no hay tiendas publicadas</p>
          <p className="text-sm text-gray-500 mb-5">
            ¿Eres camperizador o vendedor profesional? Abre tu tienda gratis y enseña todo tu stock
            en una página propia.
          </p>
          <LocalLink
            href="/dashboard"
            className="inline-block bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark transition"
          >
            Abrir mi tienda
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
                        alt={t.nombre || 'Tienda'}
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
                      {t.tipo_vendedor === 'camperizador' ? 'Camperizador' : 'Profesional'}
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
            <h2 className="text-2xl font-bold mb-2">¿Vendes campers de forma profesional?</h2>
            <p className="opacity-90 mb-5 max-w-xl mx-auto">
              Abre tu tienda gratis: una página con tu logo, tu stock completo y tu dirección web
              propia que puedes enlazar desde tu Instagram.
            </p>
            <LocalLink
              href="/dashboard"
              className="inline-block bg-white text-brand-primary px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition"
            >
              Abrir mi tienda
            </LocalLink>
          </div>
        </>
      )}
    </div>
  )
}
