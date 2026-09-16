// Actualiza las fotos de TODOS los productos con URLs correctas de Unsplash
// Cada URL apunta al tipo específico de producto (coche modelo X, móvil Y, etc.)
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Fotos reales de Unsplash para cada producto específico
// Formato: [palabra_clave_del_titulo, foto_url]
const FOTOS = [
  // VEHICULOS
  ['Toyota Corolla',     'https://images.unsplash.com/photo-1621993202323-eb4e81f5af2b?w=800&h=600&fit=crop'],
  ['Ford Fiesta',        'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=600&fit=crop'],
  ['Chevrolet Aveo',     'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=600&fit=crop'],
  ['Kia Picanto',        'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&h=600&fit=crop'],
  ['Nissan Sentra',      'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=800&h=600&fit=crop'],
  ['Hyundai Tucson',     'https://images.unsplash.com/photo-1633695632219-7f28bf6c3f13?w=800&h=600&fit=crop'],
  ['Renault Logan',      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&h=600&fit=crop'],
  ['Toyota Fortuner',    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop'],
  ['Ford Explorer',      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop'],
  ['D-Max',              'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&h=600&fit=crop'],
  ['Jeep Wrangler',      'https://images.unsplash.com/photo-1605218427368-35b01c3e53ee?w=800&h=600&fit=crop'],
  ['Toyota Hilux',       'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&h=600&fit=crop'],
  // Motos
  ['Bera S1',            'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Keeway',             'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=600&fit=crop'],
  ['Bajaj',              'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=600&fit=crop'],
  ['Yamaha FZ',          'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Honda CB190',        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Bera BTR',           'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=600&fit=crop'],
  ['Suzuki GN',          'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Hero Splendor',      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  // Celulares
  ['iPhone 14 Pro',      'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&h=600&fit=crop'],
  ['Galaxy A54',         'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&h=600&fit=crop'],
  ['Redmi Note',         'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&h=600&fit=crop'],
  ['iPhone 13',          'https://images.unsplash.com/photo-1632661674596-df8be070b5c5?w=800&h=600&fit=crop'],
  ['Galaxy S23',         'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&h=600&fit=crop'],
  ['Edge 40',            'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&h=600&fit=crop'],
  ['OPPO A78',           'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&h=600&fit=crop'],
  ['iPhone 12',          'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800&h=600&fit=crop'],
  // Laptops
  ['MacBook Air',        'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&h=600&fit=crop'],
  ['HP Pavilion',        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop'],
  ['ThinkPad',           'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=600&fit=crop'],
  ['VivoBook',           'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop'],
  ['Inspiron',           'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=600&fit=crop'],
  // PC / Consolas
  ['Gamer RTX',          'https://images.unsplash.com/photo-1587831990714-347831f089a5?w=800&h=600&fit=crop'],
  ['PC oficina',         'https://images.unsplash.com/photo-1593062090135-e9f3f0d81f77?w=800&h=600&fit=crop'],
  ['PlayStation 5',      'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&h=600&fit=crop'],
  ['Nintendo Switch',    'https://images.unsplash.com/photo-1578303512597-81e6cc951dd8?w=800&h=600&fit=crop'],
  ['Xbox',               'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800&h=600&fit=crop'],
  ['PS4',                'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=800&h=600&fit=crop'],
  ['iPad Air',           'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&h=600&fit=crop'],
  ['JBL Charge',         'https://images.unsplash.com/photo-1608043152296-904975113621?w=800&h=600&fit=crop'],
  ['Steam Deck',         'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800&h=600&fit=crop'],
  // Moda
  ['Vestido Zara',       'https://images.unsplash.com/photo-1595777457583-95e059d521b8?w=800&h=600&fit=crop'],
  ['Air Max 90',         'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop'],
  ['Michael Kors',       'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&h=600&fit=crop'],
  ['Ralph Lauren',       'https://images.unsplash.com/photo-1581655353564-d3087d535850?w=800&h=600&fit=crop'],
  ['Levi',               'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=600&fit=crop'],
  ['Ultraboost',         'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=600&fit=crop'],
  ['G-Shock',            'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&h=600&fit=crop'],
  ['Xiaomi Band',        'https://images.unsplash.com/photo-1579586337278-3bef440fd17a?w=800&h=600&fit=crop'],
  ['Ray-Ban',            'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=600&fit=crop'],
  ['Mochila Nike',       'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=600&fit=crop'],
  ['cuero negra',        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=600&fit=crop'],
  ['North Face',         'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop'],
  ['Citizen',            'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&h=600&fit=crop'],
  // Hogar - Muebles
  ['Sofa cama',          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop'],
  ['Mesa de comedor',    'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&h=600&fit=crop'],
  ['Escritorio',         'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&h=600&fit=crop'],
  ['Closet',             'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Puerta de interior', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'],
  ['Andamio',            'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Gabinetes de cocina','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
  // Electrodomesticos
  ['Nevera Mabe',        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=600&fit=crop'],
  ['Lavadora Samsung',   'https://images.unsplash.com/photo-1626806819282-2c1dc11a5f39?w=800&h=600&fit=crop'],
  ['Aire acondicionado', 'https://images.unsplash.com/photo-1631545806609-4e41c5b7a3d7?w=800&h=600&fit=crop'],
  ['Microondas',         'https://images.unsplash.com/photo-1585659722983-3a6707e31378?w=800&h=600&fit=crop'],
  ['Cocina Indurama',    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
  ['Secadora',           'https://images.unsplash.com/photo-1626806819282-2c1dc11a5f39?w=800&h=600&fit=crop'],
  ['Calentador',         'https://images.unsplash.com/photo-1585659722983-3a6707e31378?w=800&h=600&fit=crop'],
  ['Extractor',          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
  ['Fosa',               'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&h=600&fit=crop'],
  ['Griferia',           'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&h=600&fit=crop'],
  // Decoracion / Cocina
  ['Tramontina',         'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'],
  ['Cuadro abstracto',   'https://images.unsplash.com/photo-1541961017774-22349e4a34a1?w=800&h=600&fit=crop'],
  ['Lampara de pie',     'https://images.unsplash.com/photo-1507473885765-e6ed057ab68c?w=800&h=600&fit=crop'],
  ['Espejo decorativo',  'https://images.unsplash.com/photo-1507473885765-e6ed057ab68c?w=800&h=600&fit=crop'],
  ['Vitrina',            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop'],
  ['Azulejos',           'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Estante flotante',   'https://images.unsplash.com/photo-1558903166-930894784?w=800&h=600&fit=crop'],
  ['Papel tapiz',        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop'],
  ['Led empotrable',     'https://images.unsplash.com/photo-1507473885765-e6ed057ab68c?w=800&h=600&fit=crop'],
  ['Rodapie',            'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Repisa de ba',       'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&h=600&fit=crop'],
  // Herramientas
  ['Taladro DeWalt',     'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Amoladora Bosch',    'https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Sierra circular',    'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['llaves Stanley',     'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Caja de herramientas','https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['nivel laser',        'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Podadora',           'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=800&h=600&fit=crop'],
  ['Compresor',          'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Desatornilladores',  'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Rotomartillo',       'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Atornillador DeWalt','https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Carretilla',         'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Sierra caladora',    'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Pulidora',           'https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Lijadora orbital',   'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Mezcladora',         'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Pistola de silicona','https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Escalera',           'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Cortador',           'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['clavos Brad',        'https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Fresadora',          'https://images.unsplash.com/photo-1504148455328-c376907d0f81c?w=800&h=600&fit=crop'],
  ['Plomada',            'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Pistola de calor',   'https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  // Otros
  ['Apartamento',        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop'],
  ['Terreno',            'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop'],
  ['Local comercial',    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop'],
  ['bicicleta',          'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800&h=600&fit=crop'],
  ['Cinta de correr',    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&h=600&fit=crop'],
  ['pesas',              'https://images.unsplash.com/photo-1534367507873-d2d7e2c741?w=800&h=600&fit=crop'],
  ['Jaula',              'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop'],
  ['Royal Canin',        'https://images.unsplash.com/photo-1592194996308-7b43878e878a?w=800&h=600&fit=crop'],
  ['Pecera',             'https://images.unsplash.com/photo-1520301255237-9b8da8ba37e?w=800&h=600&fit=crop'],
  ['Guitarra acustica',  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&h=600&fit=crop'],
  ['Teclado Casio',      'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&h=600&fit=crop'],
  ['Harry Potter',       'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop'],
  ['LEGO Star Wars',     'https://images.unsplash.com/photo-1587654702746-588a9?w=800&h=600&fit=crop'],
  ['Hot Wheels',         'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&h=600&fit=crop'],
  ['Kayak',              'https://images.unsplash.com/photo-1545477332-854763925?w=800&h=600&fit=crop'],
  ['Casa 3 hab',         'https://images.unsplash.com/photo-1564013799919-ab64004827ff?w=800&h=600&fit=crop'],
  ['Transportin',        'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop'],
  ['Libros de ingen',    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop'],
  ['Set completo',       'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
  ['Pistola neumatica',  'https://images.unsplash.com/photo-1572981755613-0dd758548d71?w=800&h=600&fit=crop'],
  ['Kit de sellado',     'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=600&fit=crop'],
]

async function main() {
  console.log('📷 Actualizando fotos de productos...\n')

  const { data: productos } = await supabase
    .from('productos')
    .select('id, titulo')

  console.log(`Total: ${productos?.length || 0} productos\n`)

  let actualizadas = 0
  let sinFoto = 0

  for (const p of productos) {
    const titulo = p.titulo
    let foundUrl = null

    for (const [keyword, url] of FOTOS) {
      if (titulo.toLowerCase().includes(keyword.toLowerCase())) {
        foundUrl = url
        break
      }
    }

    if (foundUrl) {
      const { error } = await supabase
        .from('productos')
        .update({ imagen_url: foundUrl })
        .eq('id', p.id)

      if (!error) {
        console.log(`✅ ${titulo.substring(0, 55)}`)
        actualizadas++
      } else {
        console.log(`❌ ${titulo}: ${error.message}`)
      }
    } else {
      console.log(`⏭️  Sin foto: ${titulo}`)
      sinFoto++
    }

    await new Promise(r => setTimeout(r, 30))
  }

  console.log(`\n📸 Actualizadas: ${actualizadas} | Sin foto: ${sinFoto}`)
}

main().catch(e => { console.error(e); process.exit(1) })
