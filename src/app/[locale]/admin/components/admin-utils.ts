export type Perfil = {
  id: string
  nombre?: string | null
  telefono?: string | null
  email?: string | null
  estado?: string | null
  ciudad?: string | null
  credito_balance?: number | null
  verificado?: boolean | null
  nivel_confianza?: number | null
  creado_en?: string | null
  ultima_actividad?: string | null
}

export type Producto = {
  id: string
  slug?: string | null
  user_id: string
  titulo: string | null
  descripcion?: string | null
  precio_usd?: number | string | null
  categoria_id?: number | null
  subcategoria?: string | null
  marca?: string | null
  modelo?: string | null
  estado?: string | null
  ubicacion_estado?: string | null
  ubicacion_ciudad?: string | null
  imagen_url?: string | null
  imagenes?: string[] | null
  metodos_contacto?: any
  activo?: boolean | null
  vendido?: boolean | null
  vendido_en?: string | null
  comprador_id?: string | null
  estado_moderacion?: string | null
  motivo_moderacion?: string | null
  destacado?: boolean | null
  destacado_hasta?: string | null
  boosteado_en?: string | null
  visitas?: number | null
  creado_en?: string | null
  actualizado_en?: string | null
  vendedor?: { nombre?: string | null; telefono?: string | null; email?: string | null }
}

export type Transaccion = {
  id: string
  user_id: string
  tipo?: string | null
  monto: number
  precio_usd?: number | null
  metodo_pago?: string | null
  estado?: 'pendiente' | 'aprobado' | 'rechazado' | string
  comprobante_url?: string | null
  creado_en?: string | null
  motivo_registro?: string | null
  perfil?: Perfil
}

export type SolicitudVerificacion = {
  id: string
  user_id: string
  estado?: string | null
  creada_en?: string | null
  revisada_en?: string | null
  pago_movil_telefono?: string | null
  pago_movil_cedula?: string | null
  pago_movil_banco?: string | null
  mensaje?: string | null
  rechazo_motivo?: string | null
  cedula_foto_frente_url?: string | null
  cedula_foto_dorso_url?: string | null
  perfil?: Perfil
}

export type Denuncia = {
  id: string
  producto_id?: string | null
  reportante_id?: string | null
  motivo?: string | null
  descripcion?: string | null
  estado?: string | null
  creada_en?: string | null
  producto?: { titulo?: string | null; user_id?: string | null; precio_usd?: number | null; imagen_url?: string | null } | null
  reportante?: { nombre?: string | null } | null
}

export type AnuncioGlobal = {
  id: string
  titulo: string
  mensaje: string
  emoji?: string | null
  enlace?: string | null
  enlace_texto?: string | null
  activo?: boolean | null
  creado_en?: string | null
  actualizado_en?: string | null
  expira_en?: string | null
}

export async function apiJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const json = await res.json().catch(() => ({ error: 'Respuesta inválida' }))
  if (!res.ok) {
    throw new Error(json?.error || res.statusText || 'Error de la API')
  }
  return json as T
}

export function countSegmentsLabel(buckets: Array<{ label: string; value: number }>): string {
  const total = buckets.reduce((s, b) => s + b.value, 0)
  if (total === 0) return '0'
  return `${total}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
