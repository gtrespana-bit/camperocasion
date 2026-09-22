/**
 * Estadísticas de precio de mercado por modelo.
 *
 * Esta es la pieza de contenido que nadie más tiene en España: con los
 * anuncios reales del marketplace se calcula qué vale de verdad una Fiat
 * Ducato camper de ocasión, por tramos de antigüedad. Es lo que convierte una
 * página de modelo en algo que Google premia y que la gente enlaza, en lugar
 * de en un listado más.
 *
 * Decisiones que importan, y por qué:
 *
 *  · **Mediana, no media.** Un solo anuncio de 120.000 € desplaza la media y
 *    deja la página mintiendo. La mediana aguanta ese ruido.
 *  · **P25–P75 como "rango normal".** El mínimo y el máximo son casi siempre
 *    un error de tecleo o una joya irrepetible; el rango intercuartílico es lo
 *    que un comprador se va a encontrar de verdad.
 *  · **Mínimo de muestra.** Con 2 anuncios no hay estadística, hay anécdota.
 *    Por debajo de `MIN_MUESTRA` no se publica ningún número: preferimos una
 *    página sin datos a una página con datos inventados. Es la misma regla que
 *    aplicamos con los anuncios de demostración.
 *  · **Se excluyen los `es_demo`.** Los anuncios de ejemplo no son mercado.
 */

/** Por debajo de esto no se publica ninguna estadística. */
export const MIN_MUESTRA = 5

/** Muestra suficiente para hablar de rangos por antigüedad sin hacer el ridículo. */
export const MIN_MUESTRA_TRAMO = 3

/** Precios fuera de esta horquilla son error de tecleo, no mercado. */
export const PRECIO_MINIMO_VALIDO = 500
export const PRECIO_MAXIMO_VALIDO = 400_000

export interface AnuncioMercado {
  precio: number
  anio?: number | null
  km?: number | null
  es_demo?: boolean | null
}

export interface Estadisticas {
  muestra: number
  minimo: number
  maximo: number
  mediana: number
  /** Percentil 25: por debajo están las gangas (y los vehículos con pegas). */
  p25: number
  /** Percentil 75: por encima, lo premium. */
  p75: number
  /** Kilometraje mediano, cuando hay datos suficientes. */
  kmMediana: number | null
  /** Año de matriculación mediano, cuando hay datos suficientes. */
  anioMediano: number | null
}

/** Tramos de antigüedad con los que un comprador razona de verdad. */
export const TRAMOS_ANTIGUEDAD = [
  { id: 'reciente', etiqueta: 'Hasta 3 años', maxEdad: 3 },
  { id: 'media', etiqueta: 'De 4 a 8 años', maxEdad: 8 },
  { id: 'veterana', etiqueta: 'De 9 a 15 años', maxEdad: 15 },
  { id: 'clasica', etiqueta: 'Más de 15 años', maxEdad: Infinity },
] as const

export type TramoId = (typeof TRAMOS_ANTIGUEDAD)[number]['id']

export interface EstadisticasTramo extends Estadisticas {
  id: TramoId
  etiqueta: string
}

/** Precio utilizable: número finito y dentro de la horquilla creíble. */
export function precioValido(precio: unknown): boolean {
  const n = Number(precio)
  return Number.isFinite(n) && n >= PRECIO_MINIMO_VALIDO && n <= PRECIO_MAXIMO_VALIDO
}

/**
 * Percentil por interpolación lineal sobre una lista YA ordenada.
 * Es el método que usan las hojas de cálculo, así que si alguien comprueba
 * nuestros números con Excel le van a cuadrar.
 */
export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0
  if (ordenados.length === 1) return ordenados[0]
  const pos = (ordenados.length - 1) * p
  const bajo = Math.floor(pos)
  const alto = Math.ceil(pos)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo)
}

function medianaDe(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  return Math.round(percentil(ordenados, 0.5))
}

/**
 * Calcula las estadísticas de una lista de anuncios. Devuelve `null` si la
 * muestra no llega al mínimo: quien llame debe enseñar «todavía no hay datos
 * suficientes», nunca un número inventado.
 */
export function calcularEstadisticas(
  anuncios: AnuncioMercado[],
  minimo = MIN_MUESTRA
): Estadisticas | null {
  const utiles = anuncios.filter(a => !a.es_demo && precioValido(a.precio))
  if (utiles.length < minimo) return null

  const precios = utiles.map(a => Number(a.precio)).sort((a, b) => a - b)
  const kms = utiles.map(a => Number(a.km)).filter(k => Number.isFinite(k) && k > 0)
  const anios = utiles.map(a => Number(a.anio)).filter(a => Number.isFinite(a) && a > 1950)

  return {
    muestra: utiles.length,
    minimo: Math.round(precios[0]),
    maximo: Math.round(precios[precios.length - 1]),
    mediana: Math.round(percentil(precios, 0.5)),
    p25: Math.round(percentil(precios, 0.25)),
    p75: Math.round(percentil(precios, 0.75)),
    kmMediana: kms.length >= MIN_MUESTRA_TRAMO ? medianaDe(kms) : null,
    anioMediano: anios.length >= MIN_MUESTRA_TRAMO ? medianaDe(anios) : null,
  }
}

/**
 * Estadísticas por tramo de antigüedad. Solo devuelve los tramos con muestra
 * suficiente, así que la tabla puede salir con dos filas en lugar de cuatro:
 * es preferible a rellenar huecos con cifras que no se sostienen.
 */
export function estadisticasPorTramo(
  anuncios: AnuncioMercado[],
  anioReferencia = new Date().getFullYear()
): EstadisticasTramo[] {
  const resultado: EstadisticasTramo[] = []
  let edadMinima = 0

  for (const tramo of TRAMOS_ANTIGUEDAD) {
    const delTramo = anuncios.filter(a => {
      const anio = Number(a.anio)
      if (!Number.isFinite(anio) || anio < 1950) return false
      const edad = anioReferencia - anio
      return edad >= edadMinima && edad <= tramo.maxEdad
    })

    const est = calcularEstadisticas(delTramo, MIN_MUESTRA_TRAMO)
    if (est) resultado.push({ ...est, id: tramo.id, etiqueta: tramo.etiqueta })

    edadMinima = tramo.maxEdad + 1
  }

  return resultado
}

/**
 * Sitúa un precio concreto respecto al mercado. Es lo que permite decirle al
 * vendedor «tu anuncio está un 20 % por encima de la mediana» y al comprador
 * «esto es barato para lo que se pide normalmente».
 */
export type PosicionPrecio = 'chollo' | 'economico' | 'mercado' | 'premium' | 'caro'

export interface Valoracion {
  posicion: PosicionPrecio
  etiqueta: string
  /** Diferencia porcentual respecto a la mediana. Negativo = más barato. */
  difMediana: number
}

export function valorarPrecio(precio: number, est: Estadisticas): Valoracion {
  const difMediana = Math.round(((precio - est.mediana) / est.mediana) * 100)

  let posicion: PosicionPrecio
  if (precio < est.p25 * 0.9) posicion = 'chollo'
  else if (precio < est.p25) posicion = 'economico'
  else if (precio <= est.p75) posicion = 'mercado'
  else if (precio <= est.p75 * 1.15) posicion = 'premium'
  else posicion = 'caro'

  const etiquetas: Record<PosicionPrecio, string> = {
    chollo: 'Muy por debajo del mercado',
    economico: 'Por debajo del precio habitual',
    mercado: 'En precio de mercado',
    premium: 'Por encima del precio habitual',
    caro: 'Muy por encima del mercado',
  }

  return { posicion, etiqueta: etiquetas[posicion], difMediana }
}

/**
 * Frase para la meta description y el encabezado. Se escribe aquí para que
 * las 95 páginas de modelo no repitan el mismo texto palabra por palabra
 * (contenido duplicado) y para que los números salgan siempre de la misma
 * fuente que la tabla.
 */
export function resumenMercado(nombre: string, est: Estadisticas | null): string {
  if (!est) {
    return `Anuncios de ${nombre} de ocasión en España. Precios, kilometraje y equipamiento de cada unidad en venta.`
  }
  const fmt = (n: number) => `${n.toLocaleString('es-ES')} €`
  return `Una ${nombre} de ocasión cuesta ${fmt(est.mediana)} de media en España (${est.muestra} anuncios analizados). Lo habitual es pagar entre ${fmt(est.p25)} y ${fmt(est.p75)}.`
}
