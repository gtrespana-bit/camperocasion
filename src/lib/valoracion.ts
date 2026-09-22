/**
 * Valorador: «¿cuánto vale mi camper?».
 *
 * Es el lead-magnet del negocio: captura al vendedor ANTES de que se vaya a
 * publicar a otro sitio. Le damos una cifra útil y a cambio entra en el
 * embudo de publicación.
 *
 * Cómo se calcula, por orden de preferencia:
 *
 *  1. **Mercado real** — si hay anuncios suficientes de ese modelo en
 *     CamperOcasión, se parte de su mediana y se ajusta por antigüedad y
 *     kilómetros. Es la estimación buena: son precios que alguien está
 *     pidiendo hoy en España.
 *  2. **Depreciación** — si no hay muestra, se parte del precio de nuevo
 *     declarado por el usuario y se aplican los coeficientes del anexo IV
 *     que ya usamos para el ITP (`src/lib/itp.ts`).
 *  3. **Nada** — si no hay ni una cosa ni la otra, NO se inventa un número.
 *
 * Igual que en las páginas de modelo: preferimos no dar cifra a dar una que no
 * se sostenga. Un valorador que se equivoca por arriba genera vendedores
 * frustrados cuando nadie les compra; por abajo, vendedores que malvenden y
 * nos culpan.
 */
import { coeficienteDepreciacion } from '@/lib/itp'
import type { Estadisticas } from '@/lib/precios-mercado'

/** Kilometraje anual que se considera «normal» en una camper en España. */
export const KM_ANUALES_NORMALES = 12_000

/** Tope del ajuste por kilómetros, arriba y abajo. */
export const AJUSTE_KM_MAXIMO = 0.2

/** Amplitud de la horquilla que se muestra al usuario (±%). */
export const AMPLITUD_HORQUILLA = 0.12

export interface EntradaValoracion {
  /** Valor canónico del modelo (`productos.marca`). */
  modelo: string
  anio: number
  km: number
  /** Precio del vehículo cuando era nuevo, si el usuario lo sabe. Opcional. */
  precioNuevo?: number | null
  /** Estado general declarado por el vendedor. */
  estado?: EstadoVehiculo
}

export type EstadoVehiculo = 'excelente' | 'bueno' | 'correcto' | 'mejorable'

/**
 * Cuánto mueve el precio el estado declarado. Conservador a propósito: el
 * estado lo declara el propio vendedor, que casi siempre tira hacia arriba.
 */
export const FACTOR_ESTADO: Record<EstadoVehiculo, number> = {
  excelente: 1.08,
  bueno: 1.0,
  correcto: 0.92,
  mejorable: 0.8,
}

export const ESTADOS_VEHICULO: { id: EstadoVehiculo; etiqueta: string; descripcion: string }[] = [
  { id: 'excelente', etiqueta: 'Excelente', descripcion: 'Impecable, sin golpes ni averías, mantenimiento al día' },
  { id: 'bueno', etiqueta: 'Bueno', descripcion: 'Uso normal, algún detalle estético menor' },
  { id: 'correcto', etiqueta: 'Correcto', descripcion: 'Se nota el uso, funciona todo' },
  { id: 'mejorable', etiqueta: 'Mejorable', descripcion: 'Necesita reparaciones o reforma' },
]

export type FuenteValoracion = 'mercado' | 'depreciacion'

export interface ResultadoValoracion {
  /** Estimación central, redondeada a 100 €. */
  estimado: number
  /** Horquilla realista que se enseña al usuario. */
  minimo: number
  maximo: number
  fuente: FuenteValoracion
  /** Tamaño de la muestra cuando la fuente es el mercado. */
  muestra: number | null
  /** Explicación de cada ajuste aplicado, para que la cifra sea auditable. */
  ajustes: AjusteAplicado[]
  /** Aviso honesto sobre la fiabilidad de esta estimación concreta. */
  confianza: 'alta' | 'media' | 'baja'
}

export interface AjusteAplicado {
  concepto: string
  detalle: string
  /** Factor multiplicador aplicado (1 = neutro). */
  factor: number
}

const redondear100 = (n: number) => Math.max(500, Math.round(n / 100) * 100)

/** Kilómetros esperables para la edad del vehículo. */
export function kmEsperados(edadAnios: number): number {
  return Math.max(KM_ANUALES_NORMALES, edadAnios * KM_ANUALES_NORMALES)
}

/**
 * Ajuste por kilometraje respecto a lo esperable para su edad. Acotado a ±20 %:
 * los kilómetros importan, pero no convierten una camper de 40.000 € en una de
 * 10.000 € por mucho que haya rodado.
 */
export function ajustePorKm(km: number, edadAnios: number): number {
  const esperados = kmEsperados(edadAnios)
  if (!Number.isFinite(km) || km <= 0) return 1
  const desviacion = (esperados - km) / esperados
  const ajuste = desviacion * 0.35
  return 1 + Math.max(-AJUSTE_KM_MAXIMO, Math.min(AJUSTE_KM_MAXIMO, ajuste))
}

/**
 * Valora un vehículo. Devuelve `null` cuando no hay base suficiente para dar
 * una cifra: ni mercado ni precio de nuevo.
 */
export function valorar(
  entrada: EntradaValoracion,
  mercado: Estadisticas | null,
  anioReferencia = new Date().getFullYear()
): ResultadoValoracion | null {
  const edad = Math.max(0, anioReferencia - entrada.anio)
  const ajustes: AjusteAplicado[] = []

  let base: number
  let fuente: FuenteValoracion
  let muestra: number | null = null

  if (mercado) {
    // Partimos de la mediana real del modelo en el marketplace.
    base = mercado.mediana
    fuente = 'mercado'
    muestra = mercado.muestra
    ajustes.push({
      concepto: 'Precio de partida',
      detalle: `Mediana de ${mercado.muestra} anuncios de este modelo en CamperOcasión`,
      factor: 1,
    })

    // La mediana ya incluye vehículos de todas las edades: corregimos según
    // se desvíe de la antigüedad típica de la muestra.
    if (mercado.anioMediano != null) {
      const edadMediana = Math.max(0, anioReferencia - mercado.anioMediano)
      const difAnios = edadMediana - edad
      if (difAnios !== 0) {
        // ~4 % por año de diferencia, acotado para que no se dispare.
        const factor = 1 + Math.max(-0.35, Math.min(0.35, difAnios * 0.04))
        base *= factor
        ajustes.push({
          concepto: 'Antigüedad',
          detalle:
            difAnios > 0
              ? `Tu vehículo es ${difAnios} ${difAnios === 1 ? 'año' : 'años'} más nuevo que la media de anuncios`
              : `Tu vehículo es ${Math.abs(difAnios)} ${Math.abs(difAnios) === 1 ? 'año' : 'años'} más antiguo que la media`,
          factor,
        })
      }
    }
  } else if (entrada.precioNuevo && entrada.precioNuevo > 0) {
    // Sin mercado: depreciación oficial sobre el precio de nuevo.
    const coef = coeficienteDepreciacion(edad)
    base = entrada.precioNuevo * coef
    fuente = 'depreciacion'
    ajustes.push({
      concepto: 'Depreciación por antigüedad',
      detalle: `${Math.round(coef * 100)} % del precio de nuevo (${edad} ${edad === 1 ? 'año' : 'años'}), según la tabla oficial de Hacienda`,
      factor: coef,
    })
  } else {
    return null
  }

  // Kilometraje
  const factorKm = ajustePorKm(entrada.km, edad)
  if (Math.abs(factorKm - 1) > 0.005) {
    base *= factorKm
    const esperados = kmEsperados(edad)
    ajustes.push({
      concepto: 'Kilometraje',
      detalle:
        factorKm > 1
          ? `${entrada.km.toLocaleString('es-ES')} km: por debajo de los ${esperados.toLocaleString('es-ES')} km esperables`
          : `${entrada.km.toLocaleString('es-ES')} km: por encima de los ${esperados.toLocaleString('es-ES')} km esperables`,
      factor: factorKm,
    })
  }

  // Estado declarado
  const estado = entrada.estado || 'bueno'
  const factorEstado = FACTOR_ESTADO[estado]
  if (factorEstado !== 1) {
    base *= factorEstado
    ajustes.push({
      concepto: 'Estado declarado',
      detalle: ESTADOS_VEHICULO.find(e => e.id === estado)?.etiqueta || estado,
      factor: factorEstado,
    })
  }

  const estimado = redondear100(base)

  // La confianza depende de la muestra: decirlo es lo que separa una
  // herramienta honesta de una que aparenta precisión que no tiene.
  let confianza: ResultadoValoracion['confianza']
  if (fuente === 'depreciacion') confianza = 'baja'
  else if ((muestra || 0) >= 15) confianza = 'alta'
  else confianza = 'media'

  return {
    estimado,
    minimo: redondear100(estimado * (1 - AMPLITUD_HORQUILLA)),
    maximo: redondear100(estimado * (1 + AMPLITUD_HORQUILLA)),
    fuente,
    muestra,
    ajustes,
    confianza,
  }
}

/** Validación de la entrada del formulario. */
export function validarEntrada(
  entrada: Partial<EntradaValoracion>,
  anioReferencia = new Date().getFullYear()
): Record<string, string> {
  const errores: Record<string, string> = {}

  if (!entrada.modelo) errores.modelo = 'Elige el modelo de tu vehículo.'

  const anio = Number(entrada.anio)
  if (!Number.isInteger(anio) || anio < 1970 || anio > anioReferencia + 1) {
    errores.anio = `Introduce un año entre 1970 y ${anioReferencia + 1}.`
  }

  const km = Number(entrada.km)
  if (!Number.isFinite(km) || km < 0 || km > 2_000_000) {
    errores.km = 'Introduce un kilometraje válido.'
  }

  if (entrada.precioNuevo != null && entrada.precioNuevo !== ('' as any)) {
    const pn = Number(entrada.precioNuevo)
    if (!Number.isFinite(pn) || pn < 1000 || pn > 500_000) {
      errores.precioNuevo = 'El precio de nuevo no parece válido.'
    }
  }

  return errores
}
