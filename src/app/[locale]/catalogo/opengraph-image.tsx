import { ImageResponse } from 'next/og'
import { categoriasData } from '@/lib/categorias'
import { formatPrecio } from '@/lib/precio'

export const runtime = 'edge'
export const alt = 'CamperOcasión — Catálogo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Imagen Open Graph de /catalogo (y de sus vistas filtradas).
 *
 * Antes este fichero pintaba las categorías del marketplace generalista del que
 * nace el proyecto (Vehículos, Tecnología, Moda, Hogar, Herramientas): al
 * compartir el catálogo en WhatsApp o redes se veía una imagen con categorías
 * que no existen en CamperOcasión. Ahora los tipos salen del registro real
 * (`categoriasData.camper.subs`), así que la imagen no puede desincronizarse.
 */
const SUBS = categoriasData.camper.subs

// Paleta por familia camper: verde para furgonetas, naranja para autocaravanas,
// grafito para overland. Se elige por el slug de la subcategoría.
const COLORES: Record<string, string> = {
  'gran-volumen': '#166534',
  'camper-mediana': '#15803D',
  minicamper: '#16A34A',
  perfilada: '#C2410C',
  capuchina: '#EA580C',
  integral: '#9A3412',
  overland: '#1E293B',
}

const POR_DEFECTO = { name: 'Furgonetas camper y autocaravanas', icon: '🚐', color: '#0F172A' }

function resolverCategoria(param?: string) {
  if (!param) return POR_DEFECTO
  const sub = SUBS.find((s) => s.slug === param || s.label.toLowerCase() === param.toLowerCase())
  if (!sub) return POR_DEFECTO
  return {
    name: sub.label,
    icon: sub.icon || '🚐',
    color: COLORES[sub.slug] || POR_DEFECTO.color,
  }
}

export default async function Image({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const param = typeof searchParams?.subcategoria === 'string' ? searchParams.subcategoria : undefined
  const cat = resolverCategoria(param)
  const rangoPrecio = `De ${formatPrecio(20000)} a ${formatPrecio(80000)}`

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: cat.color,
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.18) 0%, transparent 40%), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.25) 0%, transparent 40%)',
          padding: '40px',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ fontSize: '120px', marginBottom: '20px' }}>{cat.icon}</div>
        <h1
          style={{
            fontSize: '58px',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {cat.name}
        </h1>
        <p style={{ fontSize: '32px', marginTop: '20px', textAlign: 'center', opacity: 0.92 }}>{rangoPrecio}</p>
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          camperocasion.online
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
