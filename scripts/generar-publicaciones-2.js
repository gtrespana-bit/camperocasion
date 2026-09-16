// Script parte 2: Asignar seller_nombre a productos existentes + añadir ~21 extras + 30 de Ruben
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan variables'); process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Nombres venezolanos
const NOMBRES = [
  'Carlos Méndez','María González','José Ramírez','Ana Rodríguez','Pedro Martínez',
  'Luis Hernández','Carmen López','Miguel Torres','Rosa Díaz','Francisco Pérez',
  'Lucía Morales','Diego Vargas','Isabel Castro','Andrés Ruiz','Patricia Flores',
  'Ricardo Silva','Gabriela Herrera','Javier Mendoza','Daniela Rojas','Oscar Jiménez',
  'Alejandra Medina','Fernando Navarro','Valentina Ortiz','Guillermo Reyes','Mariana Soto',
  'Manuel Aguilar','Sofía Gutiérrez','Raúl Campos','Andrea Delgado','Héctor Molina',
  'Natalia Peña','Sergio Guerrero','Laura Romero','Daniel Acosta','Claudia Suárez',
  'Eduardo Ríos','Camila Domínguez','Alberto León','Paula Contreras','Roberto Mendoza',
]
const TEL = ['0412-5551234','0414-5559876','0416-5553210','0424-5556543','0412-5557890',
  '0414-5554321','0416-5558765','0424-5552109','0412-5553456','0414-5556789']

const rng = a => a[Math.floor(Math.random()*a.length)]
const rngInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a
const rngDate = d => new Date(Date.now() - rngInt(1,d)*864e6 - rngInt(0,864e6)).toISOString()

const ESTADOS = ['Distrito Capital','Miranda','Carabobo','Lara','Zulia','Aragua','Anzoategui','Bolivar','Merida','Tachira']
const CIUD = {
  'Distrito Capital':['Caracas','Chacao','Baruta'],'Miranda':['Los Teques','Guarenas','Guatire'],
  'Carabobo':['Valencia','Guacara','San Diego'],'Lara':['Barquisimeto','Cabudare','Carora'],
  'Zulia':['Maracaibo','Cabimas','San Francisco'],'Aragua':['Maracay','Turmero','La Victoria'],
  'Anzoategui':['Puerto Ordaz','Barcelona','Lechería'],'Bolivar':['Puerto Ordaz','Ciudad Guayana'],
  'Merida':['Mérida','Tovar','Ejido'],'Tachira':['San Cristóbal','Táriba'],
}

async function main() {
  const { data: perfiles } = await supabase.from('perfiles').select('id').limit(1)
  if (!perfiles?.length) { console.error('No profiles'); process.exit(1) }
  const adminId = perfiles[0].id

  const { data: cats } = await supabase.from('categorias').select('id,nombre')
  const catMap = {}; cats.forEach(c => catMap[c.nombre] = c.id)

  // --- STEP 1: Update existing products with seller_nombre ---
  console.log('📝 Assigning seller names to existing products...')
  let updated = 0
  const { data: prods } = await supabase.from('productos').select('id').is('seller_nombre', null)
  if (prods?.length) {
    for (const p of prods) {
      await supabase.from('productos').update({
        seller_nombre: rng(NOMBRES),
        seller_telefono: rng(TEL),
      }).eq('id', p.id)
      updated++
    }
  }
  console.log(`   ✅ ${updated} products updated\n`)

  // --- STEP 2: ~20 more products ---
  const extraProducts = [
    {cat:'vehiculos',sub:'Carros',t:'Hyundai Tucson 2019 automatica',d:'Hyundai Tucson 2019, automatica, traccion delantera. 40.000 km, todas las revisiones al dia. Camara de reversa, sensores, pantalla tactil. Nunca accidentada.',p:14500,e:'Bueno'},
    {cat:'vehiculos',sub:'Carros',t:'Renault Logan 2017 economico',d:'Renault Logan 2017, manual, 1.6. Muy economico de gasolina y repuestos baratos. 80.000 km, buen estado general.',p:3800,e:'Usado'},
    {cat:'vehiculos',sub:'Motos',t:'Bajaj Pulsar NS200 2022',d:'Bajaj Pulsar NS200 FI, inyectada, 2022. 10.000 km. Muy rapida y comoda. Frenos ABS de serie.',p:1300,e:'Bueno'},
    {cat:'vehiculos',sub:'Camionetas/SUV',t:'Toyota Hilux 2016 4x4 diesel',d:'Toyota Hilux 2016 doble cabina, 4x4, diesel. 90.000 km. Perfecta para trabajo o campo. Camper incluida.',p:17000,e:'Usado'},
    {cat:'vehiculos',sub:'Motos',t:'Hero Splendor 100cc economica',d:'Hero Splendor Plus 100cc, 2020. Super economica, 70km/galon. Ideal para delivery.',p:350,e:'Bueno'},
    {cat:'tecnologia',sub:'Celulares',t:'iPhone 12 64GB blanco',d:'iPhone 12 64GB, blanco. Battery health 83%. Face ID OK. Liberado.',p:290,e:'Bueno'},
    {cat:'tecnologia',sub:'Tablets',t:'iPad Air 2022 64GB WiFi',d:'iPad Air M1 2022, 64GB, WiFi. Color azul espacial. Perfecto para estudio.',p:320,e:'Como nuevo'},
    {cat:'tecnologia',sub:'Audio',t:'Parlante JBL Charge 5',d:'JBL Charge 5, negro. Super potente, bateria de 20 horas. Resistente al agua IP67.',p:65,e:'Como nuevo'},
    {cat:'tecnologia',sub:'Consolas',t:'Steam Deck 64GB',d:'Steam Deck 64GB, modelo original. Incluye funda oficial y tarjeta SD 256GB.',p:280,e:'Bueno'},
    {cat:'hogar',sub:'Electrodomesticos',t:'Secadora de ropa Samsung 14kg',d:'Secadora Samsung de 14kg, carga frontal. Digital, sensor de humedad.',p:250,e:'Bueno'},
    {cat:'hogar',sub:'Muebles',t:'Closet de 4 puertas con espejo',d:'Closet grande de 4 puertas con espejos. Color blanco, melamina.',p:120,e:'Usado'},
    {cat:'hogar',sub:'Decoracion',t:'Espejo decorativo redondo 80cm',d:'Espejo redondo de 80cm con marco dorado estilo vintage. Nuevo.',p:35,e:'Nuevo'},
    {cat:'moda',sub:'Ropa Mujer',t:'Chaqueta de cuero negra mujer',d:'Chaqueta de cuero sintetico, negra, talla M. Estilo motociclista.',p:30,e:'Nuevo'},
    {cat:'moda',sub:'Ropa Hombre',t:'Chaqueta North Face talla L',d:'The North Face Thermoball, talla L, negra. Super abrigada.',p:70,e:'Bueno'},
    {cat:'moda',sub:'Relojes',t:'Reloj Citizen Eco-Drive steel',d:'Citizen Eco-Drive carga solar, correa de acero. Modelo clasico elegante.',p:120,e:'Bueno'},
    {cat:'herramientas',sub:'Herramientas Electricas',t:'Compresor de aire 50L 2.5HP',d:'Compresor de aire de 50 litros, 2.5HP, 110V. Ideal para taller.',p:150,e:'Bueno'},
    {cat:'herramientas',sub:'Herramientas Manuales',t:'Desatornilladores magneticos 32 pcs',d:'Set de 32 desatornilladores magneticos. En caja organizadora.',p:15,e:'Nuevo'},
    {cat:'otros',sub:'Deportes',t:'Kayak inflable 2 personas',d:'Kayak inflable para 2 personas. Incluye remos y bomba.',p:90,e:'Como nuevo'},
    {cat:'otros',sub:'Libros',t:'Libros de ingenieria civil (5)',d:'Pack de 5 libros de ingenieria civil. Todos en espanol.',p:50,e:'Bueno'},
    {cat:'otros',sub:'Inmuebles',t:'Casa 3 habitaciones en Barquisimeto',d:'Casa amplia de 3 habitaciones, 2 banos, garage para 2 carros. Urbanizacion cerrada.',p:45000,e:'Bueno'},
    {cat:'otros',sub:'Mascotas',t:'Transportin para mascotas mediano',d:'Transportin para perros/gatos medianos. Aprobado por aerolineas.',p:25,e:'Bueno'},
  ]

  console.log('➕ Inserting extra products...')
  let inserted = 0
  for (const prod of extraProducts) {
    const est = rng(ESTADOS), ciu = rng(CIUD[est])
    const { error } = await supabase.from('productos').insert({
      user_id: adminId, titulo: prod.t, descripcion: prod.d,
      categoria_id: catMap[prod.cat], subcategoria: prod.sub,
      estado: prod.e, precio_usd: prod.p,
      ubicacion_estado: est, ubicacion_ciudad: ciu,
      activo: true, destacado: false,
      seller_nombre: rng(NOMBRES), seller_telefono: rng(TEL),
      visitas: rngInt(10,150), creado_en: rngDate(30),
    })
    if (error) { console.log(`   ❌ ${prod.t}: ${error.message}`) }
    else { console.log(`   ✅ ${prod.t} - $${prod.p} - ${ciu}`); inserted++ }
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`   ${inserted} inserted\n`)

  // --- STEP 3: 30 Ruben products ---
  console.log('👤 Inserting 30 Ruben products...')
  const rubenProducts = [
    {sub:'Herramientas Manuales',t:'Set completo de remodelacion - herramientas basicas',d:'Para quien este empezando en remodelaciones: incluye nivel, cinta metrica, escuadra, martillo, llaves inglesas y destornilladores.',p:45,e:'Bueno'},
    {sub:'Herramientas Electricas',t:'Rotomartillo Bosch GBH 2-26 profesional',d:'Rotomartillo Bosch profesional, 800W, SDS-Plus. Incluye 3 brocas de concreto y maletin.',p:95,e:'Bueno'},
    {sub:'Herramientas Electricas',t:'Atornillador inalambrico DeWalt 12V',d:'DeWalt 12V con 2 baterias y cargador. Compacto, ideal para espacios confinados. Set de puntas.',p:55,e:'Bueno'},
    {sub:'Muebles',t:'Vitrina de sala estilo moderno vidrio',d:'Vitrina de vidrio templado con estructura de aluminio. 180cm alto. Incluye iluminacion LED interna.',p:200,e:'Bueno'},
    {sub:'Decoracion',t:'Azulejos importados de diseno - 20m2',d:'20m2 de azulejos porcelainato importados, diseno tipo marmol blanco. 30x60cm. Sobraron de una obra.',p:120,e:'Nuevo'},
    {sub:'Electrodomesticos',t:'Calentador de agua electrico 40 litros',d:'Calentador de agua electrico de 40 litros, marca Rheem. Instalado, funcionando perfecto.',p:80,e:'Bueno'},
    {sub:'Muebles',t:'Estante flotante de madera 120cm',d:'Estante flotante de 120cm en madera de pino con acabado natural. Hecho a mano por carpintero.',p:35,e:'Nuevo'},
    {sub:'Herramientas Manuales',t:'Carretilla de construccion reforzada',d:'Carretilla con cubeta reforzada de 6 pies. Llanta neumatica nueva. Usada en obras.',p:40,e:'Bueno'},
    {sub:'Herramientas Electricas',t:'Sierra caladora Bosch 750W',d:'Sierra caladora Bosch GST 850 BE, velocidad variable. Incluye 6 hojas de corte.',p:65,e:'Bueno'},
    {sub:'Herramientas',t:'Pulidora de piso profesional',d:'Pulidora de piso para concreto y ceramica. Motor 2HP. Incluye disco de diamante.',p:180,e:'Bueno'},
    {sub:'Electrodomesticos',t:'Extractor de cocina inox 60cm',d:'Extractor de acero inoxidable, 60cm. Motor silencioso, 2 velocidades. 6 meses de uso.',p:55,e:'Como nuevo'},
    {sub:'Herramientas Electricas',t:'Lijadora orbital DeWalt random',d:'Lijadora DeWalt random orbital de 5 pulgadas. Motor 300W, colector de polvo.',p:45,e:'Bueno'},
    {sub:'Muebles',t:'Puerta de interior de madera con marco',d:'Puerta de madera maciza con marco incluido. 80x210cm. Color natural barnizado.',p:60,e:'Bueno'},
    {sub:'Herramientas Manuales',t:'Andamio modular de 2 metros',d:'Andamio modular de aluminio, 2 metros. Plegable y ligero. Incluye plataforma.',p:70,e:'Bueno'},
    {sub:'Herramientas Electricas',t:'Mezcladora de cemento electrica mini',d:'Mezcladora electrica tipo mini, capacidad 2 bolsas. Motor 1HP, 110V.',p:150,e:'Bueno'},
    {sub:'Decoracion',t:'Papel tapiz importado texturizado - 3 rollos',d:'3 rollos de papel tapiz texturizado importado, gris claro. Cada rollo cubre 5m2.',p:30,e:'Nuevo'},
    {sub:'Herramientas',t:'Pistola de silicona caliente industrial',d:'Pistola de silicona caliente industrial, 150W. Incluye 50 barras de silicona.',p:20,e:'Como nuevo'},
    {sub:'Electrodomesticos',t:'Fosa de acero inoxidable doble',d:'Fosa de cocina de acero inoxidable, doble cubeta + escurridor. Marca Franke.',p:90,e:'Como nuevo'},
    {sub:'Herramientas Manuales',t:'Escalera de aluminio extensible 4m',d:'Escalera de aluminio extensible hasta 4 metros. 5 secciones. Solo 8kg.',p:55,e:'Bueno'},
    {sub:'Muebles',t:'Repisa de bano con espejo integrado',d:'Mueble de bano con espejo integrado y luces LED. 80cm ancho. Resistente a la humedad.',p:85,e:'Nuevo'},
    {sub:'Herramientas Electricas',t:'Cortador de ceramica manual 60cm',d:'Cortador profesional 60cm. Corte limpio y preciso. Regla con medidor de angulo.',p:40,e:'Bueno'},
    {sub:'Herramientas',t:'Pistola neumatica para clavos Brad',d:'Pistola neumatica para clavos Brad 18GA, 5-50mm. Ligera para acabados. Incluye manguera.',p:30,e:'Bueno'},
    {sub:'Decoracion',t:'Led empotrable tipo ojo, pack de 12',d:'Pack de 12 luces LED empotrables tipo ojo, luz calida 3000K. 12W. Nuevos en caja.',p:48,e:'Nuevo'},
    {sub:'Herramientas Electricas',t:'Fresadora de mano Bosch 750W',d:'Fresadora Bosch GOF 1300, 750W. Incluye set de fresas basicas y guia paralela.',p:110,e:'Bueno'},
    {sub:'Electrodomesticos',t:'Griferia de cocina monomando negro',d:'Griferia monomando para cocina, acabado negro mate. Tipo cascada, giratoria 360.',p:45,e:'Nuevo'},
    {sub:'Herramientas',t:'Plomada y nivel laser combo',d:'Combo plomada laser + nivel de burbuja 60cm + nivel de bolsillo. En bolsa.',p:25,e:'Nuevo'},
    {sub:'Muebles',t:'Gabinetes de cocina modulares 3 piezas',d:'3 modulos en melamina blanca: base con cajones, alto y fosa. Cierre suave.',p:220,e:'Nuevo'},
    {sub:'Herramientas Electricas',t:'Pistola de calor DeWalt profesional',d:'Pistola de calor DeWalt 1800W, 2 velocidades. Incluye 4 boquillas.',p:35,e:'Como nuevo'},
    {sub:'Decoracion',t:'Rodapie de PVC imitacion madera - 10 barras',d:'10 barras de rodapie PVC imitacion roble. Cada barra 2.4m. Resistente a humedad.',p:25,e:'Nuevo'},
    {sub:'Herramientas',t:'Kit de sellado para bano completo',d:'Kit completo: silicona sanitaria, cinta selladora, espátula y removedor.',p:12,e:'Nuevo'},
  ]

  let rubenCount = 0
  for (const prod of rubenProducts) {
    let catId = catMap['herramientas']
    if (prod.sub === 'Muebles' || prod.sub === 'Electrodomesticos') catId = catMap['hogar']
    if (prod.sub === 'Decoracion') catId = catMap['hogar']
    if (!catId) catId = catMap['otros']

    const est = rng(ESTADOS), ciu = rng(CIUD[est])
    const { error } = await supabase.from('productos').insert({
      user_id: adminId, titulo: prod.t, descripcion: prod.d,
      categoria_id: catId, subcategoria: prod.sub,
      estado: prod.e, precio_usd: prod.p,
      ubicacion_estado: est, ubicacion_ciudad: ciu,
      activo: true, destacado: false,
      seller_nombre: 'Rubén', seller_telefono: '',
      visitas: rngInt(5,80), creado_en: rngDate(20),
    })
    if (error) { console.log(`   ❌ ${prod.t}: ${error.message}`) }
    else { console.log(`   ✅ ${prod.t} - $${prod.p}`); rubenCount++ }
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`   ${rubenCount} inserted\n`)

  console.log('🎉 All done!')
}

main().catch(e => { console.error(e); process.exit(1) })
