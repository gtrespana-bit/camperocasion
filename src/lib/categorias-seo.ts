/**
 * SEO de categorías de CamperOcasión: 1 categoría principal + 7
 * subcategorías camper. Los slugs coinciden con categorias.ts.
 */

import {
  categoriasData,
  OPCIONES_DGT,
  OPCIONES_HOMOLOGACION,
} from './categorias'

export type CategoriaSEO = {
  slug: string
  nombre: string
  icono: string
  titulo: string
  descripcion: string
  introduccion: string[]
  terminos: string[]
  faq: { pregunta: string; respuesta: string }[]
}

const CAT = categoriasData.camper

export const CATEGORIAS_SEO: Record<string, CategoriaSEO> = {
  camper: {
    slug: 'camper',
    nombre: CAT.label,
    icono: CAT.icon,
    titulo: 'Furgonetas camper y autocaravanas de ocasión en España',
    descripcion: 'El marketplace especializado en furgonetas camperizadas y autocaravanas de ocasión en España. Gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland. Publica gratis.',
    introduccion: [
      'CamperOcasión reúne furgonetas camper y autocaravanas de segunda mano de toda España: Fiat Ducato, Peugeot Boxer, Citroën Jumper, Renault Master, Volkswagen Crafter, Mercedes Sprinter, MAN TGE, VW California y mucho más, en un rango habitual de 20.000 € a 80.000 €.',
      'Cada anuncio muestra la ficha técnica completa: año de matriculación, kilómetros, distintivo ambiental DGT, homologación (vehículo vivienda 2448/3148, turismo, mixto o furgón), tracción, MMA (peso máximo autorizado), longitud y altura exterior, plazas para viajar y dormir, y todo el equipamiento de autonomía (calefacción estacionaria, agua caliente, baño, batería auxiliar, placa solar e inversor).',
      'Puedes contactar con el vendedor por chat o WhatsApp, y publicar gratis tu camper de ocasión en menos de cinco minutos.',
    ],
    terminos: [
      'Furgonetas camper segunda mano',
      'Autocaravanas de ocasión',
      'Camper gran volumen',
      'Minicamper',
      'Autocaravana integral usada',
      'Camper 4x4 overland',
      'Vehículo vivienda de ocasión',
      'Furgoneta camperizada España',
    ],
    faq: [
      {
        pregunta: '¿Qué es CamperOcasión?',
        respuesta: 'Es el marketplace vertical en España especializado exclusivamente en furgonetas camperizadas y autocaravanas de ocasión. Todos los anuncios son de campers, autocaravanas y vehículos camper, sin otras categorías.',
      },
      {
        pregunta: '¿Cuánto cuesta publicar?',
        respuesta: 'Publicar es gratuito. Solo necesitas una cuenta para crear tu anuncio con fotos, precio, ficha técnica y ubicación (provincia y comunidad autónoma).',
      },
      {
        pregunta: '¿Qué campos técnicos puedo indicar al publicar?',
        respuesta: 'Año de matriculación, kilómetros, combustible, transmisión, potencia, tracción, MMA (peso máximo autorizado), longitud y altura exterior, distintivo DGT (Cero Emisiones, ECO, C, B o sin distintivo), homologación (Vehículo Vivienda 2448/3148, Turismo, Mixto 3100 o Furgón 2400), plazas para viajar y dormir, calefacción estacionaria, agua caliente, tipo de baño, depósito de agua, batería auxiliar, placa solar, inversor 220V y nevera.',
      },
    ],
  },
}

export const CATEGORIAS_SEO_LIST = Object.values(CATEGORIAS_SEO)

export function getCategoriaSEO(slug: string): CategoriaSEO | undefined {
  return CATEGORIAS_SEO[slug]
}

/**
 * SEO de subcategorías: se usa en las landings programáticas
 * /{provincia}/{subslug} y en los textos del catálogo.
 */
export type SubcategoriaSEO = {
  slug: string
  nombre: string
  icono: string
  categoria: string // etiqueta de subcategoría tal como se guarda en la BD
  titulo: string
  descripcion: string
  terminos: string[]
  /** Párrafos de introducción de la landing /{provincia}/{slug}. */
  introduccion: string[]
  /** FAQ visible + FAQPage schema en la landing. */
  faq: { pregunta: string; respuesta: string }[]
}

const SUBS: SubcategoriaSEO[] = CAT.subs.map((sub) => {
  const base: Record<string, { descripcion: string; terminos: string[]; introduccion: string[]; faq: { pregunta: string; respuesta: string }[] }> = {
    'gran-volumen': {
      descripcion: 'Furgonetas camper gran volumen (L2H2, L3H2, L4H3) de ocasión: Fiat Ducato, Citroën Jumper, Peugeot Boxer, Renault Master, VW Crafter, Mercedes Sprinter y MAN TGE camperizadas. Interior amplio, plaza a plaza o con bañera, ideales para viajes de largo radio.',
      terminos: ['camper gran volumen', 'Ducato camper de ocasión', 'Boxer camperizada segunda mano', 'Jumper camper usada', 'autocaravana gran volumen'],
      introduccion: [
        'Las campers gran volumen (L3H2, L4H2 y L4H3) son la opción familiar por excelencia: cama doble fija a la altura de la vista, zona de estar amplia y, en muchas, cuarto de baño con ducha y calefacción estacionaria. Bases habituales: Fiat Ducato, Citroën Jumper, Peugeot Boxer, Renault Master, Volkswagen Crafter, Mercedes Sprinter y MAN TGE.',
        'Al buscar una gran volumen de segunda mano, fíjate en el MMA (3.500 kg se conduce con el permiso B), en el estado del chasis y en si la camperización está homologada como vehículo vivienda (2448/3148). En CamperOcasión cada anuncio detalla plazas para viajar y dormir, equipamiento de autonomía y sello de homologación verificada cuando el expediente está revisado.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una camper gran volumen?',
          respuesta: 'Una furgoneta camperizada sobre base larga y techo alto (L3H2, L4H2 o L4H3), normalmente Fiat Ducato, Citroën Jumper, Peugeot Boxer, Renault Master, VW Crafter, Mercedes Sprinter o MAN TGE. Ofrece cama doble fija, estar amplio y suele llevar baño, cocina y calefacción estacionaria. Es la camper más espaciosa sin pasar a autocaravana.',
        },
        {
          pregunta: '¿Cuántas personas duermen en una camper gran volumen?',
          respuesta: 'De 2 a 6 personas según distribución: la mayoría tienen cama doble fija trasera más literas o mesa convertible. Comprueba siempre las plazas "para viajar" y "para dormir" en la ficha técnica del anuncio: no son lo mismo y la ITV solo homologa las que figuran.',
        },
        {
          pregunta: '¿Se puede conducir una camper gran volumen con el permiso B?',
          respuesta: 'Sí, si su MMA (peso máximo autorizado) no supera los 3.500 kg, que es lo habitual en Ducato, Boxer, Jumper, Master, Sprinter y Crafter camperizados. Si la MMA es mayor (algunas integrales y gran volumen cargadas), necesitas B+E o C1: verifica la ficha técnica antes de comprar.',
        },
      ],
    },
    'camper-mediana': {
      descripcion: 'Camper medianas y compactas de ocasión: VW California, Transporter y Multivan camper, Mercedes Marco Polo y Vito, Ford Transit Custom, Renault Trafic y Toyota Proace. El equilibrio perfecto entre agilidad urbana y habitabilidad.',
      terminos: ['VW California de ocasión', 'camper compacta segunda mano', 'Marco Polo usado', 'Transit Custom camper', 'camper mediana'],
      introduccion: [
        'Las campers medianas y compactas (L1H1/L2H1, de 4,6 a 5,3 m) son la elección habitual de parejas y pequeñas familias que quieren viajar sin renunciar a aparcar en ciudad. VW California y Transporter, Mercedes Marco Polo y Vito, Ford Transit Custom, Renault Trafic, Opel Vivaro y Toyota Proace son las bases más comunes.',
        'Suelen dormir 2–4 personas (cama trasera o cama abatible sobre cabina), llevar cocina exterior o fregadero y nevera, y consumir entre 7 y 9 L/100 km. Muchas conservan la altura original (< 2 m) y entran en parkings de superficie y en la mayoría de parkings de ciudad.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una camper mediana o compacta?',
          respuesta: 'Una furgoneta camperizada de entre 4,6 y 5,3 metros (VW Transporter/California, Ford Transit Custom, Mercedes Vito, Renault Trafic, Opel Vivaro, Toyota Proace) con cama, cocina básica y equipamiento de viaje. Es el equilibrio entre habitabilidad y agilidad urbana: se conduce como un monovolumen.',
        },
        {
          pregunta: '¿Una camper mediana cabe en un parking de ciudad?',
          respuesta: 'Casi todas sí: miden menos de 5,3 m y muchas no superan los 2 m de altura (como una furgoneta de reparto). Eso permite entrar en parkings subterráneos con altura libre estándar (≥ 1,9–2 m) y circular por calles estrechas, algo que las autocaravanas grandes no permiten.',
        },
        {
          pregunta: '¿Cuánto consume una camper mediana?',
          respuesta: 'Entre 7 y 10 L/100 km en uso real según motor (2.0 TDI habitual), carga y estilo de conducción. Las versiones de 2.0 TDI 110–150 CV son el punto dulce: suficiente potencia con MMA de 2.800–3.100 kg y consumo contenido frente a las bases de 3.500 kg.',
        },
      ],
    },
    minicamper: {
      descripcion: 'Minicamper de ocasión a base de berlingo, Rifter, Partner, Kangoo, Caddy y Dokker camperizadas. Convertibles, fáciles de aparcar y con consumo contenido: la puerta de entrada al mundo camper.',
      terminos: ['minicamper de ocasión', 'Berlingo camper usada', 'Kangoo camperizada', 'Caddy camper segunda mano', 'camper pequeña barata'],
      introduccion: [
        'Las minicamper son furgonetas compactas (Citroën Berlingo, Peugeot Rifter y Partner, Renault Kangoo, VW Caddy, Fiat Doblò y Dokker) camperizadas por particulares o pequeños camperizadores: cama plegable, nevera portátil y a veces cocina exterior. Miden 4,4 m o menos y consumen 5–7 L/100 km.',
        'Son la puerta de entrada al mundo camper y la opción más económica del catálogo. Eso sí: su habitabilidad es limitada (ideal para 1–2 personas) y muchas camperizaciones son ligeras, así que revisa si llevan homologación o si la camperización es desmontable.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una minicamper?',
          respuesta: 'Una furgoneta compacta (Berlingo, Rifter, Partner, Kangoo, Caddy, Doblò o Dokker) transformada en vehículo de viaje con cama plegable o abatible y equipamiento ligero. Duermen 1–2 personas, miden menos de 4,5 m y consumen poco: la opción más asequible para empezar en el camperismo.',
        },
        {
          pregunta: '¿Necesita homologación una minicamper?',
          respuesta: 'Depende: si la camperización es ligera y desmontable (saco de dormir, nevera portátil, cama plegable sin obra), puede circular como turismo o furgón sin reforma. Si incluye cocina, agua, cama fija o instalación eléctrica permanente, debe homologarse como vehículo vivienda (2448) o mixto adaptable (3100). Pide siempre la ficha técnica.',
        },
        {
          pregunta: '¿Se puede dormir en una minicamper dos personas?',
          respuesta: 'Sí, aunque justo: la cama suele medir 1,80–2,10 m de largo y 1,20–1,40 m de ancho. Para parejas es viable en verano; si viajas con niños o quieres ducha y cocina interior, una camper mediana o gran volumen dará más confort por poco más de presupuesto.',
        },
      ],
    },
    perfilada: {
      descripcion: 'Autocaravanas perfiladas de ocasión sobre Fiat, Ford, Volkswagen, Mercedes, Renault e Iveco. Perfil bajo para aparcamiento y garaje, con zona de estar desplazada hacia la parte trasera.',
      terminos: ['autocaravana perfilada de ocasión', 'perfilada usada', 'autocaravana perfilada barata', 'perfilada gran volumen'],
      introduccion: [
        'La autocaravana perfilada se reconoce por su perfil bajo y su cama doble sobre la cabina (cama "basculante" o fija según modelo). Es la familia más vendida de autocaravana en Europa: más espacio interior que una camper, altura inferior a la capuchina (2,8–3,1 m habitual) y buena visibilidad al volante.',
        'Marcas habituales de ocasión: Adria, Hymer, Challenger, Laika, Swift, Roller Team, Benimar, PIK y Burstner, sobre chasis Fiat Ducato, Ford Transit, VW Crafter, Mercedes Sprinter, Renault Master e Iveco Daily. Duermen de 4 a 6 personas y casi todas llevan baño, ducha y truma de calefacción.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una autocaravana perfilada?',
          respuesta: 'Una autocaravana con perfil bajo y frontal liso (sin capucha sobre la cabina), cama doble normalmente sobre la cabina y zona de estar desplazada atrás. Altura típica 2,8–3,1 m: entra en la mayoría de parkings y gasolineras. Es la autocaravana más vendida por equilibrio entre espacio y conducción.',
        },
        {
          pregunta: '¿Una autocaravana perfilada cabe en un garaje?',
          respuesta: 'En la mayoría de garajes comunitarios (altura libre 1,9–2,2 m) NO: una perfilada mide 2,8–3,1 m de alto. Cabe en plazas de garaje de altura libre ≥ 2,8 m o en parking exterior. Mide siempre la altura del vehículo (con portabultos incluido) antes de comprar.',
        },
        {
          pregunta: '¿Cuántas personas viajan en una perfilada?',
          respuesta: 'Normalmente 4–6: cuatro asientos de viaje (delante + mesa) y camas para 4 (doble sobre cabina + doble trasera). Revisa en la ficha técnica las plazas de viaje homologadas (las que pueden ir sentadas con cinturón) y las plazas de dormir, que pueden diferir.',
        },
      ],
    },
    capuchina: {
      descripcion: 'Autocaravanas capuchinas de ocasión: cabina original con litera superior, máxima habitabilidad al precio más ajustado dentro de las autocaravanas.',
      terminos: ['autocaravana capuchina de ocasión', 'capuchina usada', 'autocaravana litera capucha', 'capuchina fiat'],
      introduccion: [
        'La autocaravana capuchina mantiene la cabina del vehículo industrial y añade una "capucha" sobre ella: la litera delantera, que suele ser la cama principal (1,40–1,60 m de ancho). Es la autocaravana con más plazas de dormir por metro y, por lo general, la más económica de segunda mano.',
        'Contrapartidas: la capucha dificulta la visibilidad en tráfico urbano, su perfil alto (3,1–3,3 m) limita la entrada a parkings y gasolineras, y la litera es calurosa en verano si no lleva ventilación. Marcas habituales: Adria, Hymer, Challenger, Roller Team, Benimar, PIK, Laika y Swift sobre Ducato, Transit, Crafter y Daily.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una autocaravana capuchina?',
          respuesta: 'Una autocaravana con una protuberancia ("capucha") sobre la cabina que aloja la litera delantera, normalmente la cama principal. Ofrece máxima habitabilidad por su longitud (5,9–7,5 m) y suele ser la autocaravana de ocasión más barata por plaza de dormir.',
        },
        {
          pregunta: '¿La litera de la capuchina es cómoda?',
          respuesta: 'Es amplia (1,40–1,60 m de ancho) pero va sobre el salpicadero: notarás más ruido de carretera y, sin ventilación, calor en verano. Los modelos recientes llevan ventanas y trampillas de ventilación; al comprar de ocasión, compruébalo en persona y en movimiento.',
        },
        {
          pregunta: '¿Qué altura tiene una capuchina y dónde puede aparcar?',
          respuesta: 'Entre 3,1 y 3,3 m de altura, por lo que no entra en parkings subterráneos estándar ni bajo muchas gasolineras con toldo bajo. Circula con el toldo y antenas plegados y consulta la altura exacta en la ficha técnica antes de planificar rutas con túneles o parkings.',
        },
      ],
    },
    integral: {
      descripcion: 'Autocaravanas integrales de ocasión: Adria, Hymer, Challenger, Laika, Swift, Profile, Autocamper, PIK y Benimar. Máximo confort, cabina independiente y acabados de nivel superior.',
      terminos: ['autocaravana integral de ocasión', 'integral usada', 'Adria de segunda mano', 'Hymer ocasión', 'autocaravana integral barata'],
      introduccion: [
        'La autocaravana integral es la de mayor confort: cabina de conducción integrada en el habitáculo (salpicadero a la altura del resto), aislamiento superior, calefacción y agua caliente por gas, y acabados de gama. Duermen 4–6 personas y son la opción habitual para viajar a tiempo completo o temporadas largas.',
        'A cambio, son las más caras (de 45.000 € a más de 150.000 € en ocasión según modelo y año), las más altas (3,1–3,4 m) y las que más consumen (12–16 L/100 km). Marcas de ocasión: Adria, Hymer, Challenger, Laika, Swift, Roller Team, Benimar, PIK, Autocamper y Dethleffs.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una autocaravana integral?',
          respuesta: 'Una autocaravana construida sobre cabina propia (no sobre furgoneta industrial), con el salpicadero integrado en el espacio habitable, aislamiento y acabados de gama alta. Es la categoría superior: máximo confort para viajes largos o vivir en la carretera, a cambio de precio, altura y consumo.',
        },
        {
          pregunta: '¿Cuánto cuesta una autocaravana integral de ocasión?',
          respuesta: 'Desde unos 45.000 € por modelos de los 2000s con muchos kilómetros, hasta 80.000–150.000 € para integrales de 2015–2022 de gama media-alta. El precio depende sobre todo de la marca, el año, el chasis (Fiat Ducato 3,5 t es lo habitual) y el estado del habitáculo y del motor diésel.',
        },
        {
          pregunta: '¿Qué mantenimiento tiene una integral?',
          respuesta: 'Similar a un furgón grande en mecánica (revisiones cada 15.000–30.000 km, distribución según motor) más el hogar: revisión anual de la instalación de gas (con boletín), revisión de juntas y sellado de carrocería (fugas de agua), y tratamiento de depósitos de agua potable y residuales. Presupuesta 1.500–3.000 €/año entre seguro, mantenimiento y áreas de servicio.',
        },
      ],
    },
    overland: {
      descripcion: 'Células sobre pick-up y camper 4x4 overland de ocasión: Toyota, Mitsubishi, Nissan, Volkswagen, Ford y Land Rover. Para viajar fuera del asfalto, con tracción total y autonomía real.',
      terminos: ['camper 4x4 de ocasión', 'overland España', 'célula pick-up', 'Hilux camper usada', '4x4 camperizada'],
      introduccion: [
        'El overland campero abarca dos mundos: células desmontables sobre pick-up (Toyota Hilux, Mitsubishi L200, Nissan Navara, Ford Ranger, VW Amarok) y furgonetas 4x4 camperizadas (VW T4/T5 4Motion, Mercedes Sprinter 4x4, Iveco Daily 4x4). Están pensadas para salir de las carreteras asfaltadas: tracción total, mayor altura libre y autonomía real de agua y energía.',
        'Antes de comprar, verifica tres cosas: la tracción real (4x4 con reductora, no solo 4x2 con aspecto aventurero), la MMA del conjunto (célula + pick-up pueden superar 3.500 kg y exigir C1) y que la camperización de la célula esté homologada como vehículo vivienda si vas a dormir en ella de forma legal.',
      ],
      faq: [
        {
          pregunta: '¿Qué es una camper overland o 4x4?',
          respuesta: 'Un vehículo camper preparado para terreno no asfaltado: pick-up con célula camper (Hilux, L200, Navara, Ranger, Amarok) o furgón 4x4 camperizado (T4/T5 Syncro, Sprinter 4x4, Daily 4x4). Tracción total, altura libre y autonomía ampliada: el estándar para rutas de aventura y zonas remotas.',
        },
        {
          pregunta: '¿Necesito un permiso especial para una camper 4x4 o una célula?',
          respuesta: 'Con el permiso B basta si la MMA del conjunto no supera 3.500 kg. Ojo con las células grandes sobre pick-up: suman peso y pueden elevar la MMA por encima de ese límite, exigiendo B+E o C1. Comprueba la MMA total en la ficha técnica del conjunto antes de reservar.',
        },
        {
          pregunta: '¿Se puede circular por pistas forestales con una camper overland?',
          respuesta: 'Depende de la vía y la autorización, no solo del vehículo: muchas pistas forestales y caminos rurales son transitables con 4x4, pero parques naturales y zonas protegidas exigen permiso de circulación y acampada. Consulta siempre la normativa autonómica y local; circular fuera de pista en zona protegida puede ser sancionable.',
        },
      ],
    },
  }
  const info = base[sub.slug]
  return {
    slug: sub.slug,
    nombre: sub.label,
    icono: sub.icon,
    categoria: sub.label,
    titulo: `${sub.label} de ocasión en España`,
    descripcion: info.descripcion,
    terminos: info.terminos,
    introduccion: info.introduccion,
    faq: info.faq,
  }
})

export const SUBCATEGORIAS_SEO: SubcategoriaSEO[] = SUBS

export const SUBCATEGORIAS_SEO_MAP: Record<string, SubcategoriaSEO> = Object.fromEntries(
  SUBS.map(s => [s.slug, s])
)

export function getSubcategoriaSEO(slug: string): SubcategoriaSEO | undefined {
  return SUBCATEGORIAS_SEO_MAP[slug]
}

/** Distintivos DGT y homologaciones disponibles (para textos SEO). */
export const SEO_CAMPER_DATA = {
  dgt: OPCIONES_DGT,
  homologacion: OPCIONES_HOMOLOGACION,
}
