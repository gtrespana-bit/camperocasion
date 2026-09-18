import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Carga una fuente local (TTF) para no depender de la CDN en runtime:
// sin red externa la imagen 500.
type LocalFont = { data: Buffer; weight: number; style: 'normal' }
let cachedFonts: LocalFont[] | null = null
function getLocalFonts(): LocalFont[] {
  if (cachedFonts) return cachedFonts
  const dir = path.join(process.cwd(), 'src', 'app', 'fonts')
  const wanted: [string, number][] = [
    ['inter-latin-400-normal.ttf', 400],
    ['inter-latin-700-normal.ttf', 700],
    ['inter-latin-900-normal.ttf', 900],
  ]
  const fonts: LocalFont[] = []
  for (const [file, weight] of wanted) {
    try {
      fonts.push({ data: fs.readFileSync(path.join(dir, file)), weight, style: 'normal' })
    } catch {
      // Fuente no disponible: seguimos con el resto (o sin fuentes).
    }
  }
  cachedFonts = fonts
  return fonts
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria') || 'camper'

  const categorias: Record<string, { name: string; tagline: string; color: string }> = {
    camper: { name: 'Furgonetas Camper y Autocaravanas', tagline: 'El marketplace camper de España', color: '#15803D' },
    'gran-volumen': { name: 'Camper Gran Volumen', tagline: 'Ducato, Boxer, Jumper, Master y Sprinter', color: '#0F172A' },
    'camper-mediana': { name: 'Camper Mediana y Compacta', tagline: 'VW California, Marco Polo y Transit Custom', color: '#16A34A' },
    minicamper: { name: 'Minicamper', tagline: 'Berlingo, Kangoo, Caddy y más', color: '#EA580C' },
    perfilada: { name: 'Autocaravana Perfilada', tagline: 'Perfilada de ocasión en España', color: '#1E293B' },
    capuchina: { name: 'Autocaravana Capuchina', tagline: 'Capuchina de ocasión en España', color: '#15803D' },
    integral: { name: 'Autocaravana Integral', tagline: 'Adria, Hymer, Challenger, Laika…', color: '#0F172A' },
    overland: { name: 'Célula y 4x4 Overland', tagline: 'Para viajar fuera del asfalto', color: '#C2410C' },
  }

  const cat = categorias[categoria] || categorias.camper

  // SIN EMOJI: satori los renderiza fetchando SVG desde una CDN (jsdelivr).
  // Si no hay red externa, la imagen falla. Usamos formas geométricas.
  const localFonts = getLocalFonts()
  // Buffer es un Uint8Array válido para satori; `any` evita la fricción de
  // tipos Buffer<ArrayBufferLike> de TS 5.7+ y del union `Weight`.
  const fontOptions: any = localFonts.map(f => ({
    data: f.data,
    weight: f.weight,
    style: 'normal',
    name: 'Inter',
  }))

  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: cat.color, backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 40%), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.2) 0%, transparent 40%)', padding: '40px', color: 'white', fontFamily: 'Inter, sans-serif' }}>
        {/* Marca: silueta de furgoneta con formas */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '180px', height: '90px', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px 24px 4px 4px', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '8px' }}>
            <div style={{ width: '48px', height: '34px', backgroundColor: cat.color, borderRadius: '6px', marginRight: '10px' }} />
            <div style={{ width: '48px', height: '34px', backgroundColor: cat.color, borderRadius: '6px' }} />
          </div>
          <div style={{ width: '34px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', marginLeft: '-6px', marginBottom: '8px' }} />
          <div style={{ width: '34px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', marginLeft: '10px', marginBottom: '8px' }} />
        </div>
        <h1 style={{ fontSize: '58px', fontWeight: 'bold', textAlign: 'center', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>{cat.name}</h1>
        <p style={{ fontSize: '34px', marginTop: '18px', textAlign: 'center', opacity: 0.9 }}>{cat.tagline}</p>
        <div style={{ position: 'absolute', bottom: '20px', fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>camperocasion.online</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontOptions,
    }
  )
}
