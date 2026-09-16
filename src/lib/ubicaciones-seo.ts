// Datos SEO de CamperOcasión: una landing por cada provincia de España.
// Objetivos de posicionamiento: "furgonetas camper segunda mano {provincia}",
// "camper gran volumen {provincia}", "autocaravanas ocasión {provincia}", etc.
//
// Genera metadata única para cada provincia y para cada combinación
// provincia + subcategoría camper (/[provincia]/gran-volumen, ...).

import { MUNICIPIOS_POR_ESTADO } from './ubicaciones'

export interface CiudadSEO {
  slug: string
  /** Nombre de la provincia (nombre de marca de la landing). */
  nombre: string
  /** Provincia (campo de compatibilidad). */
  municipio?: string
  /** Comunidad Autónoma. */
  estado: string
  descripcion: string
  keywords: string[]
  titulo: string
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Una entrada por provincia. `nombre` = provincia (lo que filtra el catálogo
// por `ubicacion_ciudad`), `estado` = Comunidad Autónoma.
const ciudades: CiudadSEO[] = []

// Recorre la tabla completa (17 CC.AA. + Ceuta + Melilla).
Object.entries(MUNICIPIOS_POR_ESTADO).forEach(([comunidad, provincias]) => {
  provincias.forEach(({ nombre }) => {
    const provinciaMin = nombre.toLowerCase()
    const comunidadMin = comunidad.toLowerCase()
    ciudades.push({
      slug: slugify(nombre),
      nombre,
      municipio: nombre,
      estado: comunidad,
      // Sin marca: el template del layout raíz (%s | CamperOcasión) la agrega
      // una sola vez.
      titulo: `Furgonetas camper segunda mano ${nombre} — Autocaravanas de ocasión`,
      descripcion: `Compra furgonetas camperizadas y autocaravanas de ocasión en ${nombre}, ${comunidad}. Gran volumen, camper medianas, minicamper, perfiladas, capuchinas e integrales. Publica gratis en CamperOcasión.`,
      keywords: [
        `furgonetas camper segunda mano ${provinciaMin}`,
        `camper gran volumen ${provinciaMin}`,
        `autocaravanas ocasion ${provinciaMin}`,
        `autocaravana usada ${provinciaMin}`,
        `camper de ocasión ${comunidadMin}`,
        `furgoneta camperizada ${provinciaMin}`,
        `minicamper ${provinciaMin}`,
        `camper ${provinciaMin} precio`,
      ],
    })
  })
})

export const CIUDADES_SEO: CiudadSEO[] = ciudades

// Helper para buscar provincia por slug
export function getCiudadBySlug(slug: string): CiudadSEO | undefined {
  return CIUDADES_SEO.find(c => c.slug === slug)
}

// Helper para buscar provincia por nombre
export function getCiudadByMunicipio(municipio: string): CiudadSEO | undefined {
  if (!municipio) return undefined
  const normalizada = municipio.trim().toLowerCase()
  return CIUDADES_SEO.find(c =>
    (c.municipio?.trim().toLowerCase() === normalizada) ||
    c.nombre.trim().toLowerCase() === normalizada
  )
}

// Helper para buscar provincia por nombre y comunidad de forma exacta
export function getCiudadByMunicipioYEstado(municipio: string, estado: string): CiudadSEO | undefined {
  if (!municipio) return undefined
  const normalizada = municipio.trim().toLowerCase()
  const normalizadoEstado = estado?.trim().toLowerCase()
  return CIUDADES_SEO.find(c =>
    (c.municipio?.trim().toLowerCase() === normalizada || c.nombre.trim().toLowerCase() === normalizada) &&
    (!normalizadoEstado || c.estado.trim().toLowerCase() === normalizadoEstado)
  )
}

// Helper para obtener todas las provincias de una comunidad
export function getCiudadesPorEstado(estado: string): CiudadSEO[] {
  return CIUDADES_SEO.filter(c => c.estado === estado)
}

// Helper para generar rutas estáticas (clave = nombre del segmento [ciudad])
export function generateCityParams() {
  return CIUDADES_SEO.map(ciudad => ({
    ciudad: ciudad.slug
  }))
}

// Subcategorías camper populares por provincia (SEO programático).
// IMPORTANTE — estos slugs DEBEN coincidir con los slugs de subcategoría de
// src/lib/categorias.ts. Si no, el sitemap genera landings que no existen
// (contenido delgado) y las subcategorías reales quedan fuera del SEO local.
export const CATEGORIAS_POPULARES = [
  'gran-volumen',
  'camper-mediana',
  'minicamper',
  'perfilada',
  'capuchina',
  'integral',
  'overland',
]

// Nombres para mostrar en landings provincia/categoría
export const NOMBRES_CATEGORIA_POPULAR: Record<string, string> = {
  'gran-volumen': 'Camper Gran Volumen',
  'camper-mediana': 'Camper Mediana y Compacta',
  'minicamper': 'Minicamper',
  'perfilada': 'Autocaravana Perfilada',
  'capuchina': 'Autocaravana Capuchina',
  'integral': 'Autocaravana Integral',
  'overland': 'Célula y 4x4 Overland',
}

// Generar combinaciones provincia-categoría para SEO programático
export function generateCityCategoryParams(): Array<{ ciudad: string; categoria: string }> {
  const params: Array<{ ciudad: string; categoria: string }> = []
  for (const ciudad of CIUDADES_SEO) {
    for (const categoria of CATEGORIAS_POPULARES) {
      params.push({
        ciudad: ciudad.slug,
        categoria,
      })
    }
  }
  return params
}
