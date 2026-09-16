import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'CamperOcasión - Catálogo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { locale: string } }, { searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const categoria = (searchParams?.categoria as string) || 'todos'
  
  const categorias: Record<string, { name: string; icon: string; color: string }> = {
    vehiculos: { name: 'Vehículos', icon: '🚗', color: '#FF6B35' },
    tecnologia: { name: 'Tecnología', icon: '💻', color: '#2E86AB' },
    moda: { name: 'Moda', icon: '👗', color: '#A29BFE' },
    hogar: { name: 'Hogar', icon: '🛋️', color: '#55EFC4' },
    herramientas: { name: 'Herramientas', icon: '🔧', color: '#F1C40F' },
    otros: { name: 'Otros', icon: '📦', color: '#95A5A6' },
    todos: { name: 'Todos los productos', icon: '🛍️', color: '#0F172A' }
  }

  const cat = categorias[categoria] || categorias.todos

  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: cat.color, backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 40%), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.2) 0%, transparent 40%)', padding: '40px', color: 'white', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '120px', marginBottom: '20px' }}>{cat.icon}</div>
        <h1 style={{ fontSize: '60px', fontWeight: 'bold', textAlign: 'center', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>{cat.name}</h1>
        <p style={{ fontSize: '36px', marginTop: '20px', textAlign: 'center', opacity: 0.9 }}>Marketplace de España</p>
        <div style={{ position: 'absolute', bottom: '20px', fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>CamperOcasión.es</div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}