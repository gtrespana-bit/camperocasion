import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { isValidUUID, isValidLength, sanitizeString } from '@/lib/validation'
import { verificarContenido } from '@/lib/moderacion'
import { revalidarListadosPublicos, revalidarFichaProducto } from '@/lib/revalidar'
import {
  isAllowedImageUrl,
  normalizeContactMethods,
  parsePrice,
  resolveCategoryId,
  resolveSubcategory,
  validateImages,
  validateSpecifications,
  validLocation,
} from '@/lib/productos-editar'

const PRODUCT_COLUMNS = [
  'id',
  'user_id',
  'titulo',
  'descripcion',
  // Canónico: precio (euros). Aliases legados precio_eur / precio_usd se leen por compatibilidad
  'precio',
  'precio_eur',
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
  // precio canónico ES + aliases
  'precio',
  'precio_eur',
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

    revalidarListadosPublicos()
    return NextResponse.json({ ok: true, product: data })
  }

  const candidate: any = {
    ...current,
    ...body,
  }

  // En CamperOcasión todas las publicaciones pertenecen a la categoría 'camper'.
  // Si la categoría viene vacía o con un valor heredado, se normaliza y se
  // resuelve/asegura su ID en la base de datos sin fallar.
  let categoriaId = current.categoria_id
  const resolved = await resolveCategoryId(sb, body.categoria || 'camper')
  if (resolved !== null) {
    categoriaId = resolved
  }

  // Subcategoría: admite label canónico o slug y normaliza al label oficial de categoriasData.camper
  const subcategoriaNormalizada = resolveSubcategory(candidate.subcategoria)
  if (!subcategoriaNormalizada) {
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

  // Canónico ES: precio / precio_eur / precio_usd.
  // Si el body envía precio, precio_eur o precio_usd, se respeta la entrada del usuario.
  const precioRaw = Object.prototype.hasOwnProperty.call(body, 'precio')
    ? body.precio
    : Object.prototype.hasOwnProperty.call(body, 'precio_eur')
      ? body.precio_eur
      : Object.prototype.hasOwnProperty.call(body, 'precio_usd')
        ? body.precio_usd
        : (current.precio ?? current.precio_eur ?? current.precio_usd)

  const parsedPrice = parsePrice(precioRaw)
  if (!parsedPrice.valid) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }
  const precioEur = parsedPrice.value

  const validStates = ['Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos']
  const estadoStr = String(candidate.estado || '')
  if (!validStates.includes(estadoStr)) {
    return NextResponse.json({ error: 'Estado de producto inválido' }, { status: 400 })
  }

  const ubicacionEstado = sanitizeString(String(candidate.ubicacion_estado ?? ''), 50)
  const ubicacionCiudad = sanitizeString(String(candidate.ubicacion_ciudad ?? ''), 80)
  if (!validLocation(ubicacionEstado, ubicacionCiudad, String(current.ubicacion_estado || ''), String(current.ubicacion_ciudad || ''))) {
    return NextResponse.json({ error: 'Ubicación inválida' }, { status: 400 })
  }

  const specs = validateSpecifications(candidate.especificaciones)
  if (specs === null) return NextResponse.json({ error: 'Especificaciones inválidas' }, { status: 400 })

  const contactMethods = normalizeContactMethods(candidate.metodos_contacto)
  if (contactMethods === null) return NextResponse.json({ error: 'Métodos de contacto inválidos' }, { status: 400 })

  const currentImagesList: string[] = Array.isArray(current.imagenes) && current.imagenes.length > 0
    ? current.imagenes
    : current.imagen_url
      ? [current.imagen_url]
      : []
  const currentImagesSet = new Set(currentImagesList)

  const imageFieldsProvided = Object.prototype.hasOwnProperty.call(body, 'imagenes')
    || Object.prototype.hasOwnProperty.call(body, 'imagen_url')
  const candidateImages = imageFieldsProvided ? (candidate.imagenes || []) : currentImagesList
  const images = validateImages(candidateImages, currentImagesSet)
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

  const updateData: Record<string, unknown> = {
    titulo,
    descripcion,
    categoria_id: categoriaId,
    subcategoria: subcategoriaNormalizada,
    marca: candidate.marca == null ? null : sanitizeString(String(candidate.marca), 100),
    modelo: candidate.modelo == null ? null : sanitizeString(String(candidate.modelo), 150),
    especificaciones: specs,
    estado: estadoStr,
    // Escribir en canónico y en aliases para compatibilidad (trigger los mantiene sincronizados)
    precio: precioEur,
    precio_eur: precioEur,
    precio_usd: precioEur,
    ubicacion_estado: ubicacionEstado || null,
    ubicacion_ciudad: ubicacionCiudad || null,
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
    return NextResponse.json({ error: 'No se pudo guardar el producto: ' + (error.message || '') }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'No se pudo guardar el producto' }, { status: 409 })
  }

  revalidarListadosPublicos()
  revalidarFichaProducto(data.slug)

  return NextResponse.json({ ok: true, product: data })
}
