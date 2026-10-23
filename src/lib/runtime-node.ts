/**
 * Versión mínima de Node.js admitida en ejecución.
 *
 * La fuente de verdad es `engines.node` de package.json (`>=24.22.1 <25`).
 * El mínimo es el parche de seguridad publicado el 2026-10-21; si se sube,
 * hay que actualizar también `.nvmrc`. `scripts/check-node-version.cjs` lee
 * este mismo `engines.node`, y los tests comprueban que ambas reglas coinciden.
 *
 * Solo se usa en el servidor: el endpoint de diagnóstico y su comprobación.
 */
import pkg from '../../package.json'

/** `engines.node` tal cual, p. ej. `>=24.22.1 <25`. */
export const ENGINES_NODE: string = pkg.engines.node

type Rango = { minimo: [number, number, number]; maxExclusivo: number }

function leerRango(engines: string = ENGINES_NODE): Rango {
  const m = /^>=\s*(\d+)\.(\d+)\.(\d+)\s*<\s*(\d+)$/.exec(engines.trim())
  if (!m) {
    throw new Error(`engines.node no tiene el formato esperado: ${engines}`)
  }
  return {
    minimo: [Number(m[1]), Number(m[2]), Number(m[3])],
    maxExclusivo: Number(m[4]),
  }
}

/** Compara dos versiones `x.y.z`. Devuelve <0, 0 o >0. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * ¿La versión cumple el rango admitido? Acepta cualquier parche posterior dentro
 * de la misma rama, pero no una rama superior: saltar de 22 a 24 es una decisión
 * deliberada, no algo que deba colarse por tener un número más alto.
 */
export function esVersionSegura(version: string, engines: string = ENGINES_NODE): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false
  const { minimo, maxExclusivo } = leerRango(engines)
  const major = Number(version.split('.')[0])
  if (major >= maxExclusivo) return false
  return compararVersiones(version, minimo.join('.')) >= 0
}

export type RuntimeNode = {
  node: string
  cumple: boolean
  minimo: string
  ramaMaximaExclusiva: number
  plataforma: string
  arquitectura: string
  entorno: string
  region: string | null
  commit: string | null
  despliegue: string | null
}

/** Datos del proceso actual. No incluye ninguna variable de entorno sensible. */
export function leerRuntimeNode(version: string = process.versions.node): RuntimeNode {
  const { minimo, maxExclusivo } = leerRango()
  return {
    node: version,
    cumple: esVersionSegura(version),
    minimo: minimo.join('.'),
    ramaMaximaExclusiva: maxExclusivo,
    plataforma: process.platform,
    arquitectura: process.arch,
    entorno: process.env.VERCEL_ENV || process.env.NODE_ENV || 'desconocido',
    region: process.env.VERCEL_REGION || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    despliegue: process.env.VERCEL_URL || null,
  }
}
