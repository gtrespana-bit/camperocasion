// Script parte 2 — CamperOcasión (España)
// Genera publicaciones adicionales de campers/autocaravanas y corrige datos heredados.
// Ejecutar: node scripts/generar-publicaciones-2.js
// Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Faltan variables'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Nombres españoles de ejemplo
const NOMBRES = [
  'Carlos Martínez','María García','José López','Ana Rodríguez','Pedro Sánchez',
  'Lucía Fernández','Miguel Torres','Laura Díaz','Francisco Pérez','Isabel Moreno',
]

const UBICACIONES = [
  { estado: 'Madrid', ciudad: 'Madrid' },
  { estado: 'Cataluña', ciudad: 'Barcelona' },
  { estado: 'Andalucía', ciudad: 'Sevilla' },
  { estado: 'Comunitat Valenciana', ciudad: 'Valencia' },
  { estado: 'País Vasco', ciudad: 'Vizcaya' },
  { estado: 'Galicia', ciudad: 'A Coruña' },
  { estado: 'Aragón', ciudad: 'Zaragoza' },
  { estado: 'Andalucía', ciudad: 'Málaga' },
]

const rng = a => a[Math.floor(Math.random()*a.length)]
const rngInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a
const rngDate = d => new Date(Date.now() - rngInt(1,d)*864e6 - rngInt(0,864e6)).toISOString()

async function main() {
  const { data: perfiles } = await supabase.from('perfiles').select('id').limit(1)
  if (!perfiles?.length) { console.error('No profiles'); process.exit(1) }
  const adminId = perfiles[0].id

  const { data: cats } = await supabase.from('categorias').select('id,nombre')
  const catMap = {}; cats.forEach(c => catMap[c.nombre] = c.id)
  const camperId = catMap['camper']
  if (!camperId) { console.error('Categoría camper no encontrada — aplica setup-camperocasion.sql'); process.exit(1) }

  // Productos camper adicionales (para tener volumen de ejemplo)
  const extraProducts = [
    { sub: 'Gran Volumen', t: 'Renault Master L3H2 2018 camperizada', d: 'Master 2.3 dCi 145 CV, 88.000 km. Homologada 2448, distintivo C, calefacción Webasto, agua caliente, placa 180 W.', p: 34500, e: 'Bueno' },
    { sub: 'Gran Volumen', t: 'MAN TGE L4H3 2021 — 177 CV', d: 'MAN TGE 3.140 177 CV 4x2, 52.000 km. Gran volumen XL, baño completo, batería litio.', p: 49900, e: 'Como nuevo' },
    { sub: 'Camper Mediana / Compacta', t: 'Ford Transit Custom Nugget 2019', d: 'Transit Custom 2.0 130 CV, 76.000 km. Conversión Nugget, techo elevable.', p: 38900, e: 'Bueno' },
    { sub: 'Minicamper', t: 'VW Caddy Maxi camper 2019', d: 'Caddy 2.0 TDI 102 CV, 71.000 km. Minicamper con cama y cocina desmontable.', p: 22900, e: 'Bueno' },
    { sub: 'Autocaravana Perfilada', t: 'McLouis Menfys 2020 4 plazas', d: 'Perfilada McLouis 7 m, 44.000 km. Distintivo C, garaje.', p: 52900, e: 'Bueno' },
    { sub: 'Autocaravana Integral', t: 'Laika Kosmo 2020 — integral', d: 'Laika Kosmo 209, 61.000 km. Integral compacta, mucha luminosidad.', p: 59900, e: 'Bueno' },
    { sub: 'Célula y 4x4 Overland', t: 'Nissan Navara + célula 2020 4x4', d: 'Navara 2.3 dCi 190 4x4 + célula, 48.000 km. Overland.', p: 47900, e: 'Bueno' },
  ]

  console.log('➕ Insertando campers adicionales...')
  let inserted = 0
  for (const prod of extraProducts) {
    const ubi = rng(UBICACIONES)
    const { error } = await supabase.from('productos').insert({
      user_id: adminId, titulo: prod.t, descripcion: prod.d,
      categoria_id: camperId, subcategoria: prod.sub,
      estado: prod.e, precio_usd: prod.p, // legado: euros
      ubicacion_estado: ubi.estado, ubicacion_ciudad: ubi.ciudad,
      activo: true, destacado: false,
      visitas: rngInt(10,150), creado_en: rngDate(25),
      especificaciones: {
        'Año de matriculación': String(2018 + rngInt(0,4)),
        'Kilómetros': String(rngInt(40000, 110000)),
        'Combustible': 'Diésel',
        'Homologación': 'Vehículo Vivienda (2448 / 3148)',
        'Plazas homologadas para viajar': '4',
        'Plazas para dormir': '3',
      }
    })
    if (error) console.log(`   ❌ ${prod.t}: ${error.message}`)
    else { console.log(`   ✅ ${prod.t} — ${prod.p} € — ${ubi.ciudad}`); inserted++ }
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`   ${inserted} insertados.\n🎉 Hecho.`)
}

main().catch(e => { console.error(e); process.exit(1) })
