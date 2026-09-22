import { isValidEmail, isValidLength, isValidPrice, sanitizeObject, sanitizeString } from '@/lib/validation'
import { categoriasData, getSubConfig } from '@/lib/categorias'
import { ESTADOS, getMunicipiosNombres } from '@/lib/ubicaciones'
import { normalizeMessengerUrl } from '@/lib/contact-methods'

export const VALID_STATES = new Set([...(ESTADOS as readonly string[]), 'Ceuta', 'Melilla'])

export function isAllowedImageUrl(value: string, currentUrls: Set<string> = new Set()): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false

  // Conservar URLs que ya pertenecían al producto antes de editar
  if (currentUrls.has(trimmed)) return true

  // Rutas relativas del propio sitio (/placeholder..., /semilla-fotos/...)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

    // Dominio del sitio o entornos de desarrollo/pruebas
    if (
      parsed.hostname === 'camperocasion.online'
      || parsed.hostname.endsWith('.camperocasion.online')
      || parsed.hostname === 'localhost'
      || parsed.hostname.endsWith('.e2b.app')
    ) {
      return true
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) {
      try {
        const siteParsed = new URL(siteUrl)
        if (parsed.hostname === siteParsed.hostname) return true
      } catch {}
    }

    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : ''
    const esSupabase =
      parsed.hostname === supabaseHost
      || parsed.hostname.endsWith('.supabase.co')
      || parsed.hostname.endsWith('.supabase.in')
    if (esSupabase && parsed.pathname.includes('/storage/v1/')) {
      return true
    }

    const r2PublicUrl = process.env.R2_PUBLIC_URL
    if (r2PublicUrl) {
      const r2 = new URL(r2PublicUrl)
      if (parsed.origin === r2.origin && parsed.pathname.startsWith(`${r2.pathname.replace(/\/$/, '')}/`)) {
        return true
      }
    }

    // Existing seed content uses Unsplash. It is an explicit trusted host,
    // never an arbitrary URL supplied by a user.
    return parsed.hostname === 'images.unsplash.com'
  } catch {
    return false
  }
}

export function validateImages(value: unknown, currentUrls: Set<string> = new Set()): string[] | null {
  if (!Array.isArray(value) || value.length > 10) return null
  const urls = value.filter((item): item is string => typeof item === 'string')
  if (urls.length !== value.length) return null
  if (urls.some((url) => url.length > 2000 || !isAllowedImageUrl(url, currentUrls))) return null
  return urls
}

export function normalizeContactMethods(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return null

  const input = value as Record<string, unknown>
  const output: Record<string, string> = {}
  const allowed = ['email', 'telefono', 'whatsapp', 'messenger']

  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) return null
    if (typeof input[key] !== 'string') return null

    const clean = sanitizeString(input[key] as string, key === 'email' ? 254 : 2000)
    if (!clean) continue

    if (key === 'email') {
      if (!isValidEmail(clean)) return null
      output[key] = clean
    } else if (key === 'messenger') {
      const norm = normalizeMessengerUrl(clean)
      if (norm) {
        try {
          const u = new URL(norm)
          const path = u.pathname.replace(/^\/+|\/+$/g, '')
          if (path) {
            output[key] = norm
          }
        } catch {}
      }
    } else if (key === 'telefono' || key === 'whatsapp') {
      // Si solo tiene prefijo (+34, +, etc.) sin dígitos suficientes, ignorar en lugar de fallar
      const digits = clean.replace(/[^0-9]/g, '')
      if (digits.length >= 3 && isValidLength(clean, 3, 40)) {
        output[key] = clean
      }
    }
  }

  return output
}

export function validateSpecifications(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return null

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > 30) return null

  const clean = sanitizeObject(value as Record<string, unknown>, 4) as Record<string, unknown>
  for (const [key, item] of Object.entries(clean)) {
    if (key.length > 100) return null
    if (typeof item === 'string' && item.length > 300) return null
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') return null
  }
  return clean
}

export async function resolveCategoryId(sb: any, categoria: unknown): Promise<number | null> {
  // CamperOcasión es un vertical 100% camper. La categoría canónica es 'camper'.
  const nombre = typeof categoria === 'string' && categoria.trim() ? categoria.trim().toLowerCase() : 'camper'
  const key = Object.prototype.hasOwnProperty.call(categoriasData, nombre) ? nombre : 'camper'

  try {
    const { data: existente } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', key)
      .maybeSingle()

    if (existente?.id != null) return Number(existente.id)

    // Crear la categoría 'camper' si no existe aún en la tabla (mismo flujo que api/publicar)
    const { data: creada } = await sb
      .from('categorias')
      .insert({ nombre: key })
      .select('id')
      .maybeSingle()

    if (creada?.id != null) return Number(creada.id)

    const { data: trasCarrera } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', key)
      .maybeSingle()

    return trasCarrera?.id != null ? Number(trasCarrera.id) : null
  } catch {
    return null
  }
}

export function resolveSubcategory(subcategoria: unknown): string | null {
  const rawSub = String(subcategoria || '').trim()
  if (!rawSub) return null

  const subConfig = getSubConfig('camper', rawSub)
    || categoriasData.camper.subs.find(
      (s) => s.slug === rawSub || s.label.toLowerCase() === rawSub.toLowerCase()
    )

  return subConfig ? subConfig.label : null
}

export function validLocation(state: string, city: string, previousState: string, previousCity: string): boolean {
  if (state === previousState && city === previousCity) return true
  if (!state && !city) return true
  if (state && !VALID_STATES.has(state)) return false
  if (city === previousCity) return true
  if (!city) return true
  const municipios = getMunicipiosNombres(state)
  return municipios.length === 0 || municipios.includes(city)
}

export function parsePrice(precioRaw: unknown): { valid: boolean; value: number | null } {
  if (precioRaw === null || precioRaw === undefined || precioRaw === '') {
    return { valid: true, value: null }
  }
  const num = Number(String(precioRaw).replace(',', '.'))
  if (!isValidPrice(num)) {
    return { valid: false, value: null }
  }
  return { valid: true, value: num }
}
