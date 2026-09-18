import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'CamperOcasión - Publicar'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', backgroundImage: 'radial-gradient(circle at 25% 25%, #EA580C 0%, transparent 40%), radial-gradient(circle at 75% 75%, #1E293B 0%, transparent 40%)', padding: '40px', color: 'white', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '120px', marginBottom: '20px' }}>🚐</div>
        <h1 style={{ fontSize: '60px', fontWeight: 'bold', textAlign: 'center', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>Publica Gratis</h1>
        <p style={{ fontSize: '34px', marginTop: '20px', textAlign: 'center', opacity: 0.9 }}>Vende tu camper o autocaravana en España</p>
        <div style={{ position: 'absolute', bottom: '20px', fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>camperocasion.online</div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}