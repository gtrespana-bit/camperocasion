import { esPlanPago, type PlanPago } from '@/lib/planes-anuncios'

export type TipoCupon = 'regalo_dias' | 'descuento'

export interface CuponDatos {
  codigo: string
  tipo: TipoCupon
  activo: boolean
  max_usos: number | null
  usos: number
  valido_desde: string | null
  valido_hasta: string | null
  dias?: number | null
  plan?: string | null
  porcentaje?: number | null
  meses_descuento?: number | null
}

export function normalizarCodigo(codigo: string): string {
  return (codigo || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function codigoValido(codigo: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizarCodigo(codigo))
}

export function generarCodigo(prefijo = 'CAMPER'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tail = ''
  for (let i = 0; i < 6; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${prefijo}-${tail}`
}

export function cuponAplicable(cupon: CuponDatos, ahora: Date = new Date()): { ok: true } | { ok: false; error: string } {
  if (!cupon.activo) return { ok: false, error: 'Este cupón está desactivado.' }
  if (cupon.valido_desde && new Date(cupon.valido_desde) > ahora) {
    return { ok: false, error: 'Este cupón aún no es válido.' }
  }
  if (cupon.valido_hasta && new Date(cupon.valido_hasta) < ahora) {
    return { ok: false, error: 'Este cupón ha caducado.' }
  }
  if (cupon.max_usos != null && cupon.usos >= cupon.max_usos) {
    return { ok: false, error: 'Este cupón ya se ha agotado.' }
  }
  if (cupon.tipo === 'regalo_dias') {
    const dias = Number(cupon.dias)
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      return { ok: false, error: 'Cupón de regalo mal configurado.' }
    }
    if (cupon.plan && !esPlanPago(cupon.plan)) {
      return { ok: false, error: 'El pack del cupón no es válido.' }
    }
  }
  if (cupon.tipo === 'descuento') {
    const pct = Number(cupon.porcentaje)
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      return { ok: false, error: 'El porcentaje de descuento no es válido.' }
    }
    const meses = Number(cupon.meses_descuento ?? 1)
    if (!Number.isInteger(meses) || meses < 1 || meses > 24) {
      return { ok: false, error: 'Los meses de descuento no son válidos.' }
    }
  }
  return { ok: true }
}

export function planRegalo(cupon: CuponDatos): PlanPago {
  return esPlanPago(cupon.plan) ? cupon.plan : 'plus'
}
