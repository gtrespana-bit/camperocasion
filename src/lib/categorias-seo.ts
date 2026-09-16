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
    titulo: 'Furgonetas camper y autocaravanas de ocasión en España — CamperOcasión',
    descripcion: 'El marketplace especializado en furgonetas camperizadas y autocaravanas de ocasión en España. Gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland. Publica gratis.',
    introduccion: [
      'CamperOcasión reúne furgonetas camper y autocaravanas de segunda mano de toda España: Fiat Ducato, Peugeot Boxer, Citroën Jumper, Renault Master, Volkswagen Crafter, Mercedes Sprinter, MAN TGE, VW California y mucho más, en un rango habitual de 20.000 € a 80.000 €.',
      'Cada anuncio muestra la ficha técnica completa: año de matriculación, kilómetros, distintivo ambiental DGT, homologación (vehículo vivienda 2448/3148, turismo, mixto o furgón), plazas para viajar y dormir, y todo el equipamiento de autonomía (calefacción estacionaria, agua caliente, baño, batería auxiliar, placa solar e inversor).',
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
        respuesta: 'Año de matriculación, kilómetros, combustible, transmisión, potencia, distintivo DGT (Cero Emisiones, ECO, C, B o sin distintivo), homologación (Vehículo Vivienda 2448/3148, Turismo, Mixto 3100 o Furgón 2400), plazas para viajar y dormir, calefacción estacionaria, agua caliente, tipo de baño, depósito de agua, batería auxiliar, placa solar, inversor 220V y nevera.',
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
}

const SUBS: SubcategoriaSEO[] = CAT.subs.map((sub) => {
  const base: Record<string, { descripcion: string; terminos: string[] }> = {
    'gran-volumen': {
      descripcion: 'Furgonetas camper gran volumen (L2H2, L3H2, L4H3) de ocasión: Fiat Ducato, Citroën Jumper, Peugeot Boxer, Renault Master, VW Crafter, Mercedes Sprinter y MAN TGE camperizadas. Interior amplio, plaza a plaza o con bañera, ideales para viajes de largo radio.',
      terminos: ['camper gran volumen', 'Ducato camper de ocasión', 'Boxer camperizada segunda mano', 'Jumper camper usada', 'autocaravana gran volumen'],
    },
    'camper-mediana': {
      descripcion: 'Camper medianas y compactas de ocasión: VW California, Transporter y Multivan camper, Mercedes Marco Polo y Vito, Ford Transit Custom, Renault Trafic y Toyota Proace. El equilibrio perfecto entre agilidad urbana y habitabilidad.',
      terminos: ['VW California de ocasión', 'camper compacta segunda mano', 'Marco Polo usado', 'Transit Custom camper', 'camper mediana'],
    },
    minicamper: {
      descripcion: 'Minicamper de ocasión a base de berlingo, Rifter, Partner, Kangoo, Caddy y Dokker camperizadas. Convertibles, fáciles de aparcar y con consumo contenido: la puerta de entrada al mundo camper.',
      terminos: ['minicamper de ocasión', 'Berlingo camper usada', 'Kangoo camperizada', 'Caddy camper segunda mano', 'camper pequeña barata'],
    },
    perfilada: {
      descripcion: 'Autocaravanas perfiladas de ocasión sobre Fiat, Ford, Volkswagen, Mercedes, Renault e Iveco. Perfil bajo para aparcamiento y garaje, con zona de estar desplazada hacia la parte trasera.',
      terminos: ['autocaravana perfilada de ocasión', 'perfilada usada', 'autocaravana perfilada barata', 'perfilada gran volumen'],
    },
    capuchina: {
      descripcion: 'Autocaravanas capuchinas de ocasión: cabina original con litera superior, máxima habitabilidad al precio más ajustado dentro de las autocaravanas.',
      terminos: ['autocaravana capuchina de ocasión', 'capuchina usada', 'autocaravana litera capucha', 'capuchina fiat'],
    },
    integral: {
      descripcion: 'Autocaravanas integrales de ocasión: Adria, Hymer, Challenger, Laika, Swift, Profile, Autocamper, PIK y Benimar. Máximo confort, cabina independiente y acabados de nivel superior.',
      terminos: ['autocaravana integral de ocasión', 'integral usada', 'Adria de segunda mano', 'Hymer ocasión', 'autocaravana integral barata'],
    },
    overland: {
      descripcion: 'Células sobre pick-up y camper 4x4 overland de ocasión: Toyota, Mitsubishi, Nissan, Volkswagen, Ford y Land Rover. Para viajar fuera del asfalto, con tracción total y autonomía real.',
      terminos: ['camper 4x4 de ocasión', 'overland España', 'célula pick-up', 'Hilux camper usada', '4x4 camperizada'],
    },
  }
  const info = base[sub.slug]
  return {
    slug: sub.slug,
    nombre: sub.label,
    icono: sub.icon,
    categoria: sub.label,
    titulo: `${sub.label} de ocasión en España — CamperOcasión`,
    descripcion: info.descripcion,
    terminos: info.terminos,
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
