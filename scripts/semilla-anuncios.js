// ═══════════════════════════════════════════════════════════════════════════
// SEMILLA DE ANUNCIOS — CamperOcaasión
// ─────────────────────────────────────────────────────────────────────────────
// Rellena el marketplace con 20 anuncios completos y realistas de campers y
// autocaravanas de ocasión en España:
//
//   · 7 subcategorías (gran volumen, mediana, mini, perfilada, capuchina,
//     integral y overland 4x4).
//   · Ficha técnica COMPLETA por anuncio (mismas claves del formulario
//     /publicar y de los filtros del catálogo → ver src/lib/filtros-tecnicos.ts).
//   · Descripciones largas y naturales, escritas a mano, ninguna genérica.
//   · 3-5 fotos REALES por anuncio, verificadas visualmente, coherentes con
//     el vehículo (mismo color/modelo dentro de cada anuncio). Se suben al
//     bucket `productos-fotos` de Supabase Storage, igual que hace la app con
//     los anuncios reales (así next/image las sirve sin tocar remotePatterns).
//   · Vendedores repartidos por toda España (usuarios de demostración con
//     perfil completo: nombre, teléfono, ciudad...). Algunos verificados.
//   · Fechas, visitas, destacados, boost, reservas y homologación verificada
//     repartidos como cabría esperar en un marketplace real.
//
// USO
// ─────────────────────────────────────────────────────────────────────────────
//   1. Copia tus claves en .env.local (mismo archivo que usan los otros
//      scripts del directorio scripts/):
//          NEXT_PUBLIC_SUPABASE_URL=https://hbiywrddxrsidniwxuhe.supabase.co
//          SUPABASE_SERVICE_KEY=eyJhbGciOi...   (service_role; también acepta
//          SUPABASE_SERVICE_ROLE_KEY o las nuevas sb_secret_...)
//   2. Ejecuta:
//          node scripts/semilla-anuncios.js            → inserta lo que falte
//          node scripts/semilla-anuncios.js --reset    → borra lo sembrado y
//                                                        lo vuelve a insertar
//          node scripts/semilla-anuncios.js --dry-run  → imprime el plan sin
//                                                        tocar la base de datos
//
// IDEMPOTENCIA: un anuncio se salta si ya existe uno con el mismo título del
// mismo vendedor de la semilla. Las fotos se suben con upsert, así que
// re-ejecutar no duplica archivos.
//
// ⚠️ SOLO para desarrollo / demostración. En producción los anuncios reales
//    los publican los vendedores desde /publicar.
// ═══════════════════════════════════════════════════════════════════════════

const path = require('path')
const fs = require('fs')

// Carga las claves de .env / .env.local. Usa el paquete dotenv si está
// instalado (esto scripts suelen correr con `npm install` hecho) y, si no,
// hace un parseo mínimo compatible con el formato KEY=VALOR de Supabase.
function cargarEnv() {
  try {
    require('dotenv').config({ path: '.env' })
    require('dotenv').config({ path: '.env.local', override: true })
    return
  } catch {
    for (const f of ['.env', '.env.local']) {
      if (!fs.existsSync(f)) continue
      for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
        const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const valor = m[2].replace(/^["']|["']$/g, '').trim()
        if (!process.env[m[1]]) process.env[m[1]] = valor
      }
    }
  }
}
cargarEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const ARGS = process.argv.slice(2)
const RESET = ARGS.includes('--reset')
const DRY_RUN = ARGS.includes('--dry-run')

const BUCKET = 'productos-fotos'
const FOTOS_DIR = path.join(__dirname, 'semilla', 'fotos')
const CATEGORIA = 'camper'

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    '❌ Faltan credenciales. Define NEXT_PUBLIC_SUPABASE_URL y\n' +
      '   SUPABASE_SERVICE_KEY (o SUPABASE_SERVICE_ROLE_KEY) en .env.local\n' +
      '   (Supabase → Project Settings → API Keys → service_role / sb_secret_).'
  )
  process.exit(1)
}

let supabase = null
if (!DRY_RUN) {
  const { createClient } = require('@supabase/supabase-js')
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** ISO de "hace X horas" (fechas de publicación recientes y escalonadas). */
function haceHoras(h) {
  return new Date(Date.now() - h * 36e5).toISOString()
}
/** ISO de "dentro de X días" (destacados y reservas futuras). */
function dentroDias(d) {
  return new Date(Date.now() + d * 864e5).toISOString()
}

/**
 * Construye el bloque `especificaciones` EXACTAMENTE con las claves que usan
 * el formulario de publicación y los filtros del catálogo
 * (src/lib/filtros-tecnicos.ts y src/lib/categorias.ts).
 */
function specs(s) {
  const out = {
    'Año de matriculación': String(s.anio),
    'Kilómetros': String(s.km),
    Combustible: s.combustible || 'Diésel',
    Transmisión: s.transmision || 'Manual',
    'Potencia (CV)': String(s.cv),
    Tracción: s.traccion || '4x2',
    'MMA / Peso máximo autorizado': s.mma,
    'Longitud exterior': s.longitud,
    'Altura exterior': s.altura,
    'Distintivo Ambiental DGT': s.dgt,
    Homologación: s.homologacion,
    'Plazas homologadas para viajar': s.plazasViaje,
    'Plazas para dormir': s.plazasDormir,
    'Calefacción estacionaria': s.calefaccion,
    'Agua caliente': s.aguaCaliente,
    'Baño / Ducha': s.bano,
    'Depósito agua limpia (litros)': String(s.deposito),
    'Batería auxiliar': s.bateria,
    'Placa solar': s.solar ? 'Sí' : 'No',
    'Inversor 220V': s.inversor ? 'Sí' : 'No',
    Nevera: s.nevera,
  }
  if (s.tamanoChasis) out['Tamaño chasis'] = s.tamanoChasis
  if (s.solar) out['Placa solar (watios)'] = String(s.solar)
  if (s.inversor) out['Inversor 220V (watios)'] = String(s.inversor)
  // Limpieza: fuera claves sin valor (como hace el formulario de /publicar).
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'undefined')
  )
}

// Alias cortos para las opciones oficiales (tienen que coincidir al carácter
// con src/lib/categorias.ts para que los filtros del catálogo funcionen).
const MMA_B = 'Hasta 3.500 kg (carnet B)'
const L_CORTA = 'Hasta 5,5 m'
const L_MEDIA = '5,5 - 6,5 m'
const L_LARGA = 'Más de 6,5 m'
const A_BAJA = 'Hasta 2,5 m'
const A_MEDIA = '2,5 - 3,0 m'
const DGT_C = 'C (Verde)'
const DGT_B = 'B (Amarillo)'
const VIVIENDA = 'Vehículo Vivienda (2448 / 3148)'
const MIXTO = 'Vehículo Mixto Adaptable (3100)'
const TURISMO = 'Turismo (1000)'
const CALEF_D = 'Sí - Diésel'
const CALEF_G = 'Sí - Gas'
const CALEF_NO = 'No tiene'
const BANO_INT = 'Ducha interior con agua caliente + WC fijo'
const BANO_EXT = 'Ducha exterior + poti portátil'
const BANO_CAB = 'Cabina de baño completa'
const BANO_NO = 'Sin baño'
const LITIO = 'Litio LiFePO4'
const NEVERA_COMP = 'Compresor 12V'
const NEVERA_TRI = 'Trivalente gas/12V/220V'
const NEVERA_PORT = 'Portátil'

// ── Vendedores de demostración (12 perfiles repartidos por España) ──────────
// El email siempre es @camperocasion.online para no suplantar a nadie real;
// se crean con email_confirm:true y no reciben ningún correo.
const VENDEDORES = [
  { slug: 'ana-martin', nombre: 'Ana Martín Soler', estado: 'Madrid', ciudad: 'Madrid', telefono: '+34 612 48 93 07', verificado: true },
  { slug: 'jose-luis-ortega', nombre: 'José Luis Ortega Ramos', estado: 'Madrid', ciudad: 'Madrid', telefono: '+34 654 09 31 76', verificado: false },
  { slug: 'carmen-ruiz', nombre: 'Carmen Ruiz Peña', estado: 'Comunitat Valenciana', ciudad: 'Alicante', telefono: '+34 687 25 14 90', verificado: true },
  { slug: 'iker-mendizabal', nombre: 'Iker Mendizabal Urrutia', estado: 'País Vasco', ciudad: 'Vizcaya', telefono: '+34 699 41 87 22', verificado: false },
  { slug: 'montse-vidal', nombre: 'Montse Vidal Ferrer', estado: 'Cataluña', ciudad: 'Girona', telefono: '+34 629 73 58 41', verificado: true },
  { slug: 'pablo-sanz', nombre: 'Pablo Sanz Velasco', estado: 'Aragón', ciudad: 'Zaragoza', telefono: '+34 645 19 62 80', verificado: false },
  { slug: 'lucia-herrero', nombre: 'Lucía Herrero Pazos', estado: 'Galicia', ciudad: 'A Coruña', telefono: '+34 671 38 24 95', verificado: false },
  { slug: 'andres-molina', nombre: 'Andrés Molina Guerrero', estado: 'Andalucía', ciudad: 'Sevilla', telefono: '+34 633 57 81 14', verificado: false },
  { slug: 'javi-fernandez', nombre: 'Javi Fernández Castro', estado: 'Andalucía', ciudad: 'Málaga', telefono: '+34 692 64 73 58', verificado: true },
  { slug: 'elena-pons', nombre: 'Elena Pons Roig', estado: 'Comunitat Valenciana', ciudad: 'Valencia', telefono: '+34 618 92 47 63', verificado: false },
  { slug: 'marc-girbau', nombre: 'Marc Girbau Font', estado: 'Cataluña', ciudad: 'Barcelona', telefono: '+34 660 31 85 29', verificado: true },
  { slug: 'rafa-quesada', nombre: 'Rafa Quesada Serrano', estado: 'Andalucía', ciudad: 'Granada', telefono: '+34 677 46 92 18', verificado: false },
  { slug: 'teresa-alarcon', nombre: 'Teresa Alarcón Domingo', estado: 'Castilla y León', ciudad: 'Valladolid', telefono: '+34 639 54 27 81', verificado: false },
  { slug: 'luis-crespi', nombre: 'Lluís Crespí Marquès', estado: 'Baleares', ciudad: 'Baleares', telefono: '+34 608 76 13 42', verificado: false },
]
const emailVendedor = v => `semilla+${v.slug}@camperocasion.online`

// ── Los 20 anuncios ─────────────────────────────────────────────────────────
// fotos: rutas relativas a scripts/semilla/fotos (la PRIMERA es la portada).
// creado: horas hacia atrás desde ahora mismo.
const ANUNCIOS = [
  // ──────────────────────── GRAN VOLUMEN ────────────────────────
  {
    vendedor: 'ana-martin',
    sub: 'Gran Volumen',
    marca: 'Fiat Ducato', modelo: 'L2H2 2.3 Multijet 140',
    titulo: 'Fiat Ducato L2H2 camperizada 2020 · 140 CV · Vivienda homologada',
    precio: 37500, estado: 'Bueno', creado: 26 * 24, visitas: 437,
    verificacion: 'verificada',
    fotos: ['gran-volumen/ducato-menta-1.jpg', 'gran-volumen/ducato-menta-2.jpg', 'gran-volumen/int-cama.jpg', 'gran-volumen/int-verde.jpg'],
    ficha: specs({
      anio: 2020, km: 74500, cv: 140, tamanoChasis: 'L2H2', mma: MMA_B,
      longitud: L_CORTA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '3', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_EXT, deposito: 100, bateria: LITIO,
      solar: 200, inversor: 2000, nevera: NEVERA_COMP,
    }),
    descripcion: `Vendo mi Fiat Ducato L2H2 de 2020 después de tres temporadas disfrutándola por toda la península. La campericé en 2021 con un profesional de Getafe y está homologada como vehículo vivienda (tarjeta ITV 2448), así que cero problemas en las ITV.

Mecánicamente está perfecta: 2.3 Multijet de 140 CV, 74.500 km reales (certificados con las facturas), distribución por cadena, cambio manual de 6 velocidades y consumo medio de 7,8 l. Mantenimiento al día en servicio oficial, el último (aceite, filtros y frenos nuevos) este mismo año. ITV pasada en marzo a la primera.

Equipamiento camper: cama transversal de 185x140 + cama infantil delantera, calefacción estacionaria diésel Autoterm, agua caliente, batería de litio de 100 Ah, placa solar de 200 W, inversor de 2.000 W, nevera compresor de 95 l, ducha exterior y poti. Depósito de 100 l de limpias y 80 de grises. Con esa configuración somos autónomos 3-4 días sin tocar camping.

Tiene alguna marca de uso lógica en la carrocería (se aprecia en las fotos, nada de chapa) pero el interior está impecable. Todos los papeles en regla, dos llaves y factura de la camperización. Se enseña sin compromiso en Madrid capital (zona de Carabanchel) y se puede probar con cita. Precio ligeramente negociable si la cosa se pone seria; no cambio por coche.`,
  },
  {
    vendedor: 'andres-molina',
    sub: 'Gran Volumen',
    marca: 'Citroën Jumper', modelo: 'L2H2 2.0 BlueHDi 130',
    titulo: 'Citroën Jumper L2H2 camper 2018 · ideal primera camper',
    precio: 26900, estado: 'Bueno', creado: 61 * 24 + 7, visitas: 612,
    fotos: ['gran-volumen/jumper-blanco-1.jpg', 'gran-volumen/int-madera.jpg', 'gran-volumen/bano-completo.jpg'],
    ficha: specs({
      anio: 2018, km: 118000, cv: 130, tamanoChasis: 'L2H2', mma: MMA_B,
      longitud: L_CORTA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '2', plazasDormir: '2', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_NO, deposito: 90, bateria: 'AGM',
      solar: 150, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Se vende Citroën Jumper L2H2 de 2018 con 118.000 km, camperizada como vehículo vivienda. Es la camper con la que empecé: perfecta para iniciarse en el mundo sin dejarse un dineral.

Motor 2.0 BlueHDi de 130 CV, caja manual, muy fiable y con consumos de 7-7,5 litros. Siempre en garaje desde que la tengo (2020). ITV en vigor hasta el año que viene. Le he hecho yo todos los mantenimientos: aceite cada 15.000 km, correa auxiliar nueva y neumáticos traseros con 5.000 km.

La camperización es sencilla pero funcional: cama doble lateral convertible en sofá, mueble de cocina en madera con fregadero y cocina de gas de dos fuegos, nevera trivalente, instalación eléctrica completa a 12 V con batería AGM de 95 Ah y placa solar de 150 W. Depósito de 90 l bajo chasis con llenado exterior. No tiene baño (yo usaba ducha exterior portátil) y no tiene calefacción: para mí nunca fue problema viajando por Andalucía, pero que lo sepas.

Entrego además el equipamiento completo: toldo F35, kit de nivelación, calzos, alargadera 220 V y oscurecedores térmicos de cabina hechos a medida. Se puede ver y probar en Sevilla (Cerro-Amate). Atiendo mejor por la tarde. Escucho ofertas razonables.`,
  },
  {
    vendedor: 'marc-girbau',
    sub: 'Gran Volumen',
    marca: 'Fiat Ducato', modelo: 'L3H2 2.2 Multijet 140',
    titulo: 'Fiat Ducato L3H2 2021 estilo off-road · litio · como nueva',
    precio: 44900, estado: 'Como nuevo', creado: 9 * 24 + 3, visitas: 784,
    boosteado: true,
    fotos: ['gran-volumen/ducato-offroad-1.jpg', 'gran-volumen/int-verde.jpg', 'gran-volumen/bano-ducha.jpg'],
    ficha: specs({
      anio: 2021, km: 52300, cv: 140, tamanoChasis: 'L3H2', mma: MMA_B,
      longitud: L_MEDIA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 110, bateria: LITIO,
      solar: 240, inversor: 2000, nevera: NEVERA_COMP,
    }),
    descripcion: `Por cambio a una autocaravana integral vendo esta Ducato L3H2 de septiembre de 2021 con solo 52.300 km. Es una unidad preparada con estética off-road (vinilo, llantas con neumáticos BF Goodrich All-Terrain, defensa y placa en el techo) pero sin locuras: se conduce como cualquier Ducato y entra en cualquier parking por debajo de los 2,60 m.

Interior distribuido en cuatro zonas: salón delantero con doble asiento giratorio y mesa extensible, cocina central con encimera de madera maciza, cama doble trasera de 190x150 y cabina de baño con ducha y WC Thetford. En el techo: claraboya Midi Heki y ventilador Maxxfan con termostato.

Autonomía seria para viajar sin campings: dos baterías de litio de 100 Ah (200 Ah en total) con shunt Victron, placa de 240 W, inversor de onda pura de 2.000 W, calefacción diésel y termo de agua caliente. Depósito de 110 l de limpias. Con el aire acondicionado de cabina y la calefacción hemos estado cómodos de -4 ºC a 38 ºC.

Matriculada y homologada como vehículo vivienda a mi nombre, distintivo C, ITV recién pasada (agosto) y un solo propietario. Se entrega con el juego completo de documentación de la camperización (proyecto técnico y certificado de taller). En Barcelona (Sants-Montjuïc). Precio firme: es una furgoneta que me ha costado 58.000 € entre todo.`,
  },
  {
    vendedor: 'elena-pons',
    sub: 'Gran Volumen',
    marca: 'Peugeot Boxer', modelo: 'L2H2 2.2 BlueHDi 140',
    titulo: 'Peugeot Boxer L2H2 2020 camper madera · 88.400 km',
    precio: 31900, estado: 'Bueno', creado: 33 * 24 + 11, visitas: 523,
    verificacion: 'verificada',
    fotos: ['gran-volumen/boxer-madera-1.jpg', 'gran-volumen/boxer-madera-2.jpg', 'gran-volumen/int-cama.jpg', 'gran-volumen/boxer-lifestyle-1.jpg'],
    ficha: specs({
      anio: 2020, km: 88400, cv: 140, tamanoChasis: 'L2H2', mma: MMA_B,
      longitud: L_CORTA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '3', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_EXT, deposito: 90, bateria: 'AGM',
      solar: 170, inversor: 1000, nevera: NEVERA_COMP,
    }),
    descripcion: `Hola! Vendo nuestra Boxer camperizada porque entre el trabajo y los niños ya no le damos el uso que merece. Es de abril de 2020, motor 2.2 BlueHDi de 140 CV con 88.400 km, y la camperización está hecha por nosotros con ayuda de un carpintero amigo: todo el mobiliario es de madera de pino macizo, no de conglomerado, y se nota en el acabado (en las fotos se ve bien).

Tiene lo esencial y bien hecho: cama fija trasera de 185x135 con garaje enorme debajo (caben dos bicis sin desmontar ruedas), zona de cocina con fregadero, cocina de dos fuegos, nevera compresor, mesa interior plegable, calefacción diésel y agua caliente por termo. Electricidad: dos baterías AGM de 95 Ah, placa solar de 170 W, inversor de 1.000 W y cargador de red cuando estás en camping. Luces LED regulables por zonas y tomas USB junto a la cama.

De mecánica, cero sustos: mantenimientos en Peugeot hasta los 80.000 km (tengo las facturas selladas) y el último este año con cambio de pastillas. Cuatro plazas homologadas para viajar (dos en banca trasera con cinturones) y tres para dormir contando la cama supletoria del salón.

La vendo con ropa de cama, menaje y hasta el café si hace falta 😄. Estamos en Valencia (Patraix), se puede ver casi cualquier día. Solo venta, no me interesan cambios.`,
  },
  {
    vendedor: 'pablo-sanz',
    sub: 'Gran Volumen',
    marca: 'Renault Master', modelo: 'L3H2 Energy dCi 145',
    titulo: 'Renault Master L3H2 2019 camperizada · Vivienda 2448',
    precio: 29500, estado: 'Bueno', creado: 47 * 24 + 5, visitas: 306,
    verificacion: 'verificada',
    fotos: ['gran-volumen/master-amarilla-1.jpg', 'gran-volumen/master-amarilla-2.jpg', 'gran-volumen/master-amarilla-3.jpg'],
    ficha: specs({
      anio: 2019, km: 96200, cv: 145, tamanoChasis: 'L3H2', mma: MMA_B,
      longitud: L_MEDIA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '2', plazasDormir: '2', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_EXT, deposito: 85, bateria: 'AGM',
      solar: 160, inversor: 1000, nevera: NEVERA_TRI,
    }),
    descripcion: `Renault Master L3H2 de 2019 con 96.200 km, homologada vehículo vivienda (consta en la ficha técnica). Es la amarilla de las fotos; vistosa donde la pongas.

Motor Energy dCi de 145 CV, el más fiable de la gama, con cadena de distribución (no hay que cambiar correa). Caja manual de 6 velocidades, control de crucero, aire acondicionado de cabina y sensor de aparcamiento trasero. Neumáticos Michelin CrossClimate cambiados a principios de año.

El interior (ver fotos) está en blanco con detalles: bancada con dosel de armarios en altillo, cama trasera desmontable con somier de láminas de 190x130, armario ropero, mueble de cocina con dos fuegos y fregadero redondo, nevera trivalente, mesa de pared abatible y todo el aislamiento en Kaiflex de 20 mm (nada de sudoración de chapa en invierno). Instalación eléctrica con batería AGM, placa de 160 W en el techo e inversor de 1.000 W con tomas 220 V.

No tiene calefacción ni agua caliente: así la compré y con un buen edredón y el calefactor portátil de gas (que incluyo) hemos dormido en Sierra Nevada en febrero sin pasar frío.

ITV al día, papeles de la homologación en regla, dos llaves. Se vende por compra de furgón más grande para la familia. Está en Zaragoza, barrio del Actur. Precio negociable algo, mejor verla y hablamos.`,
  },
  {
    vendedor: 'iker-mendizabal',
    sub: 'Gran Volumen',
    marca: 'Mercedes-Benz Sprinter', modelo: '316 CDI L3H2',
    titulo: 'Mercedes Sprinter 316 CDI camper 2020 · 163 CV · premium',
    precio: 46500, estado: 'Como nuevo', creado: 16 * 24 + 9, visitas: 598,
    fotos: ['gran-volumen/sprinter-negra-1.jpg', 'gran-volumen/int-madera.jpg', 'gran-volumen/bano-completo.jpg'],
    ficha: specs({
      anio: 2020, km: 79800, cv: 163, tamanoChasis: 'L3H2', mma: MMA_B,
      longitud: L_MEDIA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '3', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 100, bateria: LITIO,
      solar: 215, inversor: 2000, nevera: NEVERA_COMP,
    }),
    descripcion: `Vendo Sprinter 316 CDI de 2020, L3H2, con 79.800 km y camperización premium hecha en taller especializado de Donostia (factura de 14.200 € solo la transformación).

La furgo es la de las fotos: negra, llantas de aleación negras, techo elevable Reimo con cama superior, baca con placa solar flexible y toldo lateral. Por dentro, carpintería en madera clara: banca trasera convertible, cama abatible, mueble de cocina con tapa de cristal, armarios en altillo con iluminación y baño completo con ducha y retrete. Techo elevable con ventanas mosquitera, dormir arriba en verano es una pasada.

Mecánica Mercedes 163 CV con el consumo más bajo del segmento (8,2 l reales haciendo monte), cambio manual, suspensión reforzada, enganche de remolque homologado y portabicicletas Thule para 3 bicis incluido. Tracción trasera, va cargada estupendamente.

Autonomía: litio 100 Ah, placa 215 W, inversor 2.000 W, caldera Webasto de diésel con control desde el móvil, termo Elgena y nevera compresor. 100 l de aguas limpias. Todo con documentación y certificados.

La he usado para fines de semana y tres viajes a los Alpes, jamás para vivir a tiempo completo, por eso el estado. Pegas: dos roces pequeños en el paragolpes trasero (fotografiados). ITV hace un mes. En Bilbao (Deusto). No acepto cambios ni peculiaridades, solo venta a persona seria.`,
  },

  // ──────────────────── CAMPER MEDIANA / COMPACTA ────────────────────
  {
    vendedor: 'lucia-herrero',
    sub: 'Camper Mediana / Compacta',
    marca: 'Volkswagen California', modelo: 'Ocean T6.1 2.0 TDI 150 DSG',
    titulo: 'VW California Ocean T6.1 2021 · 150 CV DSG · libro VW',
    precio: 56900, estado: 'Como nuevo', creado: 6 * 24 + 2, visitas: 617,
    destacado: true,
    fotos: ['mediana/cali-ocean-1.jpg', 'mediana/int-techo.jpg', 'gran-volumen/int-cama.jpg'],
    ficha: specs({
      anio: 2021, km: 61000, cv: 150, transmision: 'Automática', mma: MMA_B,
      longitud: L_CORTA, altura: A_BAJA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_EXT, deposito: 30, bateria: 'AGM',
      solar: null, inversor: null, nevera: NEVERA_COMP,
    }),
    descripcion: `Volkswagen California Ocean T6.1 de junio de 2021 en venta. 150 CV con cambio automático DSG, 61.000 km y libro de mantenimiento completo en la red oficial Volkswagen (última revisión esta primavera en el concesionario de A Coruña).

Es la moto camper de siempre y no necesita presentación: techo elevable electrohidráulico, cama superior de 120x200, banca trasera convertible en cama doble, cocina completa con dos fuegos y fregadero, nevera de 42 l, armario, mesa interior escamoteable, dos sillas plegables de exterior escondidas en el portón, mesa de camping en la corredera y toldo. Calefacción estacionaria programable, claraboya delantera y tomas 230 V en cocina y cabina.

Unidad blanca candy, asientos Alcantara Dots, llantas 17", faros LED, control de crucero ACC, sensores delanteros y traseros con cámara, portón eléctrico y climatizador Climatronic. Todas las alfombrillas originales y los dos juegos de llaves.

Está impecable, siempre en garaje, nunca ha dormido fuera a la intemperie más de dos noches seguidas. Hace la ITV en 2027. La vendemos porque hemos comprado una Grand California para viajar con el perro grande.

Puedo enviar vídeo completo por el chat. Se ve en A Coruña ciudad (zona Elviña). El precio ya es muy ajustado para el mercado, pero algo se puede hablar. Solo venta a particulares, gracias.`,
  },
  {
    vendedor: 'montse-vidal',
    sub: 'Camper Mediana / Compacta',
    marca: 'Volkswagen California', modelo: 'T6 2.0 TDI 102 (Mercus)',
    titulo: 'VW T6 California 2019 Mercus · compresión total 4 plazas',
    precio: 41500, estado: 'Bueno', creado: 18 * 24 + 6, visitas: 404,
    fotos: ['mediana/cali-mercus-1.jpg', 'mediana/cali-mercus-2.jpg', 'mediana/cali-mercus-3.jpg', 'mediana/cali-mercus-4.jpg'],
    ficha: specs({
      anio: 2019, km: 84300, cv: 102, mma: MMA_B,
      longitud: L_CORTA, altura: A_BAJA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_NO, deposito: 25, bateria: 'AGM',
      solar: null, inversor: null, nevera: NEVERA_COMP,
    }),
    descripcion: `Camper sobre Volkswagen T6 de 2019, conversión California del taller Mercus. 2.0 TDI de 102 CV con 84.300 km, mecánica revisada y con todas las facturas. Es del color blanco de las fotos, con franja antracita y techo elevable con cama.

Distribución California clásica: asiento delantero copiloto giratorio, banca posterior abatible en cama de 195x115, armario con cocina de dos fuegos y fregadero integrados en el lateral, nevera de compresor de 40 l y numerosos cajones. El techo elevable da altura interior de pie y esconde la segunda cama para dos personas. Cuatro plazas para viajar y cuatro para dormir: la solución perfecta para una pareja con niños.

La vendo cargada de extras: portabicicletas de portón para 3 bicis, oscurecedores térmicos integrales, batería auxiliar con relé separador, toma 220 V exterior, mesa de camping y dos taburetes. ITV pasada este año a la primera. Dos propietarios, siempre mantenida en taller VW.

Muy cuidada de chapa y pintura, siempre en parking subterráneo. Por kilómetros y estado no encontrarás otra a este precio este trimestre: me urge un poco vender porque ya me han entregado la Multivan nueva.

Vehículo visible en Girona (zona Fontajau). Puedo moverme por la provincia para enseñarla si hay interés serio. Escucho ofertas, mejor en persona viendo la furgo.`,
  },
  {
    vendedor: 'carmen-ruiz',
    sub: 'Camper Mediana / Compacta',
    marca: 'Ford Transit Custom', modelo: 'Nugget Plus 2.0 EcoBlue 130',
    titulo: 'Ford Transit Custom Nugget Plus 2020 · techo elevable',
    precio: 43900, estado: 'Bueno', creado: 12 * 24 + 8, visitas: 359,
    fotos: ['mediana/nugget-1.jpg', 'mediana/nugget-2.jpg', 'mediana/nugget-3.jpg'],
    ficha: specs({
      anio: 2020, km: 70500, cv: 130, tamanoChasis: 'L2H2', mma: MMA_B,
      longitud: L_CORTA, altura: A_BAJA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_D,
      aguaCaliente: 'Sí', bano: BANO_NO, deposito: 40, bateria: 'AGM',
      solar: null, inversor: 1500, nevera: NEVERA_COMP,
    }),
    descripcion: `Vendo Ford Nugget Plus (la versión batalla larga del Transit Custom) de 2020 con 70.500 km. Conversión oficial Westfalia, no una camperización casera: materiales, encajados y seguridad de serie de fábrica alemana.

Motor 2.0 EcoBlue de 130 CV, caja manual, 7,1 l/100 km de media. Configuración de 4 plazas para viajar (asientos traseros con rieles, se desplazan según necesites) y 4 para dormir: cama en el techo elevable de 2,10x1,30 y banqueta abatible en doble cama abajo. Cocina en L a popa con dos fuegos, fregadero, nevera compresor grande y cajón despensa; mesa de interior plegable y otra de exterior con las sillas Westfalia originales. Agua: 40 l limpias y grises respectivamente, con toma exterior. Calefacción estacionaria y termo.

Extras de esta unidad: toldo Thule 3,25 m, portabicicletas de portón, inversor de 1.500 W, oscurecedores en todas las lunas, elevalunas eléctricos, pantalla con CarPlay y cámara trasera. Color gris magnético de las fotos.

Estado muy bueno general; tiene un bollo en el lateral izquierdo por un parking estrecho (sale en la última foto, pintura intacta, fácil de reparar). Libro de mantenimiento Ford al día e ITV en vigor. La vendo solo por pasar a propiedad y no poder quedármela de segunda residencia.

La enseño en Alicante (zona de San Juan). Atiendo el chat por las tardes. Precio cerrado al interesado serio.`,
  },

  // ────────────────────────── MINICAMPER ──────────────────────────
  {
    vendedor: 'javi-fernandez',
    sub: 'Minicamper',
    marca: 'Volkswagen Caddy', modelo: 'Maxi 2.0 TDI 102',
    titulo: 'VW Caddy Maxi camper 2019 · camperización a estrenar',
    precio: 18900, estado: 'Bueno', creado: 55 * 24 + 4, visitas: 731,
    reservado: true,
    fotos: ['mini/caddy-maxi-1.jpg', 'mini/caddy-maxi-2.jpg', 'mini/caddy-maxi-3.jpg'],
    ficha: specs({
      anio: 2019, km: 92000, cv: 102, tamanoChasis: 'L2', mma: MMA_B,
      longitud: L_CORTA, altura: A_BAJA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '2', plazasDormir: '2', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_NO, deposito: 30, bateria: 'AGM',
      solar: null, inversor: null, nevera: NEVERA_PORT,
    }),
    descripcion: `RESERVADA provisionalmente hasta el viernes; si falla, sigo por orden de contacto.

Volkswagen Caddy Maxi de 2019, 2.0 TDI 102 CV, 92.000 km. La compré hace dos años con 60.000 y la he camperizado este verano con mueble nuevo hecho a medida por carpintero de Alhaurín: bancada-cama de 190x110 con colchón de espuma de 10 cm (nuevo, con fundas lavables), cocina deslizante trasera con fuego portátil y fregadero plegable, arcon nevera de 24 l que funciona a 12 y 220 V, y cajonera completa bajo la cama.

Es la furgo blanca de las fotos con la cocina trasera sacada (así se cocina a la sombra del portón, lo mejor en verano). Le he puesto también: claraboya de ventilación sobre la cama, iluminación interior LED, cortinas en las cinco ventanas y batería auxiliar de 75 Ah con cargador automático.

Mecánica al día: distribución por correa cambiada a los 85.000 km con bomba de agua (factura de 780 €), ITV pasada en primavera, cuatro neumáticos con 8.000 km y frenos nuevos delante. Aire acondicionado frío perfecto.

Ideal como primera camper: entra en cualquier parking (1,80 m de alto), gasta 6 litros y duermes donde quieras sin llamar la atención. La vendo porque me paso a una Crosscamp para viajar en invierno con calefacción.

La enseño en Málaga (Teatinos). Regalo caja portable de gas y más recambios que tengo. Escucho ofertas pero sin locuras que ya está apretada de precio.`,
  },
  {
    vendedor: 'ana-martin',
    sub: 'Minicamper',
    marca: 'Volkswagen Caddy', modelo: '2.0 TDI 102 Camperbox',
    titulo: 'VW Caddy 2021 con módulo camper extraíble · 45.000 km',
    precio: 22500, estado: 'Como nuevo', creado: 21 * 24 + 10, visitas: 288,
    fotos: ['mini/caddy-negra-1.jpg', 'mini/caddy-negra-2.jpg', 'mini/caddy-negra-3.jpg', 'mini/caddy-negra-4.jpg'],
    ficha: specs({
      anio: 2021, km: 45000, cv: 102, tamanoChasis: 'L2', mma: MMA_B,
      longitud: L_CORTA, altura: A_BAJA, dgt: DGT_C, homologacion: TURISMO,
      plazasViaje: '2', plazasDormir: '2', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_NO, deposito: 20, bateria: 'Sin batería auxiliar',
      solar: null, inversor: null, nevera: NEVERA_PORT,
    }),
    descripcion: `Vendo esta Caddy de febrero de 2021 con solo 45.000 km equipada con un módulo camper extraíble de fabricación alemana (Camperbox), el negro de las fotos. Es la solución más práctica que existe: durante la semana es un turismo normal con el maletero libre, y el fin de semana montas la cama en 5 minutos sin herramientas.

El módulo incluye: estructura de cama plegable de 187x105 con colchón de tres piezas, mesa central regulable en altura, fresquera-compresor de 20 l integrada con apertura trasera, organizadores textiles en las puertas y cubiertas de ventanas a medida. Limpio y como nuevo (se ha usado 11 noches).

La Caddy en sí: motor 2.0 TDI de 102 CV (el más equilibrado de la gama), cambio manual, climatizador, pantalla Composition Color con App-Connect, sensores traseros, control de velocidad, faros antiniebla y portón trasero con luneta. Distintivo C. ITV hasta 2027. Único propietario, factura de compra y todo el mantenimiento oficial.

Matriculada como turismo (la cama va como carga), con lo que pagas menos seguro y pasas ITV de turismo. Si quieres camper de diario sin el sobrepeso de una camperización fija, esta es tu furgoneta.

Se ve y se prueba en Madrid (Vallecas). Se entrega con el módulo por supuesto montado y enseñado. También vendo la furgo sin el módulo por 1.500 € menos si a alguien le interesa, aunque preferiría venderlo junto.`,
  },

  // ─────────────────── AUTOCARAVANA PERFILADA ───────────────────
  {
    vendedor: 'teresa-alarcon',
    sub: 'Autocaravana Perfilada',
    marca: 'Fiat Ducato Autocaravana', modelo: 'Benimar Tessoro 440',
    titulo: 'Benimar Tessoro 440 (2021) · 38.600 km · como nueva',
    precio: 51900, estado: 'Como nuevo', creado: 4 * 24 + 1, visitas: 1218,
    destacado: true,
    verificacion: 'verificada',
    fotos: ['perfilada/tessoro-440-1.jpg', 'perfilada/tessoro-440-2.jpg', 'perfilada/tessoro-440-3.jpg', 'perfilada/tessoro-440-4.jpg'],
    ficha: specs({
      anio: 2021, km: 38600, cv: 140, mma: MMA_B,
      longitud: L_MEDIA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 120, bateria: 'AGM',
      solar: 100, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Autocaravana perfilada Benimar Tessoro 440 del año 2021 sobre Fiat Ducato 2.3 de 140 CV, con solo 38.600 km. Revisiones en la red oficial Fiat con libro sellado e ITV recién pasada.

Distintiva distribución del 440: cama transversal trasera sobre garaje amplio, salón delantero con doble mesa extractible y asientos piloto giratorios de cuero sintético, cocina central con tres fuegos y campana, y baño completo con cabina de ducha separada. Cuatro plazas para viajar y cuatro para dormir (la cama del salón es basculante eléctrica, baja sin deshacer la mesa).

Equipamiento de esta unidad: calefacción Truma de gas, termo Mixta, claraboya panorámica delantera, aire acondicionado de cabina, portón eléctrico de garaje, toldo de 4 m, soporte para TV y TV de 22" que no he usado casi, mosquitera en puerta, portaesquíes y scala posterior. Placa solar de 100 W con regulador y batería de célula AGM de 95 Ah renovada el año pasado. Depósitos: 120 l limpias, 100 l grises. Gas con sistema DuoControl para dos bombonas.

Estado realmente de exposición: se ha usado para escapadas de fin de semana y el puente de diciembre, jamás alquilada ni vivida dentro. Cabina con volante multifunción, control de crucero y pantalla Pioneer nueva con cámara trasera.

La vendo por motivos de salud (ya no puedo conducir). Es una pena porque está en su mejor momento. Señores serios y con intención real, por favor. Está en Valladolid, bien guardada y a punto para salir de viaje mañana mismo.`,
  },
  {
    vendedor: 'luis-crespi',
    sub: 'Autocaravana Perfilada',
    marca: 'Ford Transit Autocaravana', modelo: 'Benimar Tessoro 495 UP',
    titulo: 'Benimar Tessoro 495 UP 2022 · Ford 170 CV automática',
    precio: 58500, estado: 'Como nuevo', creado: 15 * 24 + 12, visitas: 413,
    fotos: ['perfilada/tessoro-ford-1.jpg', 'perfilada/int-ac-salon.jpg', 'perfilada/int-ac-dinette.jpg'],
    ficha: specs({
      anio: 2022, km: 24900, cv: 170, transmision: 'Automática', mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 130, bateria: LITIO,
      solar: 200, inversor: 1500, nevera: NEVERA_TRI,
    }),
    descripcion: `Perfilada Benimar Tessoro 495 UP del año 2022 sobre la nueva base Ford Transit: motor 2.0 EcoBlue de 170 CV con cambio automático que es una gozada en puerto y en autopista. 24.900 km, un solo propietario, matriculada en Mallorca.

La 495 es la "tumbonas" de la gama: zona trasera con camas gemelas convertibles en cama gigante, debajo un garaje con acceso a ambos lados, salón L delante con la mesa abatible y cocina central con campana extractora. Baño completo con ducha aislada. Cama basculante eléctrica en salón para cuando viajan los nietos.

Esta unidad va muy equipada porque la encargué así: litio de 100 Ah, placa de 200 W, inversor de 1.500 W, aire acondicionado de cabina y de célula (Dometic FreshJet), agua caliente Alde en algunas versiones, la mía con caldera Truma Combi de gas, claraboya de garaje, alfombrilla de cabina y toldo eléctrico. Interior tapizado gris topo, cortinas plisset en todas las ventanas y mosquiteras. También portabicicletas de dos raíles y cámara trasera.

Con el Oasis, la piscina y la playa a veinte minutos la he usado menos de lo pensado; por eso la vendo. Está en Palma de Mallorca, podría entregarse en Barcelona o Valencia añadiendo el ferry si el comprador es de la península (lo hablo sin problema).

Precio de traspaso de un chollo frente a los 72.000 € que cuesta nueva como esta. No dudes en preguntar cualquier detalle por el chat.`,
  },

  // ─────────────────── AUTOCARAVANA CAPUCHINA ───────────────────
  {
    vendedor: 'carmen-ruiz',
    sub: 'Autocaravana Capuchina',
    marca: 'Fiat Ducato Capuchina', modelo: 'Benimar Sport 323',
    titulo: 'Benimar Sport 323 capuchina 2018 · 6 plazas · ideal familia',
    precio: 39900, estado: 'Bueno', creado: 28 * 24 + 6, visitas: 381,
    fotos: ['capuchina/benimar-323-1.jpg', 'capuchina/benimar-323-2.jpg', 'capuchina/cap-int-a.jpg', 'capuchina/kronos-int-2.jpg'],
    ficha: specs({
      anio: 2018, km: 67800, cv: 130, mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '6', plazasDormir: '5+', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 120, bateria: 'AGM',
      solar: 120, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Capuchina Benimar Sport 323 de 2018 sobre Fiat Ducato 2.3 Multijet de 130 CV. 67.800 km. La autocaravana familiar por excelencia: 6 plazas para viajar con cinturón y 6 para dormir (litera capuchina gigante de 2x1,40, literas traseras y cama del salón), así que cabemos todos sin tener que elegir quién se queda.

Está muy cuidada y es de color blanco-clásico como en las fotos. Interior impecable: tapizados sin manchas ni desgastes, cocina de tres fuegos con campana, nevera trivalente grande con congelador, baño completo con ducha, calefacción por gas en toda la célula y termo. El agua caliente llega al baño y a la cocina.

Extras: placa solar de 120 W, batería auxiliar nueva, portabicicletas de tres raíles (nosotros llevábamos 4 bicis), toldo grande con luces, reversa con cámara, mosquitera de puerta, oscurecedores plisset en cabina y claraboya en el capuchón (dormir viendo estrellas). Depósitos: 120 l limpias y 100 l grises.

Mecánica sin un solo fallo en 7 años: mantenimiento en Fiat cada 20.000 km (facturas), embrague original, ITV pasada este mes sin problemas. Neumáticos con más del 60%.

El motivo de la venta es que los hijos ya no quieren venir y nos hemos comprado una perfilada más pequeña. Si es tu primera capuchina te enseño todo el manejo el día de la entrega.

Está en Alicante, la enseño cuando quieras. Y puedo quedarme el portabicicletas y bajar algo el precio si no lo necesitas.`,
  },
  {
    vendedor: 'andres-molina',
    sub: 'Autocaravana Capuchina',
    marca: 'Ford Transit Capuchina', modelo: 'Benimar Sport 363',
    titulo: 'Benimar Sport 363 capuchina 2017 sobre Ford · 155 CV',
    precio: 36500, estado: 'Bueno', creado: 40 * 24 + 9, visitas: 303,
    fotos: ['capuchina/benimar-363-1.jpg', 'capuchina/cap-int-b.jpg', 'capuchina/kronos-int-3.jpg'],
    ficha: specs({
      anio: 2017, km: 84100, cv: 155, mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '6', plazasDormir: '5+', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 110, bateria: 'Gel',
      solar: 100, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Se vende capuchina Benimar Sport 363 del 2017 montada sobre Ford Transit 2.2 TDCi de 155 CV (el motor fuerte, sube los puertos cargada sin despeinarse). 84.100 km.

Somos el segundo propietario y la tenemos desde 2019. Distribución muy aprovechada para 6 viajeros: capuchón con cama de matrimonio y claraboya, litera trasera para dos, y el salón convertible. Cocina con tres fuegos, fregadero inox, campana y nevera trivalente. Baño completo con ducha propia. La calefacción de gas calienta el conjunto en minutos (probada fin de año en Ronda a 2 grados, dentro en manga corta).

En estos años se le ha hecho: batería de gel de la célula nueva (2023), placa de 100 W para mantenerla, 4 amortiguadores, kit de embrague (a los 79.000 km, por mantenimiento preventivo, factura disponible), ITV siempre pasada y única reparación destacable el termostato en 2022.

Exteriormente correcta con algún arañazo de ramas de los de siempre en los laterales (son de gel coat, fáciles de pulir si te preocupa). Toldo, portabicicletas de 4, mosquitera, oscurecedores de cabina, niveladores y cuña de gas incluidos.

Vendo porque he heredado una autocaravana integral y no puedo quedarme con dos. Un capricho familiar listo para este verano, a un precio muy razonable para lo que cuestan las nuevas.

En Sevilla (Dos Hermanas). Solo atiendo por chat de la plataforma; si encajamos, quedamos y la ves.`,
  },
  {
    vendedor: 'pablo-sanz',
    sub: 'Autocaravana Capuchina',
    marca: 'Fiat Ducato Capuchina', modelo: 'Roller Team Kronos 284 M',
    titulo: 'Roller Team Kronos 284 M (2020) · 6 plazas · libros al día',
    precio: 46900, estado: 'Como nuevo', creado: 8 * 24 + 4, visitas: 847,
    boosteado: true, verificacion: 'verificada',
    fotos: ['capuchina/kronos-ext-1.jpg', 'capuchina/kronos-int-1.jpg', 'capuchina/kronos-int-2.jpg', 'capuchina/kronos-int-3.jpg'],
    ficha: specs({
      anio: 2020, km: 55200, cv: 140, mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '6', plazasDormir: '5+', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 120, bateria: 'AGM',
      solar: 150, inversor: 1500, nevera: NEVERA_TRI,
    }),
    descripcion: `Roller Team Kronos 284 M del año 2020 sobre Fiat Ducato 2.3 Multijet de 140 CV con 55.200 km certificados. La compramos nueva en 2020 y somos los únicos propietarios; desde el primer día ha dormido bajo cubierta.

Distribución 284: litera capuchina delantera, camas traseras en litera más el salón transformable — en total 6 plazas de viaje y 6 para dormir. La cocina está enfrente del salón con dosel de armarios XL, cocina de tres fuegos, campana, horno grill (raro en este segmento) y nevera trivalente de 140 l con congelador independiente. Baño completo con ducha separada por mampara.

Todo el mantenimiento en taller oficial de la marca con las facturas y los sellos del libro; cambios de aceite cada 20.000 km y la correa de accesorios nueva el año pasado. Los dos juegos de llaves y los manuales originales.

Equipamiento: Truma de gas con rejillas por toda la célula, termo Mixta, placa solar de 150 W, inversor de 1.500 W, aire acondicionado de cabina, toldo exterior, cámara trasera, mosquitera, oscurecedores plisset, portabicicletas (4 bicis), claraboya Midi Heki salón y claraboya en el capuchón. Incluyo en el precio el kit de camping completo (mesa, 4 sillas, cuña y todo el menaje, a estrenar).

La vendemos con mucha pena (motivos familiares, ya la conocéis si sois del grupo). Está en Zaragoza capital. Los fines de semana puedo enseñarla. NO acepto cambios. Precio algo negociable.`,
  },

  // ─────────────────── AUTOCARAVANA INTEGRAL ───────────────────
  {
    vendedor: 'jose-luis-ortega',
    sub: 'Autocaravana Integral',
    marca: 'Hymer', modelo: 'B 544',
    titulo: 'Hymer B 544 integral 2009 · 2.3 130 CV · clásica cuidada',
    precio: 42900, estado: 'Usado', creado: 36 * 24 + 7, visitas: 447,
    fotos: ['integral/hymer-ext.jpg', 'integral/hymer-b544-1.jpg', 'integral/hymer-b544-2.jpg'],
    ficha: specs({
      anio: 2009, km: 134000, cv: 130, mma: MMA_B,
      longitud: L_MEDIA, altura: A_MEDIA, dgt: DGT_B, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '3', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 100, bateria: 'AGM',
      solar: null, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Vendo mi Hymer B 544 integral de 2009 sobre Fiat Ducato 2.3 JTD de 130 CV y 134.000 km. Ya sé que tiene años, pero las Hymer de esta época están construidas como tanques y esta está mecánicamente perfecta y mimada desde nueva por un solo propietario antes que yo.

La integral da esa sensación de salón enorme que ninguna perfilada da: parabrisas panorámico, asientos piloto giratorios de serie, mesa plegable de madera y, sobre ella, la cama basculante que baja del techo sin tocar nada. Tapicería original Hymer en excelente estado, sin quemaduras ni mascotas nunca. Muebles en tono cerezo, techo con altillos en todos los lados, cocina de tres fuegos con horno, nevera trivalente funcionando a la perfección a gas, 12 V y 220 V. Baño con ducha separada y WC. Cama francesa trasera traslarera.

En los últimos 2 años (tengo facturas de todo): embrague nuevo, batería de motor y la de célula, revisión de frenos completa, fuelles, agua y termosellos de claraboyas, y el mantenimiento anual de estanqueidad sellada correspondiente (todo en taller Hymer de Majadahonda). ITV válida.

Cosas a mejorar siendo honesto: distintivo B (los centros de las grandes ciudades tienen restricciones), no tiene placa solar y el toldo tiene un pequeño descosido en un borde. Lo demás, todo funciona.

La vendo porque a mis 68 años me paso a una furgo más manejable. Está en Madrid (Aluche). Persona mayor seria y ordenada: me gustan las cosas claras. Precio prácticamente firme.`,
  },
  {
    vendedor: 'lucia-herrero',
    sub: 'Autocaravana Integral',
    marca: 'Hymer', modelo: 'Eriba Jet 686 R',
    titulo: 'Hymer Eriba Jet 686 R integral 2020 · 160 CV',
    precio: 62500, estado: 'Como nuevo', creado: 11 * 24 + 5, visitas: 514,
    fotos: ['integral/eriba-1.jpg', 'integral/eriba-2.jpg', 'perfilada/int-ac-dinette.jpg'],
    ficha: specs({
      anio: 2020, km: 43700, cv: 160, mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 110, bateria: LITIO,
      solar: 120, inversor: null, nevera: NEVERA_TRI,
    }),
    descripcion: `Hymer Eriba Jet 686 R del año 2020 sobre Fiat Ducato 2.3 de 160 CV, 43.700 km, un solo dueño. Integral de gama alta con ese frontal tan característico y una luminosidad que no tienen las demás.

El salón, con el techo panorámico Skyroof, es impresionante: claraboya integral sobre la cabina, asientos giratorios con reposacabezas, banco lateral y mesa plegable. Cama basculante sobre el salón para dos, y detrás camas gemelas convertibles en una cama de 2 metros. Cocina completa con tres fuegos, campana, horno y la nevera SlimTower de 140 l con congelador. Baño con ducha independiente.

Equipamiento destacado: calefacción Alde de gas (la mejor, con suelo radiante en el baño), placa solar de 120 W, batería de litio, portabicicletas, toldo, cámara de visión trasera, pantalla Alpine con navegador, mosquitera, oscurecedores plisset y alfombrilla de cabina extraible — la no tengo puesta para el viaje, que se lava en casa.

ITV al día, mantenimiento hecho en Fiat y documentado. Por supuesto revisión de estanqueidad anual con informe favorable (la última en febrero). Sin golpes de ningún tipo.

Escribirme solo si realmente os encaja el presupuesto; un Jet así nuevo pasa hoy de 90.000 € de tarifa. La veis en A Coruña. Entrego con todos los accesorios de camping.`,
  },
  {
    vendedor: 'marc-girbau',
    sub: 'Autocaravana Integral',
    marca: 'Laika', modelo: 'Ecovip 709',
    titulo: 'Laika Ecovip 709 integral 2019 · 140 CV · pocos km',
    precio: 59900, estado: 'Bueno', creado: 19 * 24 + 13, visitas: 636,
    verificacion: 'verificada',
    fotos: ['integral/laika-1.jpg', 'perfilada/int-ac-salon.jpg', 'perfilada/int-ac-dinette.jpg'],
    ficha: specs({
      anio: 2019, km: 57900, cv: 140, mma: MMA_B,
      longitud: L_LARGA, altura: A_MEDIA, dgt: DGT_C, homologacion: VIVIENDA,
      plazasViaje: '4', plazasDormir: '4', calefaccion: CALEF_G,
      aguaCaliente: 'Sí', bano: BANO_CAB, deposito: 120, bateria: 'AGM',
      solar: 140, inversor: 1500, nevera: NEVERA_TRI,
    }),
    descripcion: `Laika Ecovip 709 de 2019, la integral con la cama basculante sobre la cabina que tantos buscáis, con 57.900 km. Fiat Ducato 2.3 de 140 CV, mecánica siempre mantenida en servicio oficial (Tarragona), con el libro de revisiones completo y ITV vigente.

La Ecovip destaca por la finura italiana: interior claro y tapizado suave al tacto, salón UL delante con asientos giratorios y mesa que no estorba, cocina central a ambos lados con campana y grill, y detrás las camas gemelas sobre garaje que se unen en cama de matrimonio de 2,05 m si viajas en pareja. Baño con ducha separada. Cuatro plazas para viajar y cuatro para dormir.

Equipamiento: calefacción por gas en toda la autocaravana, termo Mixta, placas de 140 W en total, inversor de 1.500 W, toldo de 5 m, antena de TV automática, mosquitera, oscurecedores de cabina Remis, escalon eléctrico y portabicicletas de tres raíles. Oro plata en cabina (cuero). Además cuatro tomas USB repartidas y dos tomas 220 V extra que añadí en el garaje para la bici eléctrica.

Está en estado muy bueno, sin ningún flojera en la estructura: revisión de estanqueidad sellada anualmente en taller Laika (informes guardados). Nunca ha vivido nadie dentro ni se ha alquilado.

Puedo mostrarla en Barcelona provincia (está guardada en Cornellà). Venta por motivos profesionales. Es mi segunda autocaravana y sé lo que se pregunta al comprar: preguntadme sin problema.`,
  },

  // ─────────────────── CÉLULA Y 4x4 OVERLAND ───────────────────
  {
    vendedor: 'rafa-quesada',
    sub: 'Célula y 4x4 Overland',
    marca: 'Toyota Hilux Overland', modelo: '2.4 D-4D + célula desmontable',
    titulo: 'Toyota Hilux 4x4 (2016) + célula vivienda desmontable',
    precio: 34500, estado: 'Bueno', creado: 7 * 24 + 6, visitas: 982,
    destacado: true,
    fotos: ['overland/hilux-1.jpg', 'overland/hilux-2.jpg', 'overland/hilux-3.jpg', 'overland/hilux-4.jpg'],
    ficha: specs({
      anio: 2016, km: 148000, cv: 150, traccion: '4x4', mma: MMA_B,
      longitud: L_CORTA, altura: A_MEDIA, dgt: DGT_C, homologacion: MIXTO,
      plazasViaje: '5', plazasDormir: '4', calefaccion: CALEF_NO,
      aguaCaliente: 'No', bano: BANO_NO, deposito: 60, bateria: 'AGM',
      solar: 150, inversor: 1000, nevera: NEVERA_COMP,
    }),
    descripcion: `Vendo el conjunto completo: Toyota Hilux doble cabina 2.4 D-4D de 2016 con 148.000 km, 4x4 de verdad con reductora y bloqueo trasero, más la célula vivienda desmontable hecha a medida (estructura autoportante con patas desmontables, se separa de la pick-up en 15 minutos).

La Hilux está preparada para pista: suspensión OME +5 cm, neumáticos BFGoodrich KO2 con 10.000 km, snorkel, defensa delantera con faros auxiliares LED, placas de protección de bajos y cubrecarter completo. Todo homologado en ficha técnica.

La célula (la de las fotos, con toldo lateral y escalera de acceso): cama sobre la cabina de 2x1,40 más sofá convertible para dos niños, mueble de cocina con fuego, fregadero y arcon compresor de 40 l, mesa interior, claraboya y tres ventanas con mosquitera. Electricidad independiente: batería AGM de 100 Ah, placa solar de 150 W e inversor de 1.000 W. Depósito de 60 l de limpias. Cuando se retira la célula, la pickup queda 100% disponible para el trabajo.

Mecánicamente impecable: es la Hilux indestructible de siempre, mantenimiento escrupuloso en Toyota Granada con todas las facturas, embrague y discos nuevos en 2024. ITV en vigor. No es nada inusual que estas Hílix lleguen a los 400.000 km.

Conjunto listo para África o para perderse por España sin tocar un camping. Lo separo solo si hay compradores para ambas cosas: Hilux sola 27.000 €, célula 8.500 €.

Está en Granada (Albolote). Yo mismo os enseño cómo se monta y desmonta la célula. No envío, venta en mano.`,
  },
]

// ── Lógica principal ────────────────────────────────────────────────────────

async function resolverCategoriaCamper() {
  const { data } = await supabase
    .from('categorias')
    .select('id')
    .eq('nombre', CATEGORIA)
    .maybeSingle()
  if (data?.id) return data.id

  const { data: creada, error } = await supabase
    .from('categorias')
    .insert({ nombre: CATEGORIA })
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`No se pudo crear la categoría "${CATEGORIA}": ${error.message}`)
  return creada.id
}

/** Busca un usuario por email (admin API, paginando). Devuelve null si no existe. */
async function buscarUsuarioPorEmail(email) {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers p.${page}: ${error.message}`)
    const hit = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (!data?.users?.length || data.users.length < 200) return null
    page++
  }
}

/**
 * Crea (o reutiliza) los usuarios vendedores y deja sus perfiles completos,
 * igual que un usuario registrado que rellenó su perfil.
 */
async function asegurarVendedores() {
  const ids = {}
  let creados = 0, reutilizados = 0

  for (const v of VENDEDORES) {
    const email = emailVendedor(v)
    let usuario = await buscarUsuarioPorEmail(email)

    if (!usuario) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        // Contraseña estable y suficientemente fuerte; son cuentas de demo.
        password: `Semilla#${v.slug}#camper2026`,
        email_confirm: true,
        user_metadata: { nombre: v.nombre, semilla: true },
      })
      if (error) throw new Error(`createUser ${email}: ${error.message}`)
      usuario = data.user
      creados++
    } else {
      reutilizados++
    }

    ids[v.slug] = usuario.id

    // Perfil público completo (la app crea la fila al registrarse; aquí la
    // dejamos directamente rellena, como un vendedor que ya editó su perfil).
    const { error: pErr } = await supabase.from('perfiles').upsert(
      {
        id: usuario.id,
        nombre: v.nombre,
        telefono: v.telefono,
        estado: v.estado,
        ciudad: v.ciudad,
        whatsapp_disponible: true,
        telefono_visible: true,
        email_visible: false,
        verificado: v.verificado,
        ...(v.verificado ? { verificado_desde: haceHoras(24 * 200) } : {}),
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`perfil ${v.nombre}: ${pErr.message}`)
  }

  console.log(`👥 Vendedores: ${creados} creados, ${reutilizados} reutilizados (${VENDEDORES.length} en total)`)
  return ids
}

/** Sube una foto al bucket y devuelve su URL pública (upsert → idempotente). */
const urlCache = new Map()
async function subirFoto(sellerId, rutaRel) {
  const key = `${sellerId}/semilla/${rutaRel.replace(/\//g, '-')}`
  if (urlCache.has(key)) return urlCache.get(key)

  const rutaAbs = path.join(FOTOS_DIR, rutaRel)
  const buffer = fs.readFileSync(rutaAbs)
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Storage ${key}: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  urlCache.set(key, data.publicUrl)
  return data.publicUrl
}

/** Borra todos los anuncios de los vendedores de la semilla (--reset). */
async function resetear(ids) {
  const idList = Object.values(ids)
  const { data: existentes, error: e1 } = await supabase
    .from('productos')
    .select('id')
    .in('user_id', idList)
  if (e1) throw new Error(`reset select: ${e1.message}`)
  if (!existentes?.length) {
    console.log('🧹 --reset: no había anuncios sembrados.\n')
    return
  }
  const { error } = await supabase.from('productos').delete().in('user_id', idList)
  if (error) throw new Error(`reset delete: ${error.message}`)
  console.log(`🧹 --reset: ${existentes.length} anuncios sembrados borrados.\n`)
}

async function main() {
  console.log('🚐 SEMILLA DE ANUNCIOS — CamperOcasión')
  console.log(`   ${ANUNCIOS.length} anuncios · ${VENDEDORES.length} vendedores · modo ${DRY_RUN ? 'DRY-RUN (sin tocar nada)' : RESET ? 'RESET + INSERT' : 'INSERT (salta existentes)'}\n`)

  // Validación local de fotos antes de tocar la red.
  let totalFotos = 0
  for (const a of ANUNCIOS) {
    for (const f of a.fotos) {
      const ruta = path.join(FOTOS_DIR, f)
      if (!fs.existsSync(ruta)) {
        console.error(`❌ Falta la foto: scripts/semilla/fotos/${f} (anuncio "${a.titulo}")`)
        process.exit(1)
      }
      totalFotos++
    }
    if (!VENDEDORES.some(v => v.slug === a.vendedor)) {
      console.error(`❌ Vendedor desconocido "${a.vendedor}" en "${a.titulo}"`)
      process.exit(1)
    }
  }
  console.log(`📸 ${totalFotos} fotos locales verificadas (media ${(totalFotos / ANUNCIOS.length).toFixed(1)} por anuncio)\n`)

  if (DRY_RUN) {
    console.log('── Plan de inserción ─────────────────────────────────────────')
    for (const [i, a] of ANUNCIOS.entries()) {
      const v = VENDEDORES.find(x => x.slug === a.vendedor)
      const specsN = Object.keys(a.ficha).length
      console.log(
        `${String(i + 1).padStart(2, '0')}. ${a.titulo}\n    ${a.precio.toLocaleString('es-ES')} € · ${a.sub} · ${v.ciudad} · ${a.fotos.length} fotos · ${specsN} specs · desc ${a.descripcion.length} caracteres` +
          `${a.destacado ? ' · ⭐destacado' : ''}${a.boosteado ? ' · 🚀boost' : ''}${a.reservado ? ' · 🔒reservado' : ''}${a.verificacion === 'verificada' ? ' · ✅homologación verificada' : ''}`
      )
    }
    console.log('\n✅ Todo correcto (dry-run). Ejecuta sin --dry-run para sembrar.')
    return
  }

  const categoriaId = await resolverCategoriaCamper()
  console.log(`✅ Categoría "camper": id ${categoriaId}`)

  const ids = await asegurarVendedores()
  console.log()

  if (RESET) await resetear(ids)

  // Anuncios ya existentes (para saltarlos en modo normal).
  const { data: previos, error: ePrev } = await supabase
    .from('productos')
    .select('titulo, user_id')
    .in('user_id', Object.values(ids))
  if (ePrev) throw new Error(`consulta previos: ${ePrev.message}`)
  const yaExiste = new Set((previos || []).map(p => `${p.user_id}::${p.titulo}`))

  let insertados = 0, saltados = 0, fallidos = 0
  const t0 = Date.now()

  for (const [i, a] of ANUNCIOS.entries()) {
    const etiqueta = `[${String(i + 1).padStart(2, '0')}/${ANUNCIOS.length}]`
    const sellerId = ids[a.vendedor]
    const vendedor = VENDEDORES.find(x => x.slug === a.vendedor)

    if (yaExiste.has(`${sellerId}::${a.titulo}`)) {
      console.log(`${etiqueta} ⏭️  ya existe: ${a.titulo.slice(0, 70)}`)
      saltados++
      continue
    }

    try {
      // 1. Fotos → Storage (mismo bucket y estructura que la app real).
      const urls = []
      for (const f of a.fotos) urls.push(await subirFoto(sellerId, f))

      // 2. Inserta el anuncio con TODO lo que pondría un vendedor real.
      const creado = haceHoras(a.creado)
      const fila = {
        user_id: sellerId,
        titulo: a.titulo,
        descripcion: a.descripcion,
        categoria_id: categoriaId,
        subcategoria: a.sub,
        marca: a.marca,
        modelo: a.modelo,
        estado: a.estado,
        precio: a.precio,
        precio_eur: a.precio,
        precio_usd: a.precio, // columna legado: aquí se guarda en euros
        ubicacion_estado: vendedor.estado,
        ubicacion_ciudad: vendedor.ciudad,
        imagen_url: urls[0],
        imagenes: urls,
        especificaciones: a.ficha,
        metodos_contacto: {
          email: emailVendedor(vendedor),
          telefono: vendedor.telefono,
          whatsapp: vendedor.telefono,
        },
        estado_moderacion: 'aprobado',
        motivo_moderacion: null,
        activo: true,
        destacado: !!a.destacado,
        destacado_hasta: a.destacado ? dentroDias(25) : null,
        boosteado_en: a.boosteado ? haceHoras(18) : null,
        vendedor_verificado: vendedor.verificado,
        verificacion_homologacion: a.verificacion || 'sin_verificar',
        ...(a.verificacion === 'verificada'
          ? { verificacion_homologacion_revisada_en: haceHoras(Math.max(a.creado - 30, 12)) }
          : {}),
        vendido: false,
        vendido_en: null,
        comprador_id: null,
        reservado: !!a.reservado,
        ...(a.reservado ? { reservado_hasta: dentroDias(4) } : {}),
        visitas: a.visitas,
        creado_en: creado,
        actualizado_en: creado,
      }

      const { error } = await supabase.from('productos').insert(fila)
      if (error) throw new Error(error.message)

      console.log(`${etiqueta} ✅ ${a.titulo.slice(0, 64)}`)
      console.log(`       ${a.precio.toLocaleString('es-ES')} € · ${vendedor.ciudad} · ${a.fotos.length} fotos subidas · ${a.visitas} visitas`)
      insertados++
    } catch (err) {
      console.error(`${etiqueta} ❌ ${a.titulo.slice(0, 64)}`)
      console.error(`       Error: ${err.message}`)
      fallidos++
    }
    await sleep(150)
  }

  const segundos = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('\n════════════════════════════════════════════════════════════')
  console.log(`🎉 Terminado en ${segundos}s: ${insertados} insertados · ${saltados} ya existían · ${fallidos} fallidos`)
  if (fallidos > 0) {
    console.log('⚠️  Hubo fallos. Revisa los mensajes de arriba.')
    process.exitCode = 1
  } else {
    console.log('👉 Abre https://camperocasion.online/catalogo y verás los anuncios.')
    console.log('   Para sembrar de cero otra vez: node scripts/semilla-anuncios.js --reset')
  }
}

main().catch(e => {
  console.error('\n💥 Error fatal:', e.message)
  process.exit(1)
})
