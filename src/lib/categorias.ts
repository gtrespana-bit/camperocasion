/**
 * Categorías y campos técnicos de CamperOcasión.
 *
 * Mercado vertical 100% camper: una categoría principal
 * (Furgonetas Camper y Autocaravanas) con 7 subcategorías y campos técnicos
 * específicos (mecánica, distintivo DGT, homologación, habitabilidad y
 * equipamiento/autonomía camper).
 */

export interface CatField {
  label: string
  type: 'text' | 'number' | 'select'
  placeholder: string
  options?: string[]
}

export interface CatSub {
  label: string
  icon: string
  /** Slug para URLs de SEO programático (/[provincia]/gran-volumen). */
  slug: string
  marcas: string[]
  campos: CatField[]
}

export interface CatConfig {
  label: string
  icon: string
  slug: string
  subs: CatSub[]
}

let _anos: string[] | undefined
function aniosSelect(): string[] {
  if (!_anos) {
    const c = new Date().getFullYear()
    _anos = Array.from({ length: 30 }, (_, i) => String(c - i))
  }
  return _anos
}

// ── Opciones compartidas (fuente única de verdad de los filtros) ─────────

export const OPCIONES_DGT = [
  'Cero Emisiones',
  'ECO',
  'C (Verde)',
  'B (Amarillo)',
  'Sin distintivo',
] as const

export const OPCIONES_HOMOLOGACION = [
  'Vehículo Vivienda (2448 / 3148)',
  'Turismo (1000)',
  'Vehículo Mixto Adaptable (3100)',
  'Furgón (2400)',
] as const

export const OPCIONES_COMBUSTIBLE = ['Diésel', 'Gasolina', 'Híbrido', 'Eléctrico'] as const
export const OPCIONES_TRANSMISION = ['Manual', 'Automática'] as const
export const OPCIONES_TRACCION = ['4x2', '4x4'] as const

// Magnitudes de arquitectura furgonetera. Se capturan como tramos (no como
// número exacto) para que el mismo dato sirva de filtro: un tramo de 3.500 kg
// es la frontera del carnet B, y la longitud/altura deciden garaje y ferry.
export const OPCIONES_MMA = [
  'Hasta 3.500 kg (carnet B)',
  '3.501 - 4.250 kg',
  'Más de 4.250 kg',
] as const

export const OPCIONES_LONGITUD = [
  'Hasta 5,5 m',
  '5,5 - 6,5 m',
  'Más de 6,5 m',
] as const

export const OPCIONES_ALTURA = [
  'Hasta 2,5 m',
  '2,5 - 3,0 m',
  'Más de 3,0 m',
] as const

export const OPCIONES_PLAZAS_VIAJE = ['2', '3', '4', '5', '6'] as const
export const OPCIONES_PLAZAS_DORMIR = ['1', '2', '3', '4', '5+'] as const

export const OPCIONES_CALEFACCION = ['Sí - Diésel', 'Sí - Gas', 'No tiene'] as const
export const OPCIONES_AGUA_CALIENTE = ['Sí', 'No'] as const

export const OPCIONES_BANO = [
  'Ducha interior con agua caliente + WC fijo',
  'Ducha exterior + poti portátil',
  'Cabina de baño completa',
  'Sin baño',
] as const

export const OPCIONES_BATERIA_AUX = ['Litio LiFePO4', 'AGM', 'Gel', 'Sin batería auxiliar'] as const
export const OPCIONES_SI_NO = ['Sí', 'No'] as const

export const OPCIONES_NEVERA = [
  'Compresor 12V',
  'Trivalente gas/12V/220V',
  'Portátil',
  'No',
] as const

// ── Campos técnicos por bloque ────────────────────────────────────────────

/** Bloque "Mecánica del Vehículo". */
const camposMecanica = (tamanos?: string[]): CatField[] => [
  { label: 'Año de matriculación', type: 'select', placeholder: 'Selecciona...' },
  { label: 'Kilómetros', type: 'number', placeholder: 'Ej: 145000' },
  { label: 'Combustible', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_COMBUSTIBLE] },
  { label: 'Transmisión', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_TRANSMISION] },
  { label: 'Potencia (CV)', type: 'number', placeholder: 'Ej: 140' },
  ...(tamanos
    ? [{ label: 'Tamaño chasis', type: 'select' as const, placeholder: 'Selecciona...', options: tamanos }]
    : []),
  { label: 'Tracción', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_TRACCION] },
  { label: 'MMA / Peso máximo autorizado', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_MMA] },
  { label: 'Longitud exterior', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_LONGITUD] },
  { label: 'Altura exterior', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_ALTURA] },
  { label: 'Distintivo Ambiental DGT', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_DGT] },
  { label: 'Homologación', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_HOMOLOGACION] },
]

/** Bloque "Habitabilidad". */
const camposHabitabilidad = (): CatField[] => [
  { label: 'Plazas homologadas para viajar', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_PLAZAS_VIAJE] },
  { label: 'Plazas para dormir', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_PLAZAS_DORMIR] },
]

/** Bloque "Equipamiento Camper y Autonomía". */
const camposCamper = (): CatField[] => [
  { label: 'Calefacción estacionaria', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_CALEFACCION] },
  { label: 'Agua caliente', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_AGUA_CALIENTE] },
  { label: 'Baño / Ducha', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_BANO] },
  { label: 'Depósito agua limpia (litros)', type: 'number', placeholder: 'Ej: 100' },
  { label: 'Batería auxiliar', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_BATERIA_AUX] },
  { label: 'Placa solar', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_SI_NO] },
  { label: 'Placa solar (watios)', type: 'number', placeholder: 'Ej: 200' },
  { label: 'Inversor 220V', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_SI_NO] },
  { label: 'Inversor 220V (watios)', type: 'number', placeholder: 'Ej: 3000' },
  { label: 'Nevera', type: 'select', placeholder: 'Selecciona...', options: [...OPCIONES_NEVERA] },
]

const TAMANOS_GRAN_VOLUMEN = ['L2H2', 'L3H2', 'L3H3', 'L4H2', 'L4H3', 'L5H3']
const TAMANOS_MEDIANA = ['L2H2', 'L3H2']
const TAMANOS_MINI = ['L1', 'L2']

export const categoriasData: Record<string, CatConfig> = {
  camper: {
    label: 'Furgonetas Camper y Autocaravanas',
    icon: '🚐',
    slug: 'camper',
    subs: [
      {
        label: 'Gran Volumen',
        icon: '🚐',
        slug: 'gran-volumen',
        marcas: ['Fiat Ducato', 'Citroën Jumper', 'Peugeot Boxer', 'Renault Master', 'Volkswagen Crafter', 'Mercedes-Benz Sprinter', 'MAN TGE', 'Iveco Daily', 'Ford Transit'],
        campos: [
          ...camposMecanica(TAMANOS_GRAN_VOLUMEN),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Camper Mediana / Compacta',
        icon: '🏕️',
        slug: 'camper-mediana',
        marcas: ['Volkswagen California', 'Volkswagen Transporter', 'Volkswagen Multivan', 'Mercedes Marco Polo', 'Mercedes Vito', 'Ford Transit Custom', 'Renault Trafic', 'Toyota Proace', 'Peugeot Expert Camper', 'Citroën Jumpy Camper'],
        campos: [
          ...camposMecanica(TAMANOS_MEDIANA),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Minicamper',
        icon: '🚙',
        slug: 'minicamper',
        marcas: ['Citroën Berlingo', 'Peugeot Rifter', 'Peugeot Partner', 'Renault Kangoo', 'Volkswagen Caddy', 'Dacia Dokker', 'Fiat Doblò', 'Toyota Proace City'],
        campos: [
          ...camposMecanica(TAMANOS_MINI),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Autocaravana Perfilada',
        icon: '🛖',
        slug: 'perfilada',
        marcas: ['Fiat Ducato Autocaravana', 'Ford Transit Autocaravana', 'Volkswagen Crafter Autocaravana', 'Mercedes-Benz Sprinter Autocaravana', 'Renault Master Autocaravana', 'Iveco Daily Autocaravana', 'Opel Movano Autocaravana'],
        campos: [
          ...camposMecanica(TAMANOS_GRAN_VOLUMEN),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Autocaravana Capuchina',
        icon: '🚌',
        slug: 'capuchina',
        marcas: ['Fiat Ducato Capuchina', 'Ford Transit Capuchina', 'Volkswagen Crafter Capuchina', 'Renault Master Capuchina', 'Opel Movano Capuchina'],
        campos: [
          ...camposMecanica(TAMANOS_GRAN_VOLUMEN),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Autocaravana Integral',
        icon: '🏭',
        slug: 'integral',
        marcas: ['Adria', 'Hymer', 'Challenger', 'Laika', 'Swift', 'Profile', 'Autocamper', 'PIK', 'Benimar', 'BMC', 'Niesmann + Bissel', 'Knaus'],
        campos: [
          ...camposMecanica(),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
      {
        label: 'Célula y 4x4 Overland',
        icon: '🌍',
        slug: 'overland',
        marcas: ['Toyota Hilux Overland', 'Mitsubishi L200', 'Nissan Navara', 'Volkswagen Amarok', 'Ford Ranger', 'Land Rover Defender', 'Dacia Pik-Pik Célula', 'RAM ProMaster Célula'],
        campos: [
          ...camposMecanica(),
          ...camposHabitabilidad(),
          ...camposCamper(),
        ],
      },
    ],
  },
}

// ── Helpers de consulta (mismo contrato que el mercado anterior) ──────────

/** Lista plana de subcategorías de una categoría para búsqueda rápida. */
export function getSubByCategory(catKey: string): { label: string; icon: string; slug: string }[] {
  const cat = categoriasData[catKey]
  return cat ? cat.subs.map(s => ({ label: s.label, icon: s.icon, slug: s.slug })) : []
}

export function getSubConfig(catKey: string, subLabel: string): CatSub | undefined {
  const cat = categoriasData[catKey]
  if (!cat) return undefined
  return cat.subs.find(s => s.label === subLabel)
}

export function getSubBySlug(catKey: string, subSlug: string): CatSub | undefined {
  const cat = categoriasData[catKey]
  if (!cat) return undefined
  return cat.subs.find(s => s.slug === subSlug)
}

export function getMarcaOptions(catKey: string, subLabel: string): string[] {
  const sub = getSubConfig(catKey, subLabel)
  return sub ? sub.marcas : []
}

/** ¿Es este campo el selector de marca de la subcategoría? */
export function esCampoMarca(campo: { label: string; type: string }): boolean {
  return campo.type === 'select' && campo.label.toLowerCase().includes('marca')
}

/** ¿Es este campo el de año de matriculación? */
export function esCampoAnio(campo: { label: string }): boolean {
  const label = campo.label.toLowerCase()
  return label === 'año' || label === 'ano' || label.includes('matriculación') || label.includes('matriculacion')
}

/**
 * Resuelve los campos de una subcategoría dejándolos listos para renderizar.
 *
 * Dos campos resuelven sus opciones dinámicamente para no repetirlas en cada
 * subcategoría:
 *  - `Año de matriculación`: últimos 30 años.
 *  - `Marca`: hereda la lista `marcas` de la propia subcategoría.
 */
export function resolverCampos(sub: CatSub | undefined): CatField[] {
  if (!sub) return []
  return sub.campos.map(campo => {
    if (esCampoAnio(campo)) {
      return { ...campo, options: aniosSelect() }
    }
    if (esCampoMarca(campo) && !campo.options?.length) {
      return { ...campo, options: [...sub.marcas] }
    }
    return { ...campo, options: campo.options || [] }
  })
}

/** Nombres de campo para agrupar la ficha técnica del detalle de producto. */
export const GRUPOS_FICHA_TECNICA: { titulo: string; icon: string; campos: string[] }[] = [
  {
    titulo: 'Mecánica del Vehículo',
    icon: '🔧',
    campos: [
      'Año de matriculación',
      'Kilómetros',
      'Combustible',
      'Transmisión',
      'Potencia (CV)',
      'Tamaño chasis',
      'Tracción',
      'MMA / Peso máximo autorizado',
      'Longitud exterior',
      'Altura exterior',
      'Distintivo Ambiental DGT',
      'Homologación',
      'Año',
      'Kilometraje (km)',
    ],
  },
  {
    titulo: 'Habitabilidad',
    icon: '🛏️',
    campos: ['Plazas homologadas para viajar', 'Plazas para dormir'],
  },
  {
    titulo: 'Equipamiento Camper y Autonomía',
    icon: '⚡',
    campos: [
      'Calefacción estacionaria',
      'Agua caliente',
      'Baño / Ducha',
      'Depósito agua limpia (litros)',
      'Batería auxiliar',
      'Placa solar',
      'Placa solar (watios)',
      'Inversor 220V',
      'Inversor 220V (watios)',
      'Nevera',
    ],
  },
]

/** Agrupa las especificaciones guardadas por bloque de ficha técnica. */
export function agruparFichaTecnica(
  especificaciones: Record<string, string> | null | undefined
): { titulo: string; icon: string; filas: [string, string][] }[] {
  if (!especificaciones) return []
  const usados = new Set<string>()
  return GRUPOS_FICHA_TECNICA.map(grupo => {
    const filas: [string, string][] = []
    for (const campo of grupo.campos) {
      const v = especificaciones[campo]
      if (v && !usados.has(campo)) {
        filas.push([campo, v])
        usados.add(campo)
      }
    }
    return { titulo: grupo.titulo, icon: grupo.icon, filas }
  }).filter(g => g.filas.length > 0)
}

/** Campos "extra" que no pertenecen a ningún grupo conocido. */
export function camposFichaExtras(
  especificaciones: Record<string, string> | null | undefined
): [string, string][] {
  if (!especificaciones) return []
  const conocidos = new Set(GRUPOS_FICHA_TECNICA.flatMap(g => g.campos))
  return Object.entries(especificaciones).filter(([k, v]) => v && !conocidos.has(k))
}
