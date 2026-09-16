import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { isValidUUID, isValidEmail, isValidLength, isValidPrice, isValidProductState, sanitizeObject, sanitizeString } from '@/lib/validation'
import { verificarContenido } from '@/lib/moderacion'
import { categoriasData, getSubConfig } from '@/lib/categorias'
import { ESTADOS, getMunicipiosNombres } from '@/lib/ubicaciones'
import { normalizeMessengerUrl } from '@/lib/contact-methods'

const PRODUCT_COLUMNS = [
  'id',
  'user_id',
  'titulo',
  'descripcion',
  'precio_usd',
  'estado',
  'categoria_id',
  'subcategoria',
  'marca',
  'modelo',
  'especificaciones',
  'ubicacion_estado',
  'ubicacion_ciudad',
  'activo',
  'imagen_url',
  'imagenes',
  'metodos_contacto',
  'estado_moderacion',
  'motivo_moderacion',
  'vendido',
  'comprador_id',
].join(', ')

const ALLOWED_FIELDS = new Set([
  'titulo',
  'descripcion',
  'precio_usd',
  'estado',
  'categoria',
  'subcategoria',
  'marca',
  'modelo',
  'especificaciones',
  'ubicacion_estado',
  'ubicacion_ciudad',
  'activo',
  'imagen_url',
  'imagenes',
  'metodos_contacto',
])

function getAdminClient(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function isAllowedImageUrl(value: string): boolean {
  if (value === '/placeholder-product.webp') return true

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false

    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : ''
    if (
      parsed.hostname === supabaseHost
      && parsed.pathname.startsWith('/storage/v1/object/public/')
    ) {
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

function validateImages(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 10) return null
  const urls = value.filter((item): item is string => typeof item === 'string')
  if (urls.length !== value.length) return null
  if (urls.some((url) => url.length > 2000 || !isAllowedImageUrl(url))) return null
  return urls
}

function normalizeContactMethods(value: unknown): Record<string, string> | null {
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

    if (key === 'email' && !isValidEmail(clean)) return null
    if (key === 'messenger' && !normalizeMessengerUrl(clean)) return null
    if ((key === 'telefono' || key === 'whatsapp') && !isValidLength(clean, 3, 40)) return null

    output[key] = key === 'messenger' ? normalizeMessengerUrl(clean) : clean
  }

  return output
}

function validateSpecifications(value: unknown): Record<string, unknown> | null {
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

async function resolveCategoryId(sb: any, categoria: unknown): Promise<number | null> {
  if (typeof categoria !== 'string' || !Object.prototype.hasOwnProperty.call(categoriasData, categoria)) {
    return null
  }

  const { data, error } = await sb
    .from('categorias')
    .select('id')
    .eq('nombre', categoria)
    .maybeSingle()

  if (error || data?.id == null) return null
  return Number(data.id)
}

function validLocation(state: string, city: string, previousCity: string): boolean {
  if (!(ESTADOS as readonly string[]).includes(state)) return false
  if (city === previousCity) return true
  return getMunicipiosNombres(state).includes(city)
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !isValidUUID(body.productId)) {
    return NextResponse.json({ error: 'productId inválido' }, { status: 400 })
  }

  const unknownFields = Object.keys(body).filter((key) => key !== 'productId' && !ALLOWED_FIELDS.has(key))
  if (unknownFields.length > 0) {
    return NextResponse.json({ error: 'Campo no permitido' }, { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(body, 'activo') && typeof body.activo !== 'boolean') {
    return NextResponse.json({ error: 'activo debe ser boolean' }, { status: 400 })
  }

  const sb = getAdminClient()
  const { data: current, error: currentError } = await sb
    .from('productos')
    .select(PRODUCT_COLUMNS)
    .eq('id', body.productId)
    .maybeSingle()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  if (current.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
  }

  // Pausar/reactivar es una operación parcial usada por el dashboard. No debe
  // reconstruir ni borrar imágenes/categorías de un producto legacy.
  const bodyFields = Object.keys(body).filter((key) => key !== 'productId')
  if (bodyFields.length === 1 && bodyFields[0] === 'activo') {
    if (current.vendido && body.activo === true) {
      return NextResponse.json({ error: 'Un producto vendido debe reactivarse mediante el flujo de venta' }, { status: 409 })
    }
    if (current.estado_moderacion === 'rechazado' && body.activo === true) {
      return NextResponse.json({ error: 'Un producto rechazado requiere revisión administrativa' }, { status: 409 })
    }

    const { data, error } = await sb
      .from('productos')
      .update({ activo: body.activo })
      .eq('id', body.productId)
      .eq('user_id', auth.user.id)
      .select('id, slug, titulo, activo, vendido, estado_moderacion')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'No se pudo actualizar el estado del producto' }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/en')
    revalidatePath('/catalogo')
    revalidatePath('/en/catalogo')
    return NextResponse.json({ ok: true, product: data })
  }

  const candidate: any = {
    ...current,
    ...body,
  }

  // `categoria` es una clave interna del catálogo, nunca una columna que el
  // cliente pueda inventar. Si no viene, se conserva la categoría existente.
  let categoriaId = current.categoria_id
  if (Object.prototype.hasOwnProperty.call(body, 'categoria')) {
    const resolved = await resolveCategoryId(sb, body.categoria)
    if (resolved === null) {
      return NextResponse.json({ error: 'Categoría inválida o no configurada' }, { status: 400 })
    }
    categoriaId = resolved
  }

  const categoriaKey = typeof body.categoria === 'string'
    ? body.categoria
    : await (async () => {
        if (current.categoria_id == null) return null
        const { data } = await sb.from('categorias').select('nombre').eq('id', current.categoria_id).maybeSingle()
        return data?.nombre || null
      })()
  const subConfig = categoriaKey ? getSubConfig(categoriaKey, String(candidate.subcategoria || '')) : undefined
  if (!subConfig) {
    return NextResponse.json({ error: 'Subcategoría inválida para la categoría seleccionada' }, { status: 400 })
  }

  const titulo = sanitizeString(String(candidate.titulo ?? ''), 100)
  const descripcion = sanitizeString(String(candidate.descripcion ?? ''), 5000)
  if (!isValidLength(titulo, 3, 100)) {
    return NextResponse.json({ error: 'Título debe tener entre 3 y 100 caracteres' }, { status: 400 })
  }
  if (!isValidLength(descripcion, 1, 5000)) {
    return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
  }
  if (candidate.precio_usd !== null && candidate.precio_usd !== undefined && !isValidPrice(candidate.precio_usd)) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }
  if (!isValidProductState(String(candidate.estado || ''))) {
    return NextResponse.json({ error: 'Estado de producto inválido' }, { status: 400 })
  }

  const ubicacionEstado = sanitizeString(String(candidate.ubicacion_estado ?? ''), 50)
  const ubicacionCiudad = sanitizeString(String(candidate.ubicacion_ciudad ?? ''), 80)
  if (!validLocation(ubicacionEstado, ubicacionCiudad, String(current.ubicacion_ciudad || ''))) {
    return NextResponse.json({ error: 'Ubicación inválida' }, { status: 400 })
  }

  const specs = validateSpecifications(candidate.especificaciones)
  if (specs === null) return NextResponse.json({ error: 'Especificaciones inválidas' }, { status: 400 })

  const contactMethods = normalizeContactMethods(candidate.metodos_contacto)
  if (contactMethods === null) return NextResponse.json({ error: 'Métodos de contacto inválidos' }, { status: 400 })

  const imageFieldsProvided = Object.prototype.hasOwnProperty.call(body, 'imagenes')
    || Object.prototype.hasOwnProperty.call(body, 'imagen_url')
  const currentImages = Array.isArray(current.imagenes) && current.imagenes.length > 0
    ? current.imagenes
    : current.imagen_url
      ? [current.imagen_url]
      : []
  const images = validateImages(imageFieldsProvided ? (candidate.imagenes || []) : currentImages)
  if (images === null) return NextResponse.json({ error: 'Imágenes inválidas' }, { status: 400 })
  if (imageFieldsProvided && candidate.imagen_url && images.length > 0 && candidate.imagen_url !== images[0]) {
    return NextResponse.json({ error: 'La imagen principal no coincide con la galería' }, { status: 400 })
  }
  const nextImageUrl = imageFieldsProvided ? (images[0] || null) : (current.imagen_url || images[0] || null)

  const contentChanged = Object.prototype.hasOwnProperty.call(body, 'titulo')
    || Object.prototype.hasOwnProperty.call(body, 'descripcion')
  let estadoModeracion = current.estado_moderacion || 'aprobado'
  let motivoModeracion = current.motivo_moderacion || null

  if (contentChanged) {
    if (current.estado_moderacion === 'rechazado') {
      return NextResponse.json({ error: 'Un producto rechazado requiere revisión administrativa' }, { status: 409 })
    }

    const moderacion = verificarContenido(`${titulo} ${descripcion}`)
    if (moderacion.nivel === 'prohibido') {
      return NextResponse.json({ error: 'La publicación contiene contenido que viola nuestras normas.' }, { status: 400 })
    }
    estadoModeracion = moderacion.nivel === 'sospechoso' ? 'pendiente' : 'aprobado'
    motivoModeracion = moderacion.nivel === 'sospechoso'
      ? `Contenido sospechoso: ${moderacion.palabras.join(', ')}`
      : null
  }

  const requestedActive = Boolean(candidate.activo)
  if (current.vendido && requestedActive) {
    return NextResponse.json({ error: 'Un producto vendido debe reactivarse mediante el flujo de venta' }, { status: 409 })
  }
  if (current.estado_moderacion === 'rechazado' && requestedActive) {
    return NextResponse.json({ error: 'Un producto rechazado requiere revisión administrativa' }, { status: 409 })
  }

  const updateData = {
    titulo,
    descripcion,
    categoria_id: categoriaId,
    subcategoria: String(candidate.subcategoria),
    marca: candidate.marca == null ? null : sanitizeString(String(candidate.marca), 100),
    modelo: candidate.modelo == null ? null : sanitizeString(String(candidate.modelo), 150),
    especificaciones: specs,
    estado: String(candidate.estado),
    precio_usd: candidate.precio_usd == null ? null : Number(candidate.precio_usd),
    ubicacion_estado: ubicacionEstado,
    ubicacion_ciudad: ubicacionCiudad,
    imagen_url: nextImageUrl,
    imagenes: images,
    metodos_contacto: contactMethods,
    activo: requestedActive,
    estado_moderacion: estadoModeracion,
    motivo_moderacion: motivoModeracion,
  }

  const { data, error } = await sb
    .from('productos')
    .update(updateData)
    .eq('id', body.productId)
    .eq('user_id', auth.user.id)
    .select('id, slug, titulo, activo, vendido, estado_moderacion')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar el producto' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'No se pudo guardar el producto' }, { status: 409 })
  }

  revalidatePath('/')
  revalidatePath('/en')
  revalidatePath('/catalogo')
  revalidatePath('/en/catalogo')
  if (data.slug) {
    revalidatePath(`/producto/${data.slug}`)
    revalidatePath(`/en/producto/${data.slug}`)
  }

  return NextResponse.json({ ok: true, product: data })
}
