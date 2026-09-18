// Script para generar publicaciones de ejemplo para CamperOcasión
// Genera anuncios de furgonetas camper y autocaravanas de ocasión en España.
// Ejecutar: node scripts/generar-publicaciones.js
// Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local
//
// NOTA: Este script es solo para poblar datos de prueba / desarrollo.
// En producción los anuncios los crean los vendedores desde /publicar.

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Nombres de ejemplo (España)
const NOMBRES = [
  'Carlos Martínez', 'María García', 'José López', 'Ana Rodríguez', 'Pedro Sánchez',
  'Lucía Fernández', 'Miguel Torres', 'Laura Díaz', 'Francisco Pérez', 'Isabel Moreno',
  'Javier Ruiz', 'Carmen Jiménez', 'David Hernández', 'Sofía Álvarez', 'Alberto Navarro',
  'Raquel Castro', 'Diego Vargas', 'Patricia Flores', 'Ricardo Ortiz', 'Elena Molina',
]

// Provincias y CC.AA. de España (muestra)
const UBICACIONES = [
  { estado: 'Madrid', ciudad: 'Madrid' },
  { estado: 'Cataluña', ciudad: 'Barcelona' },
  { estado: 'Cataluña', ciudad: 'Girona' },
  { estado: 'Comunitat Valenciana', ciudad: 'Valencia' },
  { estado: 'Comunitat Valenciana', ciudad: 'Alicante' },
  { estado: 'Andalucía', ciudad: 'Sevilla' },
  { estado: 'Andalucía', ciudad: 'Málaga' },
  { estado: 'Andalucía', ciudad: 'Granada' },
  { estado: 'País Vasco', ciudad: 'Vizcaya' },
  { estado: 'País Vasco', ciudad: 'Gipuzkoa' },
  { estado: 'Galicia', ciudad: 'A Coruña' },
  { estado: 'Galicia', ciudad: 'Pontevedra' },
  { estado: 'Castilla y León', ciudad: 'Valladolid' },
  { estado: 'Aragón', ciudad: 'Zaragoza' },
  { estado: 'Baleares', ciudad: 'Baleares' },
  { estado: 'Canarias', ciudad: 'Las Palmas' },
]

const FOTOS_CAMPER = [
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop',
]

// Anuncios camper de ejemplo — 100% vertical camper
const PRODUCTOS = [
  { sub: 'Gran Volumen', titulo: 'Fiat Ducato L3H2 camperizada 2019 — 140 CV', desc: 'Ducato 2.3 Multijet 140 CV, L3H2, 92.000 km. Homologada como vehículo vivienda (2448), distintivo C, 4 plazas para viajar y 3 para dormir. Calefacción diésel, placa 200 W, batería litio 100 Ah, inversor 2000 W, baño con ducha interior, ITV al día.', precio: 38900, estado: 'Bueno' },
  { sub: 'Gran Volumen', titulo: 'Peugeot Boxer L4H3 gran volumen 2020', desc: 'Boxer 2.2 BlueHDi 140 CV, L4H3, 78.000 km. Homologación 2448, MMA hasta 3.500 kg (carnet B), altura 2,75 m. Autonomía completa: calefacción, agua caliente, nevera compresor.', precio: 42500, estado: 'Bueno' },
  { sub: 'Gran Volumen', titulo: 'Citroën Jumper L2H2 camper 2017', desc: 'Jumper 2.0 HDi 130 CV, 135.000 km. Distintivo C, 2 plazas viaje / 2 dormir. Batería AGM, placa 150 W. Muy cuidada.', precio: 28900, estado: 'Usado' },
  { sub: 'Camper Mediana / Compacta', titulo: 'VW California Ocean T6 2018', desc: 'Volkswagen California Ocean T6 2.0 TDI 150 CV DSG, 110.000 km. Techo elevable, cocina, calefacción estacionaria. Libro de mantenimiento al día.', precio: 47900, estado: 'Bueno' },
  { sub: 'Camper Mediana / Compacta', titulo: 'Mercedes Marco Polo 2021 — 190 CV', desc: 'Marco Polo V 300d 239 CV? No, 190 CV. 45.000 km, como nueva. Distintivo ECO.', precio: 56900, estado: 'Como nuevo' },
  { sub: 'Minicamper', titulo: 'Citroën Berlingo camperizada 2020', desc: 'Berlingo BlueHDi 100, L2, 67.000 km. Módulo cama + cocina extraíble, homologada. Ideal como primer camper.', precio: 19900, estado: 'Bueno' },
  { sub: 'Autocaravana Perfilada', titulo: 'Benimar Tessoro 483 2020 — Fiat Ducato', desc: 'Perfilada Benimar 7 m, 2+2 plazas, 58.000 km. Distintivo C. Garaje trasero, aire cabina.', precio: 54900, estado: 'Bueno' },
  { sub: 'Autocaravana Capuchina', titulo: 'Challenger Genesis C256 2018', desc: 'Capuchina 6 plazas (4+2), litera capuchina, 82.000 km. Familia numerosa. ITV 2026.', precio: 45900, estado: 'Bueno' },
  { sub: 'Autocaravana Integral', titulo: 'Hymer B-MC I 580 2021', desc: 'Integral Hymer 7,2 m, 2 plazas amplias, 38.000 km. Integral premium, calefacción Alde.', precio: 78900, estado: 'Como nuevo' },
  { sub: 'Célula y 4x4 Overland', titulo: 'Toyota Hilux + célula Azalai 2019 4x4', desc: 'Pick-up Hilux 2.4 D-4D 4x4 + célula desmontable Azalai, 4 plazas dormir. Preparada overland.', precio: 52900, estado: 'Bueno' },
]

function randomArray(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomDate(daysBack) {
  const now = Date.now()
  return new Date(now - Math.random() * daysBack * 864e6).toISOString()
}

async function main() {
  console.log('🚐 Generando publicaciones camper para CamperOcasión...\n')

  const { data: categorias } = await supabase.from('categorias').select('id, nombre')
  if (!categorias?.length) { console.error('No hay categorías. Aplica primero setup-camperocasion.sql'); process.exit(1) }
  const catMap = {}
  categorias.forEach(c => { catMap[c.nombre] = c.id })
  const categoriaId = catMap['camper']
  if (!categoriaId) { console.error('Categoría camper no encontrada'); process.exit(1) }

  const { data: perfiles } = await supabase.from('perfiles').select('id').limit(1)
  if (!perfiles?.length) { console.error('No hay perfiles. Registra al menos 1 usuario.'); process.exit(1) }
  const userId = perfiles[0].id
  console.log(`✅ Usando user_id: ${userId} · categoría camper: ${categoriaId}`)

  let total = 0
  for (const prod of PRODUCTOS) {
    const ubi = randomArray(UBICACIONES)
    const creadoEn = randomDate(30)
    const { error } = await supabase.from('productos').insert({
      user_id: userId,
      titulo: prod.titulo,
      descripcion: prod.desc,
      categoria_id: categoriaId,
      subcategoria: prod.sub,
      marca: prod.titulo.split(' ')[0],
      estado: prod.estado,
      precio_usd: prod.precio, // columna legado: se guarda en euros
      ubicacion_estado: ubi.estado,
      ubicacion_ciudad: ubi.ciudad,
      imagen_url: randomArray(FOTOS_CAMPER),
      activo: true,
      destacado: false,
      visitas: randomInt(5, 200),
      creado_en: creadoEn,
      actualizado_en: creadoEn,
      especificaciones: {
        'Año de matriculación': String(2017 + randomInt(0, 6)),
        'Kilómetros': String(prod.precio > 40000 ? randomInt(30000, 110000) : randomInt(50000, 150000)),
        'Combustible': 'Diésel',
        'Homologación': prod.sub.includes('Gran Volumen') ? 'Vehículo Vivienda (2448 / 3148)' : 'Vehículo Vivienda (2448 / 3148)',
        'Plazas homologadas para viajar': String(randomInt(2, 4)),
        'Plazas para dormir': String(randomInt(2, 4)),
      },
    })
    if (error) console.error(` ❌ ${prod.titulo}:`, error.message)
    else { console.log(` ✅ ${prod.titulo} — ${prod.precio} € — ${ubi.ciudad}`); total++ }
    await new Promise(r => setTimeout(r, 120))
  }
  console.log(`\n🎉 ${total} campers insertados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
