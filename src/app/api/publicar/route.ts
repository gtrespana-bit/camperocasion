import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { validateProductData, sanitizeObject } from '@/lib/validation'
import { verificarContenido } from '@/lib/moderacion'
import { requireUser } from '@/lib/require-auth'

/**
 * Devuelve el id de una categoría por nombre, creándola si no existe.
 *
 * Nunca lanza: si algo falla, devuelve null y el producto se guarda sin
 * categoria_id (mejor eso que perder la publicación entera del usuario).
 */
async function resolverCategoriaId(
  // `any`: el proyecto no genera tipos de la DB, así que el cliente es
  // SupabaseClient<any> y los genéricos por defecto infieren `never`.
  sb: any,
  nombre: string
): Promise<number | null> {
  try {
    const { data: existente } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle()

    if (existente?.id != null) return existente.id as number

    // No existe: crearla. `nombre` es UNIQUE, así que ante una carrera entre
    // dos publicaciones simultáneas el insert falla y releemos la fila ganadora.
    const { data: creada } = await sb
      .from('categorias')
      .insert({ nombre })
      .select('id')
      .maybeSingle()

    if (creada?.id != null) return creada.id as number

    const { data: trasCarrera } = await sb
      .from('categorias')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle()

    return (trasCarrera?.id as number) ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // El user_id SIEMPRE sale de la sesión verificada (getUser valida el JWT).
    // Antes venía del body: cualquiera podía publicar como otro usuario y
    // evadir el rate limit cambiando el userId.
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const userId = auth.user.id

    const body = await req.json()
    // Descartamos userId/user_id del body: el user_id SIEMPRE sale de la
    // sesión verificada arriba. Si los dejáramos pasar, 'userId' (columna que
    // no existe en 'productos') se colaría en el INSERT y PostgREST fallaría con
    // "Could not find the 'userId' column of 'productos' in the schema cache".
    // `categoria` es la CLAVE de categoriasData ('repuestos', 'vehiculos'...),
    // no una columna de `productos`: se extrae aquí y se traduce a categoria_id
    // más abajo. Si se colara en el INSERT, PostgREST fallaría con
    // "Could not find the 'categoria' column of 'productos'".
    const {
      // Estos valores se calculan en el servidor y nunca se aceptan del cliente.
      moderacionAlerta: _bodyModeracion,
      estado_moderacion: _bodyEstadoModeracion,
      motivo_moderacion: _bodyMotivoModeracion,
      activo: _bodyActivo,
      destacado: _bodyDestacado,
      destacado_hasta: _bodyDestacadoHasta,
      boosteado_en: _bodyBoosteadoEn,
      vendedor_verificado: _bodyVendedorVerificado,
      visitas: _bodyVisitas,
      vendido: _bodyVendido,
      vendido_en: _bodyVendidoEn,
      comprador_id: _bodyCompradorId,
      userId: _bodyUserId,
      user_id: _bodyUserIdSnake,
      categoria: categoriaKey,
      ...productoData
    } = body

    // Validar datos del producto
    const validation = validateProductData({ userId, ...productoData })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Sanitizar strings para prevenir XSS
    const sanitizedData = sanitizeObject(productoData)

    // La moderación es una regla de seguridad: se recalcula en el servidor y
    // no se confía en `estado_moderacion` ni en una alerta enviada por el
    // navegador.
    const textoModeracion = `${sanitizedData.titulo || ''} ${sanitizedData.descripcion || ''}`
    const moderacion = verificarContenido(textoModeracion)
    if (moderacion.nivel === 'prohibido') {
      return NextResponse.json(
        { error: 'La publicación contiene contenido que viola nuestras normas.', palabras: moderacion.palabras },
        { status: 400 },
      )
    }
    sanitizedData.estado_moderacion = moderacion.nivel === 'sospechoso' ? 'pendiente' : 'aprobado'
    sanitizedData.motivo_moderacion = moderacion.nivel === 'sospechoso'
      ? `Contenido sospechoso: ${moderacion.palabras.join(', ')}`
      : null
    sanitizedData.activo = true
    sanitizedData.destacado = false
    sanitizedData.destacado_hasta = null
    sanitizedData.boosteado_en = null
    sanitizedData.vendedor_verificado = false
    sanitizedData.visitas = 0
    sanitizedData.vendido = false
    sanitizedData.vendido_en = null
    sanitizedData.comprador_id = null

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rl = await checkRateLimit('producto:create', userId, { ip })
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiadas publicaciones. Espera ${Math.ceil(rl.resetIn / 60000)} min`, resetIn: rl.resetIn },
        { status: 429 }
      )
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Resolver categoria_id en el servidor (ver nota en publicar/page.tsx).
    // Se usa maybeSingle() en vez de single(): 0 filas es un caso esperado y
    // NO debe devolver 406. Si la categoría no existe todavía en la tabla, se
    // crea sobre la marcha con el service role — así 'repuestos' y
    // 'materiales' dejan de guardarse con categoria_id NULL.
    if (typeof categoriaKey === 'string' && categoriaKey.trim()) {
      const nombre = categoriaKey.trim().toLowerCase()
      const categoriaId = await resolverCategoriaId(sb, nombre)
      if (categoriaId !== null) sanitizedData.categoria_id = categoriaId
    }

    let { data, error } = await sb.from('productos').insert({ ...sanitizedData, user_id: userId }).select().single()

    // Fallback: si la migración 025 (columna `especificaciones`) todavía no se
    // ha aplicado en esta base de datos, PostgREST rechaza el INSERT entero con
    // PGRST204 / "Could not find the 'especificaciones' column". Antes de
    // perder la publicación del usuario, reintentamos sin ese campo.
    if (error && /especificaciones/i.test(error.message || '')) {
      console.warn('Columna `especificaciones` ausente — aplica la migración 025. Reintentando sin ella.')
      const { especificaciones: _omitida, ...sinSpecs } = sanitizedData
      ;({ data, error } = await sb.from('productos').insert({ ...sinSpecs, user_id: userId }).select().single())
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Revalidate ISR cache — product appears immediately on home/catalogo
    revalidatePath('/')
    revalidatePath('/catalogo')

    // Telegram alert if the server-side moderation marked the product pending.
    // Plain text avoids HTML/Markdown injection through user content.
    if (moderacion.nivel === 'sospechoso') {
      const BOT = process.env.TELEGRAM_BOT_TOKEN
      const CHAT = process.env.TELEGRAM_CHAT_ID
      if (BOT && CHAT) {
        fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT,
            text: `ALERTA MODERACIÓN — SOSPECHOSO\n\nTítulo: ${String(sanitizedData.titulo || '').slice(0, 200)}\nUsuario: ${auth.user.email || userId}\nPalabras: ${moderacion.palabras.join(', ')}`,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
