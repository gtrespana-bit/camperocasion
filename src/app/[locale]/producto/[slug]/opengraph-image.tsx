import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase-server-client'
import { isUuid } from '@/lib/product-url'
import { formatPrecio } from '@/lib/precio'

export const runtime = 'edge'
export const alt = 'CamperOcasión - Producto'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string; locale: string } }) {
  try {
    const isParamUuid = isUuid(params.slug)
    
    let query = supabase
      .from('productos')
      .select('titulo, precio_usd, estado, ubicacion_ciudad, imagen_url')

    if (isParamUuid) {
      query = query.eq('id', params.slug)
    } else {
      query = query.eq('slug', params.slug)
    }

    const { data: product } = await query.maybeSingle()

    if (!product) {
      return new ImageResponse(
        (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', color: 'white', fontSize: '48px' }}>
            CamperOcasión Marketplace
          </div>
        ),
        { width: 1200, height: 630 }
      )
    }

    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', backgroundImage: 'radial-gradient(circle at 25% 25%, #16A34A 0%, transparent 40%), radial-gradient(circle at 75% 75%, #1E293B 0%, transparent 40%)', padding: '40px', color: 'white', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ display: 'flex', width: '100%', height: '60%', marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', border: '4px solid white', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            {product.imagen_url ? (
              <img src={product.imagen_url} alt={product.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>📦</div>
            )}
          </div>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px', lineHeight: 1.2, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
              {product.titulo.length > 30 ? product.titulo.substring(0, 30) + '...' : product.titulo}
            </h1>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '24px', fontWeight: 'bold' }}>
              <span style={{ color: '#16A34A' }}>{formatPrecio(product.precio_usd || 0)}</span>
              <span>{product.estado}</span>
              <span>{product.ubicacion_ciudad || 'España'}</span>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: '20px', fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
            CamperOcasión.es
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return new ImageResponse(
      (
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', color: 'white', fontSize: '48px' }}>
          CamperOcasión Marketplace
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}