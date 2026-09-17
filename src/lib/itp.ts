/**
 * ITP de compraventa de vehículos usados (Fase 0.3).
 *
 * QUÉ ES ESTO
 * El ITP (Impuesto sobre Transmisiones Patrimoniales) es el impuesto que paga
 * el COMPRADOR cuando compra un vehículo usado a un PARTICULAR. Es un impuesto
 * cedido a las comunidades autónomas, así que el tipo y las especialidades
 * cambian de una a otra: entre el 3 % de Galicia y el 6 % de Cantabria,
 * Castilla-La Mancha, Comunitat Valenciana y Extremadura, con tipos
 * incrementados (8 %) en varias comunidades para vehículos de más de 15 CV
 * fiscales y cuotas fijas para vehículos antiguos.
 *
 * DECISIONES DE DISEÑO
 *  - Los tipos viven en un REGISTRO declarativo (`TIPOS_ITP`), no repartidos por
 *    el código: se actualizan cada año con una orden autonómica y esta tabla es
 *    lo único que hay que tocar. `REVISADO_EN` deja constancia de la fecha.
 *  - Las rarezas por comunidad (tipo incrementado por potencia fiscal, cuotas
 *    fijas, exenciones por antigüedad o por etiqueta cero emisiones) se modelan
 *    como DATOS, y el cálculo devuelve la lista de reglas aplicadas para que la
 *    UI pueda explicar el resultado en vez de mostrar un número opaco.
 *  - La base imponible es, por ley, la MAYOR entre el precio pactado y el valor
 *    de las tablas oficiales de Hacienda (Orden HAC/1501/2025 para 2026) una vez
 *    aplicado el coeficiente de depreciación por antigüedad (anexo IV de esa
 *    misma orden). El usuario puede introducir ese valor de tablas o dejarlo
 *    vacío: en ese caso se calcula solo con el precio y se avisa de que
 *    Hacienda puede liquidar sobre el valor oficial si resulta mayor.
 */

/** Fecha de la última revisión manual de la tabla de tipos. */
export const REVISADO_EN = '2026-09'
export const EJERCICIO_FISCAL = 2026

/**
 * Coeficientes de depreciación por antigüedad (anexo IV de la orden anual de
 * precios medios de venta). El porcentaje se aplica al precio medio de venta
 * del vehículo nuevo para obtener su valor fiscal.
 */
export const COEFICIENTES_DEPRECIACION: { hasta: number; coeficiente: number }[] = [
  { hasta: 1, coeficiente: 1 },      // hasta 1 año
  { hasta: 2, coeficiente: 0.84 },
  { hasta: 3, coeficiente: 0.67 },
  { hasta: 4, coeficiente: 0.56 },
  { hasta: 5, coeficiente: 0.47 },
  { hasta: 6, coeficiente: 0.39 },
  { hasta: 7, coeficiente: 0.34 },
  { hasta: 8, coeficiente: 0.28 },
  { hasta: 9, coeficiente: 0.24 },
  { hasta: 10, coeficiente: 0.19 },
  { hasta: 11, coeficiente: 0.17 },
  { hasta: 12, coeficiente: 0.13 },
  { hasta: Infinity, coeficiente: 0.1 }, // más de 12 años
]

/** Cuota fija para vehículos antiguos, por tramos de cilindrada. */
export interface TramoCuotaFija {
  /** Cilindrada máxima en cc (el último tramo usa Infinity). */
  hastaCc: number
  /** Cuota fija en euros. */
  cuota: number
  /** Con esta cuota no se presenta autoliquidación. */
  sinAutoliquidar?: boolean
}

export interface ComunidadITP {
  slug: string
  nombre: string
  /** Tipo general en porcentaje (4 = 4 %). */
  tipo: number
  /**
   * Tipo incrementado (por potencia fiscal o por cilindrada). Varias comunidades
   * suben del tipo general al 8 % para vehículos grandes, que en campers es
   * habitual: una autocaravana suele pasar de los 15 CV fiscales y de 2.000 cc.
   */
  tipoIncrementado?: {
    tipo: number
    /** CV fiscales por encima de los cuales aplica (> este valor). */
    masDeCVFiscales?: number
    /** Cilindrada por encima de la cual aplica (> este valor). */
    masDeCc?: number
    /** A qué vehículos aplica, tal como lo redacta la norma. */
    aplica: string
  }
  /** Tipo para vehículos con distintivo medioambiental cero emisiones. */
  tipoCeroEmisiones?: number
  /** Tipo para vehículos con distintivo ECO. */
  tipoEco?: number
  /** Cuota fija por antigüedad (vehículos "antiguos"). */
  cuotaFija?: {
    /** Años de antigüedad a partir de los cuales aplica. */
    minAnios: number
    tramos: TramoCuotaFija[]
    /** Aplica a estas clases de vehículo (matiz importante en campers). */
    aplicaA: string
    /** Límite de valor por debajo del cual aplica la cuota fija. */
    valorMaximo?: number
  }
  /** Exención por antigüedad (Navarra, Cataluña). */
  exencionPorAntiguedad?: {
    minAnios: number
    /** Valor máximo del vehículo para acogerse (si la norma lo fija). */
    valorMaximo?: number
    aplicaA: string
  }
  /** Plazo de autoliquidación en días (naturales si no se indica otra cosa). */
  plazoDias: number
  /** Plazo en días hábiles (algunas comunidades cuentan así). */
  plazoDiasHabiles?: boolean
  /** Modelo de autoliquidación. */
  modelo: string
  /** Observaciones que se muestran en la landing de la comunidad. */
  notas: string[]
  /** Fuente oficial para verificar el dato. */
  fuente: string
}

/**
 * Tipos de ITP por comunidad autónoma, revisados en septiembre de 2026.
 *
 * ⚠️ Tabla ORIENTATIVA: los tipos cambian por ley autonómica (a veces cada
 * año). Antes de tomar una decisión, contrasta con la fuente oficial que
 * acompaña a cada entrada. Este registro es el único sitio a tocar.
 */
export const TIPOS_ITP: ComunidadITP[] = [
  {
    slug: 'andalucia',
    nombre: 'Andalucía',
    tipo: 4,
    tipoIncrementado: { tipo: 8, masDeCVFiscales: 15, aplica: 'turismos y todoterrenos de más de 15 CV fiscales' },
    tipoCeroEmisiones: 1,
    plazoDias: 60,
    modelo: '621',
    notas: [
      'Tipo general del 4 %. Sube al 8 % en turismos y todoterrenos de más de 15 CV fiscales, un umbral que una autocaravana grande supera con facilidad.',
      'Los vehículos de cero emisiones tributan al 1 %.',
      'Plazo de dos meses desde la firma del contrato.',
    ],
    fuente: 'https://www.juntadeandalucia.es/agenciatributaria/',
  },
  {
    slug: 'aragon',
    nombre: 'Aragón',
    tipo: 4,
    cuotaFija: {
      minAnios: 10,
      aplicaA: 'turismos y todoterrenos',
      tramos: [
        { hastaCc: 1000, cuota: 0, sinAutoliquidar: true },
        { hastaCc: 1500, cuota: 20 },
        { hastaCc: 2000, cuota: 30 },
        { hastaCc: Infinity, cuota: 30 },
      ],
    },
    plazoDias: 30,
    modelo: '620 / 621 / 623',
    notas: [
      'Tipo general del 4 %.',
      'A partir de 10 años de antigüedad la cuota es fija por cilindrada; por debajo de 1.000 cc no hay ni que autoliquidar.',
      'La cuota fija está prevista para turismos y todoterrenos: en campers homologados como vehículo vivienda conviene confirmarlo con la hacienda aragonesa.',
    ],
    fuente: 'https://www.aragon.es/organismos/departamento-de-hacienda-y-administracion-publica',
  },
  {
    slug: 'asturias',
    nombre: 'Asturias',
    tipo: 4,
    tipoIncrementado: { tipo: 8, masDeCVFiscales: 15, aplica: 'turismos y todoterrenos de más de 15 CV fiscales' },
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620',
    notas: [
      'Tipo general del 4 %, con el 8 % para más de 15 CV fiscales.',
      'Sin cuotas fijas por antigüedad.',
    ],
    fuente: 'https://sede.asturias.es/',
  },
  {
    slug: 'baleares',
    nombre: 'Islas Baleares',
    tipo: 4,
    tipoIncrementado: { tipo: 8, masDeCVFiscales: 15, aplica: 'turismos y todoterrenos de más de 15 CV fiscales' },
    tipoCeroEmisiones: 0,
    tipoEco: 2,
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 4 %, con el 8 % para más de 15 CV fiscales.',
      'Cero emisiones al 0 % y distintivo ECO al 2 %.',
    ],
    fuente: 'https://www.atib.es/',
  },
  {
    slug: 'canarias',
    nombre: 'Canarias',
    tipo: 5.5,
    cuotaFija: {
      minAnios: 10,
      aplicaA: 'turismos y todoterrenos',
      tramos: [
        { hastaCc: 1000, cuota: 40 },
        { hastaCc: 1500, cuota: 70 },
        { hastaCc: 2000, cuota: 115 },
        { hastaCc: Infinity, cuota: 0 }, // mayores cilindradas: se aplica el tipo general
      ],
    },
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 5,5 %.',
      'Con 10 años o más, cuota fija de 40 € / 70 € / 115 € según cilindrada; por encima de 2.000 cc se vuelve al tipo general.',
      'En Canarias la compra a un profesional tributa por IGIC, no por IVA.',
    ],
    fuente: 'https://www.gobiernodecanarias.org/tributos/',
  },
  {
    slug: 'cantabria',
    nombre: 'Cantabria',
    tipo: 6,
    cuotaFija: {
      minAnios: 10,
      aplicaA: 'turismos y todoterrenos',
      tramos: [
        { hastaCc: 999, cuota: 45 },
        { hastaCc: 1499, cuota: 60 },
        { hastaCc: 1999, cuota: 90 },
        { hastaCc: Infinity, cuota: 0 }, // desde 2.000 cc: tipo general
      ],
    },
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620 / 621',
    notas: [
      'Tipo general del 6 % (bajó desde el 8 % que aún aparece en muchas webs).',
      'Con 10 años o más y hasta 2.000 cc, cuota fija de 45 € / 60 € / 90 €.',
      'La cuota fija se refiere a turismos y todoterrenos; en vehículos vivienda conviene confirmar el encuadre con la hacienda cántabra.',
    ],
    fuente: 'https://www.agenciacantabriadeadministraciontributaria.es/',
  },
  {
    slug: 'castilla-la-mancha',
    nombre: 'Castilla-La Mancha',
    tipo: 6,
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 6 %, sin cuotas fijas ni exenciones por antigüedad.',
    ],
    fuente: 'https://www.jccm.es/tributos',
  },
  {
    slug: 'castilla-y-leon',
    nombre: 'Castilla y León',
    tipo: 5,
    tipoIncrementado: { tipo: 8, masDeCVFiscales: 15, aplica: 'turismos y todoterrenos de más de 15 CV fiscales' },
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620',
    notas: [
      'Tipo general del 5 %, con el 8 % para más de 15 CV fiscales.',
      'Sin cuotas fijas por antigüedad.',
    ],
    fuente: 'https://tributos.jcyl.es/',
  },
  {
    slug: 'cataluna',
    nombre: 'Cataluña',
    tipo: 5,
    tipoCeroEmisiones: 0,
    exencionPorAntiguedad: {
      minAnios: 10,
      valorMaximo: 40000,
      aplicaA: 'turismos y todoterrenos',
    },
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 5 %.',
      'Los vehículos de más de 10 años no se autoliquidan salvo que sean históricos o su valor superase 40.000 € en el primer año.',
      'Cero emisiones al 0 %.',
    ],
    fuente: 'https://atc.gencat.cat/',
  },
  {
    slug: 'comunitat-valenciana',
    nombre: 'Comunitat Valenciana',
    tipo: 6,
    tipoIncrementado: { tipo: 8, masDeCc: 2000, aplica: 'vehículos de más de 2.000 cc y vehículos históricos' },
    cuotaFija: {
      minAnios: 12,
      valorMaximo: 20000,
      aplicaA: 'vehículos no históricos',
      tramos: [
        { hastaCc: 1500, cuota: 40 },
        { hastaCc: 2000, cuota: 60 },
        { hastaCc: Infinity, cuota: 140 },
      ],
    },
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 6 %, con el 8 % para más de 2.000 cc.',
      'Con más de 12 años y valor por debajo de 20.000 €, cuota fija de 40 € / 60 € / 140 €.',
    ],
    fuente: 'https://hisenda.gva.es/',
  },
  {
    slug: 'extremadura',
    nombre: 'Extremadura',
    tipo: 6,
    plazoDias: 30,
    modelo: '620 / 623',
    notas: [
      'Tipo general del 6 %.',
      'Tipo reducido del 4 % para vehículos comerciales ligeros afectos a una actividad económica.',
      'Sin cuotas fijas por antigüedad.',
    ],
    fuente: 'https://www.juntaex.es/temas/hacienda',
  },
  {
    slug: 'galicia',
    nombre: 'Galicia',
    tipo: 3,
    tipoCeroEmisiones: 0,
    cuotaFija: {
      minAnios: 15,
      aplicaA: 'turismos y todoterrenos',
      tramos: [
        { hastaCc: 1199, cuota: 22 },
        { hastaCc: 1599, cuota: 38 },
        { hastaCc: Infinity, cuota: 0 }, // cilindradas mayores: tipo general
      ],
    },
    plazoDias: 30,
    modelo: '620',
    notas: [
      'Tipo general del 3 % desde 2024: es el más bajo de España.',
      'Cero emisiones al 0 %.',
      'Con 15 años o más y hasta 1.599 cc, cuota fija de 22 € o 38 €.',
    ],
    fuente: 'https://www.atriga.gal/es_ES/tributos/compraventa-de-vehiculos/informacion-do-tributo',
  },
  {
    slug: 'la-rioja',
    nombre: 'La Rioja',
    tipo: 4,
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620',
    notas: ['Tipo general del 4 %, sin cuotas ni exenciones por antigüedad.'],
    fuente: 'https://www.larioja.org/hacienda',
  },
  {
    slug: 'madrid',
    nombre: 'Comunidad de Madrid',
    tipo: 4,
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620',
    notas: ['Tipo general del 4 %, sin especialidades por antigüedad ni por potencia fiscal.'],
    fuente: 'https://www.comunidad.madrid/servicios/tributos',
  },
  {
    slug: 'murcia',
    nombre: 'Región de Murcia',
    tipo: 4,
    cuotaFija: {
      minAnios: 12,
      aplicaA: 'vehículos',
      tramos: [
        { hastaCc: 1000, cuota: 0, sinAutoliquidar: true },
        { hastaCc: 1500, cuota: 30 },
        { hastaCc: 2000, cuota: 50 },
        { hastaCc: Infinity, cuota: 75 },
      ],
    },
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620',
    notas: [
      'Tipo general del 4 %.',
      'A partir de 12 años, cuota fija por cilindrada: 0 € hasta 1.000 cc (sin autoliquidar), 30 €, 50 € o 75 €.',
    ],
    fuente: 'https://www.atrm.es/',
  },
  {
    slug: 'navarra',
    nombre: 'Comunidad Foral de Navarra',
    tipo: 4,
    exencionPorAntiguedad: {
      minAnios: 10,
      valorMaximo: 40000,
      aplicaA: 'turismos y motocicletas',
    },
    plazoDias: 60,
    modelo: '620',
    notas: [
      'Tipo general del 4 %.',
      'Turismos y motos de 10 o más años están exentos (salvo históricos o valor igual o superior a 40.000 €): no se presenta el modelo.',
      'Régimen foral: la gestión es de Hacienda Foral de Navarra.',
    ],
    fuente: 'https://www.hacienda.navarra.es/',
  },
  {
    slug: 'pais-vasco',
    nombre: 'País Vasco',
    tipo: 4,
    plazoDias: 30,
    plazoDiasHabiles: true,
    modelo: '620 (620-TV en Álava)',
    notas: [
      'Tipo general del 4 %, sin especialidades por antigüedad.',
      'Régimen foral: cada diputación (Álava, Bizkaia, Gipuzkoa) gestiona y puede matizar el trámite.',
    ],
    fuente: 'https://www.euskadi.eus/hacienda-y-finanzas/',
  },
  {
    slug: 'ceuta',
    nombre: 'Ceuta',
    tipo: 4,
    plazoDias: 30,
    modelo: '620',
    notas: ['Tipo general del 4 % con bonificación del 50 % para residentes en Ceuta (efectivo 2 %). Gestión de la AEAT.'],
    fuente: 'https://sede.agenciatributaria.gob.es/',
  },
  {
    slug: 'melilla',
    nombre: 'Melilla',
    tipo: 4,
    plazoDias: 30,
    modelo: '620',
    notas: ['Tipo general del 4 % con bonificación del 50 % para residentes en Melilla (efectivo 2 %). Gestión de la AEAT.'],
    fuente: 'https://sede.agenciatributaria.gob.es/',
  },
]

export function getComunidadITP(slug: string | null | undefined): ComunidadITP | undefined {
  if (!slug) return undefined
  const normalizado = slug.toLowerCase()
  return TIPOS_ITP.find(c => c.slug === normalizado)
}

/** Edad del vehículo en años, a partir del año de matriculación. */
export function edadVehiculo(anioMatriculacion: number, anioReferencia = EJERCICIO_FISCAL): number {
  if (!Number.isFinite(anioMatriculacion)) return 0
  return Math.max(0, anioReferencia - anioMatriculacion)
}

/**
 * Normaliza la etiqueta DGT del usuario a su forma corta ('0' | 'ECO' | 'C' |
 * 'B' | nulo), para que dé igual si escribe "0", "cero emisiones",
 * "C (Verde)", "B (Amarillo)", "ECO", "eco" o lo deja en blanco.
 *
 * Antes la calculadora comparaba el texto del usuario en mayúsculas con las
 * formas largas del select ("C (Verde)"), así que elegir "ECO" o "Cero
 * emisiones" (mayúscula o minúscula) NUNCA activaba los tipos reducidos: ni la
 * suma de cabecera ni la comparativa por comunidades. Esta función es la
 * fuente única de esa normalización y la usan tanto el cálculo como la
 * comparativa.
 */
export function normalizarEtiquetaDGT(valor: string | number | null | undefined): string | null {
  if (valor == null) return null
  const v = String(valor).trim().toLowerCase()

  if (!v) return null
  if (v === '0' || v.startsWith('cero') || v.includes('zero') || v.startsWith('c0')) return '0'
  if (v.startsWith('eco')) return 'ECO'
  if (v.startsWith('c')) return 'C'
  if (v.startsWith('b')) return 'B'
  if (v.includes('sin') || v.includes('no ') || v === 'no') return null // sin distintivo
  return null
}

/** Coeficiente de depreciación aplicable a la edad (anexo IV). */
export function coeficienteDepreciacion(edadAnios: number): number {
  const tramo = COEFICIENTES_DEPRECIACION.find(t => edadAnios < t.hasta)
  return tramo?.coeficiente ?? 0.1
}

export interface EntradaITP {
  /** Comunidad autónoma donde autoliquida el comprador (por residencia). */
  ccaa: string
  /** Precio pactado en el contrato de compraventa. */
  precio: number
  /** Año de matriculación del vehículo. */
  anioMatriculacion: number
  /** Año en que se hace la operación (por defecto, el ejercicio en curso). */
  anioCompra?: number
  /**
   * Precio medio de venta del vehículo nuevo según las tablas de Hacienda.
   * Opcional: si no se indica, la base es el precio pactado.
   */
  valorTablas?: number
  /** CV fiscales del vehículo (para el tipo incrementado). */
  cvFiscales?: number
  /** Cilindrada en cc (para las cuotas fijas). */
  cilindrada?: number
  /** Etiqueta ambiental de la DGT: '0', 'ECO', 'C', 'B' o vacío. */
  etiquetaDGT?: string
}

export interface ReglaAplicada {
  clave: string
  descripcion: string
}

export interface ResultadoITP {
  comunidad: ComunidadITP
  edadAnios: number
  coeficiente: number
  /** Valor fiscal (tablas × coeficiente), solo si se conocía el valor de tablas. */
  valorFiscal: number | null
  /** Mayor entre precio pactado y valor fiscal. */
  baseImponible: number
  /** Tipo aplicado en porcentaje (0 si se aplica cuota fija o exención). */
  tipoAplicado: number
  /** Cuota: cuánto se paga. */
  cuota: number
  /** True si la cuota es un importe fijo y no un porcentaje. */
  cuotaFija: boolean
  /** True si no se presenta autoliquidación. */
  sinAutoliquidar: boolean
  /** Reglas que han decidido el resultado, en orden de aplicación. */
  reglas: ReglaAplicada[]
  /** Avisos a mostrar junto al resultado. */
  avisos: string[]
}

/** Redondeo a céntimos, para no arrastrar errores de coma flotante. */
const eur = (n: number) => Math.round(n * 100) / 100

/** ¿Le aplica a esta operación el tipo incrementado de su comunidad? */
function aplicaIncremento(
  comunidad: ComunidadITP,
  cvFiscales: number | null,
  cilindrada: number | null
): boolean {
  const inc = comunidad.tipoIncrementado
  if (!inc) return false
  if (inc.masDeCVFiscales != null) return cvFiscales != null && cvFiscales > inc.masDeCVFiscales
  if (inc.masDeCc != null) return cilindrada != null && cilindrada > inc.masDeCc
  return false
}

/**
 * Calcula el ITP estimado de una compraventa entre particulares.
 *
 * Orden de decisión (el que sigue la normativa):
 *  1. Exención por antigüedad si la comunidad la tiene y se cumplen condiciones.
 *  2. Cuota fija si el vehículo supera la antigüedad mínima y la comunidad la
 *     tiene para su cilindrada (y por debajo del límite de valor, si aplica).
 *  3. Tipo (general, incrementado por potencia fiscal, cero emisiones o ECO)
 *     aplicado a la base imponible.
 */
export function calcularITP(entrada: EntradaITP): ResultadoITP {
  const comunidad = getComunidadITP(entrada.ccaa)
  if (!comunidad) {
    throw new Error(`Comunidad autónoma desconocida: ${entrada.ccaa}`)
  }

  const anioCompra = entrada.anioCompra || EJERCICIO_FISCAL
  const edadAnios = edadVehiculo(entrada.anioMatriculacion, anioCompra)
  const coeficiente = coeficienteDepreciacion(edadAnios)
  const precio = Math.max(0, Number(entrada.precio) || 0)

  const reglas: ReglaAplicada[] = []
  const avisos: string[] = []

  const valorTablas = Number(entrada.valorTablas) > 0 ? Number(entrada.valorTablas) : null
  const valorFiscal = valorTablas != null ? eur(valorTablas * coeficiente) : null
  const baseImponible = eur(Math.max(precio, valorFiscal || 0))

  reglas.push({
    clave: 'depreciacion',
    descripcion: `Antigüedad de ${edadAnios} ${edadAnios === 1 ? 'año' : 'años'}: coeficiente de depreciación del ${Math.round(coeficiente * 100)} % sobre las tablas de Hacienda.`,
  })

  if (valorFiscal != null) {
    reglas.push({
      clave: 'base',
      descripcion:
        valorFiscal >= precio
          ? `La base imponible es el valor de tablas depreciado (${valorFiscal} €) porque supera el precio pactado (${precio} €).`
          : `La base imponible es el precio pactado (${precio} €) porque supera el valor de tablas depreciado (${valorFiscal} €).`,
    })
  } else {
    avisos.push(
      'No has indicado el precio medio de venta del vehículo nuevo según las tablas de Hacienda: la estimación usa solo el precio pactado. Si el valor oficial depreciado es mayor, Hacienda liquidará sobre él.',
    )
  }

  const etiqueta = normalizarEtiquetaDGT(entrada.etiquetaDGT)
  const cvFiscales = Number(entrada.cvFiscales) > 0 ? Number(entrada.cvFiscales) : null
  const cilindrada = Number(entrada.cilindrada) > 0 ? Number(entrada.cilindrada) : null

  let tipoAplicado = comunidad.tipo
  let cuota = 0
  let esCuotaFija = false
  let sinAutoliquidar = false

  // 1. Exención por antigüedad
  const exencion = comunidad.exencionPorAntiguedad
  const cumpleExencion = !!exencion
    && edadAnios >= exencion.minAnios
    && (exencion.valorMaximo == null || baseImponible < exencion.valorMaximo)

  if (cumpleExencion && exencion) {
    sinAutoliquidar = true
    cuota = 0
    tipoAplicado = 0
    reglas.push({
      clave: 'exencion',
      descripcion: `Con ${exencion.minAnios} años o más ${exencion.aplicaA} no se autoliquida el ITP${exencion.valorMaximo ? ` por debajo de ${exencion.valorMaximo} € de valor` : ''}.`,
    })
  } else if (exencion && edadAnios >= exencion.minAnios) {
    avisos.push(
      `Con ${exencion.minAnios} años o más habrías quedado exento, pero el valor declarado alcanza el límite de ${exencion.valorMaximo} € al que no aplica la exención.`,
    )
  }

  // 2. Cuota fija para vehículos antiguos
  const cf = comunidad.cuotaFija
  const cumpleCuotaFija = !sinAutoliquidar
    && !!cf
    && edadAnios >= cf.minAnios
    && (cf.valorMaximo == null || baseImponible < cf.valorMaximo)
    && cilindrada != null

  if (cumpleCuotaFija && cf) {
    const tramo = cf.tramos.find(t => (cilindrada as number) <= t.hastaCc)!
    if (tramo.cuota > 0 || tramo.sinAutoliquidar) {
      esCuotaFija = true
      sinAutoliquidar = !!tramo.sinAutoliquidar
      cuota = tramo.cuota
      tipoAplicado = 0
      reglas.push({
        clave: 'cuotaFija',
        descripcion: `Vehículo de ${cf.minAnios} años o más con ${cilindrada} cc (${cf.aplicaA}): cuota fija de ${tramo.cuota} €${tramo.sinAutoliquidar ? ', sin necesidad de presentar autoliquidación' : ''}.`,
      })
      if (cf.aplicaA && /turismo/i.test(cf.aplicaA)) {
        avisos.push(
          'La cuota fija está pensada para turismos y todoterrenos. Si el vehículo está homologado como vivienda (2448/3148) o como mixto, confirma el encuadre con la hacienda autonómica.',
        )
      }
    } else {
      reglas.push({
        clave: 'cuotaFija',
        descripcion: `Con ${cf.minAnios} años o más, la cuota fija no cubre esta cilindrada (${cilindrada} cc): se aplica el tipo general.`,
      })
    }
  } else if (cf && edadAnios >= cf.minAnios && cilindrada == null && !sinAutoliquidar) {
    avisos.push(
      `Con ${cf.minAnios} años o más, ${comunidad.nombre} aplica cuota fija según cilindrada. Indica la cilindrada para ver si te sale mejor que el tipo general.`,
    )
  }

  if (!sinAutoliquidar && !esCuotaFija) {
    // 3. Tipo: cero emisiones, ECO, incrementado por potencia fiscal o general
    if (etiqueta === '0' && comunidad.tipoCeroEmisiones != null) {
      tipoAplicado = comunidad.tipoCeroEmisiones
      reglas.push({
        clave: 'ceroEmisiones',
        descripcion: `Distintivo cero emisiones: tipo del ${tipoAplicado} %${tipoAplicado === 0 ? ' (exento)' : ''}.`,
      })
    } else if (etiqueta === 'ECO' && comunidad.tipoEco != null) {
      tipoAplicado = comunidad.tipoEco
      reglas.push({
        clave: 'eco',
        descripcion: `Distintivo ECO: tipo reducido del ${tipoAplicado} %.`,
      })
    } else if (aplicaIncremento(comunidad, cvFiscales, cilindrada)) {
      tipoAplicado = comunidad.tipoIncrementado!.tipo
      const porque = comunidad.tipoIncrementado!.masDeCVFiscales != null
        ? `${cvFiscales} CV fiscales`
        : `${cilindrada} cc`
      reglas.push({
        clave: 'tipoIncrementado',
        descripcion: `Con ${porque} el tipo sube del ${comunidad.tipo} % al ${tipoAplicado} % para ${comunidad.tipoIncrementado!.aplica}.`,
      })
    } else {
      reglas.push({
        clave: 'tipoGeneral',
        descripcion: `Tipo general de ${comunidad.nombre}: ${tipoAplicado} %.`,
      })
      // Si la comunidad tiene tipo reducido por distintivo ambiental y el
      // usuario no ha indicado la etiqueta, se lo avisamos: la cifra que ve es
      // el tipo general, no necesariamente el suyo.
      if (etiqueta == null && (comunidad.tipoCeroEmisiones != null || comunidad.tipoEco != null)) {
        avisos.push(
          comunidad.tipoCeroEmisiones != null && comunidad.tipoEco != null
            ? `En ${comunidad.nombre} los vehículos cero emisiones tributan al ${comunidad.tipoCeroEmisiones} % y los ECO al ${comunidad.tipoEco} %. Indica la etiqueta DGT para ver si te corresponde.`
            : comunidad.tipoCeroEmisiones != null
              ? `En ${comunidad.nombre} los vehículos con distintivo cero emisiones tributan al ${comunidad.tipoCeroEmisiones} %. Indica la etiqueta DGT para ver si te corresponde.`
              : `En ${comunidad.nombre} los vehículos ECO tributan al ${comunidad.tipoEco} %. Indica la etiqueta DGT para ver si te corresponde.`,
        )
      }
      if (comunidad.tipoIncrementado) {
        const inc = comunidad.tipoIncrementado
        if (inc.masDeCVFiscales != null) {
          if (cvFiscales == null) {
            avisos.push(
              `En ${comunidad.nombre} el tipo sube al ${inc.tipo} % para ${inc.aplica}. Indica los CV fiscales (aparecen en el permiso de circulación) para comprobarlo.`,
            )
          } else {
            reglas.push({
              clave: 'tipoIncrementadoNo',
              descripcion: `${cvFiscales} CV fiscales no superan el umbral de ${inc.masDeCVFiscales}: se mantiene el tipo general del ${comunidad.tipo} %.`,
            })
          }
        } else if (inc.masDeCc != null) {
          if (cilindrada == null) {
            avisos.push(
              `En ${comunidad.nombre} el tipo sube al ${inc.tipo} % para ${inc.aplica}. Indica la cilindrada de la ficha técnica para comprobarlo.`,
            )
          } else {
            reglas.push({
              clave: 'tipoIncrementadoNo',
              descripcion: `${cilindrada} cc no superan el umbral de ${inc.masDeCc} cc: se mantiene el tipo general del ${comunidad.tipo} %.`,
            })
          }
        }
      }
    }
    cuota = eur(baseImponible * (tipoAplicado / 100))
  }

  // Sin cuota que ingresar no hay autoliquidación que presentar; aun así hace
  // falta el justificante (o la declaración de no sujeción) para el cambio de
  // nombre en la DGT: es lo que más se olvida en las compras entre particulares.
  if (sinAutoliquidar) {
    avisos.push(
      'Aun sin cuota que ingresar, guarda el contrato y el justificante de la no sujeción: la DGT los pide para el cambio de nombre.',
    )
  }

  return {
    comunidad,
    edadAnios,
    coeficiente,
    valorFiscal,
    baseImponible,
    tipoAplicado,
    cuota,
    cuotaFija: esCuotaFija,
    sinAutoliquidar,
    reglas,
    avisos,
  }
}

/** Coste del cambio de nombre en la DGT (tasa 2026). */
export const TASA_DGT = 55.7

/** Comunidades con cuota fija para vehículos antiguos (para el copy y los filtros). */
export const CCAA_CON_CUOTA_FIJA = TIPOS_ITP.filter(c => c.cuotaFija).map(c => c.nombre)

/** Comparativa: cuánto se pagaría en cada comunidad con la misma operación. */
export function compararComunidades(
  entrada: Omit<EntradaITP, 'ccaa'>
): { comunidad: ComunidadITP; cuota: number; cuotaFija: boolean; sinAutoliquidar: boolean }[] {
  return TIPOS_ITP
    .map(comunidad => {
      const r = calcularITP({ ...entrada, ccaa: comunidad.slug })
      return { comunidad, cuota: r.cuota, cuotaFija: r.cuotaFija, sinAutoliquidar: r.sinAutoliquidar }
    })
    .sort((a, b) => a.cuota - b.cuota)
}

/**
 * Checklist de compra segura. Contenido estático que se muestra en la
 * calculadora y en cada landing autonómica — el comprador de una camper de
 * segunda mano tiene un riesgo específico (reformas sin legalizar, plazas
 * declaradas que no coinciden con la ficha técnica).
 */
export interface ItemChecklist {
  titulo: string
  detalle: string
  /** Documento a pedir o comprobación a hacer. */
  donde: string
}

export const CHECKLIST_COMPRA_SEGURA: ItemChecklist[] = [
  {
    titulo: 'Permiso de circulación a nombre del vendedor',
    detalle:
      'Comprueba que el titular coincide con quien firma y con su DNI. Si el vehículo está a nombre de otra persona o de una empresa, hace falta autorización o poder.',
    donde: 'Permiso de circulación (DGT)',
  },
  {
    titulo: 'Ficha técnica (tarjeta ITV) sin reformas pendientes',
    detalle:
      'Es el documento clave en una camper: en ella se ve la homologación (2448/3148 vehículo vivienda, 3100 mixto, 2400 furgón), la MMA, las plazas homologadas y las reformas legalizadas. Si el anuncio declara 4 plazas para dormir pero la ficha no las recoge, no pasa la ITV.',
    donde: 'Ficha técnica del vehículo',
  },
  {
    titulo: 'ITV en vigor',
    detalle:
      'Mira la fecha de caducidad y las anotaciones. Un vehículo vivienda con más de 10 años pasa ITV cada año.',
    donde: 'Tarjeta ITV + informe de la estación',
  },
  {
    titulo: 'Certificados de las reformas',
    detalle:
      'Ventanillas, techo elevable, cambio de plazas, instalación de gas o solar: cada reforma necesita su proyecto y su legalización. Sin los certificados, la reforma no existe para la Administración.',
    donde: 'Certificados del taller homologado + anotación en ficha técnica',
  },
  {
    titulo: 'Proyecto de homologación (vehículo vivienda)',
    detalle:
      'Si el anuncio declara vehículo vivienda, pide el proyecto y el certificado de la camperización. En CamperOcasión el vendedor puede subirlos al expediente y el anuncio muestra el sello de homologación verificada.',
    donde: 'Expediente del vehículo del anuncio (sello de homologación)',
  },
  {
    titulo: 'Informe de la DGT: cargas, precintos y titularidad',
    detalle:
      'Un informe de vehículo te dice si hay reserva de dominio, embargos o precintos pendientes que impedirían el cambio de nombre.',
    donde: 'Informe de vehículos de la DGT (8,67 € aprox.)',
  },
  {
    titulo: 'Deudas del vehículo: IVTM y multas',
    detalle:
      'El impuesto municipal de circulación (IVTM) del año en curso lo paga quien figura como titular el 1 de enero. Las multas son del conductor, pero un cambio de nombre con deudas pendientes es un problema.',
    donde: 'Ayuntamiento (IVTM) y sede de la DGT (multas)',
  },
  {
    titulo: 'Contrato de compraventa completo',
    detalle:
      'Datos de las dos partes, precio, fecha, kilómetros, matrícula, bastidor y estado de pagos. Es lo que necesitas para liquidar el ITP y lo que te protege si algo se tuerce.',
    donde: 'Contrato de compraventa (dos copias)',
  },
  {
    titulo: 'Coherencia de kilómetros y mantenimiento',
    detalle:
      'Contrasta los km con las ITV anteriores (el informe oficial trae el historial) y pide facturas de distribución, embrague o cambio de aceite.',
    donde: 'Historial de ITV + libro de mantenimiento',
  },
  {
    titulo: 'Cambio de nombre en 30 días',
    detalle:
      'Sin el justificante del ITP del comprador la DGT no transfiere la titularidad. Preséntalo dentro del plazo de tu comunidad para no pagar recargos.',
    donde: 'Modelo 620/621 + tasa DGT',
  },
]

/** Checklist específico de campers y autocaravanas (lo que se llevan los despistes). */
export const CHECKLIST_CAMPER: ItemChecklist[] = [
  {
    titulo: 'Homologación declarada',
    detalle:
      '"Vehículo Vivienda (2448/3148)" permite viajar y dormir legalmente; "Furgón (2400)" no. Comprueba que lo que dice el anuncio es lo que figura en la ficha técnica.',
    donde: 'Ficha técnica, campo de clasificación',
  },
  {
    titulo: 'Plazas para viajar y para dormir',
    detalle:
      'Las plazas homologadas para viajar son las que pueden ir sentadas; dormir no siempre obliga a legalizar reformas, pero si el vendedor cambió asientos, sí.',
    donde: 'Ficha técnica + anotaciones de reformas',
  },
  {
    titulo: 'MMA y carnet',
    detalle:
      'Hasta 3.500 kg se conduce con carnet B. Si el vehículo está en 3.501-4.250 kg (carnet B+ o C1 según el caso) el seguro y las ITV cambian.',
    donde: 'Ficha técnica (MMA)',
  },
  {
    titulo: 'Instalación de gas y eléctrica',
    detalle:
      'Bombonas, calefacción estacionaria y 220 V deben estar instaladas y certificadas. Es la reforma que más se salta y la que más sustos da en la ITV.',
    donde: 'Certificado de instalación + revisión',
  },
  {
    titulo: 'Carga útil real',
    detalle:
      'Con agua, baterías y equipamiento, muchas campers quedan al límite de MMA. Verifica pesos en báscula si vas a cargar para viajes largos.',
    donde: 'Báscula pública + ficha técnica',
  },
]
