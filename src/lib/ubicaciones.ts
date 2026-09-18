// Geografía de España para CamperOcasión
// Fuente: División territorial oficial — 17 Comunidades Autónomas + 50
// provincias (más Ceuta y Melilla) = 52 provincias.
//
// Compatibilidad: se mantienen los nombres de export históricos
// (ESTADOS, MUNICIPIOS_POR_ESTADO, getMunicipios...) con semántica española:
//   ESTADOS  = Comunidades Autónomas
//   municipio = Provincia (nombre), capital = capital de la provincia
// Los selectores de la UI muestran "Comunidad Autónoma" / "Provincia".

export const COMUNIDADES_AUTONOMAS = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Baleares',
  'Canarias',
  'Cantabria',
  'Castilla-La Mancha',
  'Castilla y León',
  'Cataluña',
  'Comunitat Valenciana',
  'Extremadura',
  'Galicia',
  'La Rioja',
  'Madrid',
  'Murcia',
  'Navarra',
  'País Vasco',
] as const

export type Comunidad = typeof COMUNIDADES_AUTONOMAS[number]

// Alias de compatibilidad (los componentes antiguos importan ESTADOS)
export const ESTADOS = COMUNIDADES_AUTONOMAS
export type Estado = Comunidad

export interface Municipio {
  nombre: string // Provincia
  capital: string // Capital de la provincia
}

// Provincias por Comunidad Autónoma (50 + Ceuta y Melilla)
export const MUNICIPIOS_POR_ESTADO: Record<string, Municipio[]> = {
  'Andalucía': [
    { nombre: 'Almería', capital: 'Almería' },
    { nombre: 'Cádiz', capital: 'Cádiz' },
    { nombre: 'Córdoba', capital: 'Córdoba' },
    { nombre: 'Granada', capital: 'Granada' },
    { nombre: 'Huelva', capital: 'Huelva' },
    { nombre: 'Jaén', capital: 'Jaén' },
    { nombre: 'Málaga', capital: 'Málaga' },
    { nombre: 'Sevilla', capital: 'Sevilla' },
  ],
  'Aragón': [
    { nombre: 'Huesca', capital: 'Huesca' },
    { nombre: 'Teruel', capital: 'Teruel' },
    { nombre: 'Zaragoza', capital: 'Zaragoza' },
  ],
  'Asturias': [
    { nombre: 'Asturias', capital: 'Oviedo' },
  ],
  'Baleares': [
    { nombre: 'Baleares', capital: 'Palma' },
  ],
  'Canarias': [
    { nombre: 'Las Palmas', capital: 'Las Palmas de Gran Canaria' },
    { nombre: 'Santa Cruz de Tenerife', capital: 'Santa Cruz de Tenerife' },
  ],
  'Cantabria': [
    { nombre: 'Cantabria', capital: 'Santander' },
  ],
  'Castilla-La Mancha': [
    { nombre: 'Albacete', capital: 'Albacete' },
    { nombre: 'Ciudad Real', capital: 'Ciudad Real' },
    { nombre: 'Cuenca', capital: 'Cuenca' },
    { nombre: 'Guadalajara', capital: 'Guadalajara' },
    { nombre: 'Toledo', capital: 'Toledo' },
  ],
  'Castilla y León': [
    { nombre: 'Ávila', capital: 'Ávila' },
    { nombre: 'Burgos', capital: 'Burgos' },
    { nombre: 'León', capital: 'León' },
    { nombre: 'Palencia', capital: 'Palencia' },
    { nombre: 'Salamanca', capital: 'Salamanca' },
    { nombre: 'Segovia', capital: 'Segovia' },
    { nombre: 'Soria', capital: 'Soria' },
    { nombre: 'Valladolid', capital: 'Valladolid' },
    { nombre: 'Zamora', capital: 'Zamora' },
  ],
  'Cataluña': [
    { nombre: 'Barcelona', capital: 'Barcelona' },
    { nombre: 'Girona', capital: 'Girona' },
    { nombre: 'Lleida', capital: 'Lleida' },
    { nombre: 'Tarragona', capital: 'Tarragona' },
  ],
  'Comunitat Valenciana': [
    { nombre: 'Alicante', capital: 'Alicante' },
    { nombre: 'Castellón', capital: 'Castellón de la Plana' },
    { nombre: 'Valencia', capital: 'Valencia' },
  ],
  'Extremadura': [
    { nombre: 'Badajoz', capital: 'Mérida' },
    { nombre: 'Cáceres', capital: 'Cáceres' },
  ],
  'Galicia': [
    { nombre: 'A Coruña', capital: 'A Coruña' },
    { nombre: 'Lugo', capital: 'Lugo' },
    { nombre: 'Ourense', capital: 'Ourense' },
    { nombre: 'Pontevedra', capital: 'Vigo' },
  ],
  'La Rioja': [
    { nombre: 'La Rioja', capital: 'Logroño' },
  ],
  'Madrid': [
    { nombre: 'Madrid', capital: 'Madrid' },
  ],
  'Murcia': [
    { nombre: 'Murcia', capital: 'Murcia' },
  ],
  'Navarra': [
    { nombre: 'Navarra', capital: 'Pamplona' },
  ],
  'País Vasco': [
    { nombre: 'Álava', capital: 'Vitoria-Gasteiz' },
    { nombre: 'Vizcaya', capital: 'Bilbao' },
    { nombre: 'Gipuzkoa', capital: 'San Sebastián' },
  ],
  'Ceuta': [
    { nombre: 'Ceuta', capital: 'Ceuta' },
  ],
  'Melilla': [
    { nombre: 'Melilla', capital: 'Melilla' },
  ],
}

// Helper: obtener provincias de una comunidad autónoma
export function getMunicipios(estado: string): Municipio[] {
  return MUNICIPIOS_POR_ESTADO[estado] || []
}

// Helper: obtener solo los nombres de provincia de una comunidad
export function getMunicipiosNombres(estado: string): string[] {
  const municipios = getMunicipios(estado)
  return municipios.map(m => m.nombre).sort((a, b) => a.localeCompare(b, 'es'))
}

// Helper: obtener la capital de una provincia
export function getCapital(estado: string, municipio: string): string {
  const municipios = getMunicipios(estado)
  const m = municipios.find(x => x.nombre === municipio)
  return m?.capital || ''
}

// ── API nueva (semántica española) ─────────────────────────────────────

/** Todas las provincias de España (50 + Ceuta y Melilla). */
export const PROVINCIAS: string[] = Object.values(MUNICIPIOS_POR_ESTADO)
  .flat()
  .map(m => m.nombre)
  .sort((a, b) => a.localeCompare(b, 'es'))

/** Comunidad Autónoma a la que pertenece una provincia. */
export function getComunidadDeProvincia(provincia: string): string | undefined {
  if (!provincia) return undefined
  const normalizada = provincia.trim().toLowerCase()
  // 17 CC.AA. + Ceuta + Melilla (claves directas de la tabla)
  const comunidades = [...COMUNIDADES_AUTONOMAS, 'Ceuta', 'Melilla']
  for (const comunidad of comunidades) {
    if (MUNICIPIOS_POR_ESTADO[comunidad]?.some(m => m.nombre.toLowerCase() === normalizada)) {
      return comunidad
    }
  }
  return undefined
}

/** Provincias de una comunidad autónoma (alias legible). */
export function getProvinciasDeComunidad(comunidad: string): string[] {
  return getMunicipiosNombres(comunidad)
}

/** ¿Es una provincia válida de España? */
export function esProvinciaValida(provincia: string): boolean {
  return PROVINCIAS.includes(provincia.trim())
}

/** ¿Es una comunidad autónoma válida? */
export function esComunidadValida(comunidad: string): boolean {
  return (COMUNIDADES_AUTONOMAS as readonly string[]).includes(comunidad.trim())
}

// Legacy: mantener compatibilidad con CIUDADES_POR_ESTADO
export const CIUDADES_POR_ESTADO: Record<string, string[]> = {}
for (const estado of ESTADOS) {
  CIUDADES_POR_ESTADO[estado] = getMunicipiosNombres(estado)
}
