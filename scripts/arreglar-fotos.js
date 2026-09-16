// Actualiza las fotos de TODOS los productos camper con URLs de Unsplash
// Cada URL apunta a un tipo de camper/autocaravana.
// Ejecutar: node scripts/arreglar-fotos.js
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Fotos camper de Unsplash (gratuitas, sin API key) — una por tipo de camper
const FOTOS = [
  ['Gran Volumen',       'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=600&fit=crop'],
  ['Camper Mediana',     'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&h=600&fit=crop'],
  ['Minicamper',         'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop'],
  ['Perfilada',          'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop'],
  ['Capuchina',          'https://images.unsplash.com/photo-1513310713192-3e0b43915ea0?w=800&h=600&fit=crop'],
  ['Integral',           'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=800&h=600&fit=crop'],
  ['Overland',           'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=600&fit=crop'],
  ['Ducato',             'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=600&fit=crop'],
  ['Boxer',              'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&h=600&fit=crop'],
  ['Jumper',             'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop'],
  ['Master',             'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=600&fit=crop'],
  ['Crafter',            'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop'],
  ['Sprinter',           'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=600&fit=crop'],
  ['California',         'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&h=600&fit=crop'],
  ['Marco Polo',         'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop'],
  ['Berlingo',           'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop'],
  ['Benimar',            'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=800&h=600&fit=crop'],
  ['Hymer',              'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=800&h=600&fit=crop'],
]

function fotoParaTitulo(titulo) {
  for (const [kw, url] of FOTOS) {
    if (titulo.toLowerCase().includes(kw.toLowerCase())) return url
  }
  return FOTOS[0][1]
}

async function main() {
  console.log('🔧 Arreglando fotos de productos camper...\n')
  const { data: productos, error } = await supabase.from('productos').select('id, titulo, imagen_url')
  if (error) { console.error(error.message); process.exit(1) }

  let fixed = 0
  for (const p of productos) {
    if (!p.imagen_url || p.imagen_url.includes('placeholder')) {
      const nueva = fotoParaTitulo(p.titulo)
      const { error: upErr } = await supabase.from('productos').update({ imagen_url: nueva }).eq('id', p.id)
      if (!upErr) { console.log(` ✅ ${p.titulo.slice(0,60)} → foto asignada`); fixed++ }
    }
  }
  console.log(`\n🎉 ${fixed} productos actualizados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
