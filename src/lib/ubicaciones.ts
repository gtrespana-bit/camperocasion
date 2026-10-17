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
  /** Coordenadas de la capital provincial (WGS84, GeoCoordinates). */
  lat: number
  lng: number
}

// Provincias por Comunidad Autónoma (50 + Ceuta y Melilla)
export const MUNICIPIOS_POR_ESTADO: Record<string, Municipio[]> = {
  'Andalucía': [
    { nombre: 'Almería', capital: 'Almería', lat: 36.8381, lng: -2.4593 },
    { nombre: 'Cádiz', capital: 'Cádiz', lat: 36.5271, lng: -6.2885 },
    { nombre: 'Córdoba', capital: 'Córdoba', lat: 37.8882, lng: -4.7794 },
    { nombre: 'Granada', capital: 'Granada', lat: 37.1773, lng: -3.5986 },
    { nombre: 'Huelva', capital: 'Huelva', lat: 37.2594, lng: -6.9424 },
    { nombre: 'Jaén', capital: 'Jaén', lat: 37.7796, lng: -3.7849 },
    { nombre: 'Málaga', capital: 'Málaga', lat: 36.7213, lng: -4.4214 },
    { nombre: 'Sevilla', capital: 'Sevilla', lat: 37.3891, lng: -5.9845 },
  ],
  'Aragón': [
    { nombre: 'Huesca', capital: 'Huesca', lat: 42.14, lng: -0.4078 },
    { nombre: 'Teruel', capital: 'Teruel', lat: 40.3433, lng: -1.1043 },
    { nombre: 'Zaragoza', capital: 'Zaragoza', lat: 41.6488, lng: -0.8891 },
  ],
  'Asturias': [
    { nombre: 'Asturias', capital: 'Oviedo', lat: 43.3614, lng: -5.8487 },
  ],
  'Baleares': [
    { nombre: 'Baleares', capital: 'Palma', lat: 39.5696, lng: 2.6502 },
  ],
  'Canarias': [
    { nombre: 'Las Palmas', capital: 'Las Palmas de Gran Canaria', lat: 28.1235, lng: -15.4363 },
    { nombre: 'Santa Cruz de Tenerife', capital: 'Santa Cruz de Tenerife', lat: 28.4636, lng: -16.2518 },
  ],
  'Cantabria': [
    { nombre: 'Cantabria', capital: 'Santander', lat: 43.4648, lng: -3.8045 },
  ],
  'Castilla-La Mancha': [
    { nombre: 'Albacete', capital: 'Albacete', lat: 38.9945, lng: -1.8577 },
    { nombre: 'Ciudad Real', capital: 'Ciudad Real', lat: 38.986, lng: -4.02 },
    { nombre: 'Cuenca', capital: 'Cuenca', lat: 40.0704, lng: -2.1374 },
    { nombre: 'Guadalajara', capital: 'Guadalajara', lat: 40.6295, lng: -3.165 },
    { nombre: 'Toledo', capital: 'Toledo', lat: 39.8628, lng: -4.0273 },
  ],
  'Castilla y León': [
    { nombre: 'Ávila', capital: 'Ávila', lat: 40.6566, lng: -4.7003 },
    { nombre: 'Burgos', capital: 'Burgos', lat: 42.3463, lng: -3.6967 },
    { nombre: 'León', capital: 'León', lat: 42.5987, lng: -5.5671 },
    { nombre: 'Palencia', capital: 'Palencia', lat: 42.0095, lng: -4.5312 },
    { nombre: 'Salamanca', capital: 'Salamanca', lat: 40.9653, lng: -5.664 },
    { nombre: 'Segovia', capital: 'Segovia', lat: 40.9429, lng: -4.1079 },
    { nombre: 'Soria', capital: 'Soria', lat: 41.7619, lng: -2.465 },
    { nombre: 'Valladolid', capital: 'Valladolid', lat: 41.652, lng: -4.7245 },
    { nombre: 'Zamora', capital: 'Zamora', lat: 41.5035, lng: -5.746 },
  ],
  'Cataluña': [
    { nombre: 'Barcelona', capital: 'Barcelona', lat: 41.3874, lng: 2.1686 },
    { nombre: 'Girona', capital: 'Girona', lat: 41.9794, lng: 2.8199 },
    { nombre: 'Lleida', capital: 'Lleida', lat: 41.6176, lng: 0.62 },
    { nombre: 'Tarragona', capital: 'Tarragona', lat: 41.1189, lng: 1.2445 },
  ],
  'Comunitat Valenciana': [
    { nombre: 'Alicante', capital: 'Alicante', lat: 38.3452, lng: -0.481 },
    { nombre: 'Castellón', capital: 'Castellón de la Plana', lat: 39.9863, lng: -0.0376 },
    { nombre: 'Valencia', capital: 'Valencia', lat: 39.4699, lng: -0.3763 },
  ],
  'Extremadura': [
    { nombre: 'Badajoz', capital: 'Mérida', lat: 38.8804, lng: -6.9732 },
    { nombre: 'Cáceres', capital: 'Cáceres', lat: 39.4751, lng: -6.3725 },
  ],
  'Galicia': [
    { nombre: 'A Coruña', capital: 'A Coruña', lat: 43.3623, lng: -8.4115 },
    { nombre: 'Lugo', capital: 'Lugo', lat: 43.0117, lng: -7.5536 },
    { nombre: 'Ourense', capital: 'Ourense', lat: 42.34, lng: -7.8646 },
    { nombre: 'Pontevedra', capital: 'Vigo', lat: 42.4314, lng: -8.6445 },
  ],
  'La Rioja': [
    { nombre: 'La Rioja', capital: 'Logroño', lat: 42.465, lng: -2.4476 },
  ],
  'Madrid': [
    { nombre: 'Madrid', capital: 'Madrid', lat: 40.4168, lng: -3.7038 },
  ],
  'Murcia': [
    { nombre: 'Murcia', capital: 'Murcia', lat: 37.9922, lng: -1.1307 },
  ],
  'Navarra': [
    { nombre: 'Navarra', capital: 'Pamplona', lat: 42.8125, lng: -1.6458 },
  ],
  'País Vasco': [
    { nombre: 'Álava', capital: 'Vitoria-Gasteiz', lat: 42.8467, lng: -2.6728 },
    { nombre: 'Vizcaya', capital: 'Bilbao', lat: 43.263, lng: -2.935 },
    { nombre: 'Gipuzkoa', capital: 'San Sebastián', lat: 43.3183, lng: -1.9812 },
  ],
  'Ceuta': [
    { nombre: 'Ceuta', capital: 'Ceuta', lat: 35.8894, lng: -5.3213 },
  ],
  'Melilla': [
    { nombre: 'Melilla', capital: 'Melilla', lat: 35.2923, lng: -2.9386 },
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
