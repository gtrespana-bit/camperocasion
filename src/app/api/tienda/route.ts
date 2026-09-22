/**
 * GET/PUT /api/tienda — gestión del escaparate del vendedor profesional.
 *
 * Reglas:
 *  · Solo el dueño edita su tienda: el usuario sale de la sesión verificada,
 *    nunca de un id enviado en el body.
 *  · Solo camperizadores y profesionales pueden activarla (el trigger de la
 *    base lo vuelve a comprobar; aquí se hace para dar un error legible).
 *  · La web se normaliza y se valida: acaba en un `href` de una página pública,
 *    así que un `javascript:` no puede llegar a la base.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  LIMITES_TIENDA,
  normalizarWeb,
  puedeTenerTienda,
  slugReservado,
  slugValido,
  slugify,
  validarTienda,
} from '@/lib/tiendas'

export const dynamic = 'force-dynamic'

const CAMPOS =
  'id, slug, nombre, descripcion, web, portada_url, horario, direccion, ' +
  'ciudad, estado, tipo_vendedor, tienda_activa, foto_perfil_url'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const sb = admin()
  if (!sb) return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })

  const { data, error } = await sb.from('perfiles').select(CAMPOS).eq('id', user.id).maybeSingle()

  if (error) {
    // La migración de tiendas puede no estar aplicada todavía: se avisa en
    // lugar de devolver un 500 sin explicación.
    return NextResponse.json(
      { ok: false, error: 'La tienda aún no está disponible.', migracionPendiente: true },
      { status: 503 }
    )
  }

  const tienda = (data || null) as Record<string, any> | null

  return NextResponse.json({
    ok: true,
    tienda,
    puedeAbrir: puedeTenerTienda(tienda?.tipo_vendedor),
  })
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('perfil:actualizar', user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiados cambios seguidos. Espera ${Math.ceil(rl.resetIn / 60000)} min` },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const sb = admin()
  if (!sb) return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })

  const { data: perfil } = await sb
    .from('perfiles')
    .select('id, tipo_vendedor, slug')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) return NextResponse.json({ ok: false, error: 'Perfil no encontrado' }, { status: 404 })

  const quiereActiva = Boolean(body?.tienda_activa)
  if (quiereActiva && !puedeTenerTienda(perfil.tipo_vendedor)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Solo los camperizadores y vendedores profesionales pueden abrir tienda. Cambia tu tipo de vendedor en tu perfil.',
      },
      { status: 403 }
    )
  }

  const errores = validarTienda({
    nombre: body?.nombre,
    descripcion: body?.descripcion,
    web: body?.web,
    horario: body?.horario,
    direccion: body?.direccion,
    slug: body?.slug,
  })
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, error: Object.values(errores)[0], errores }, { status: 400 })
  }

  const recorta = (valor: unknown, max: number) =>
    typeof valor === 'string' ? valor.trim().slice(0, max) || null : null

  const cambios: Record<string, unknown> = {
    tienda_activa: quiereActiva,
    descripcion: recorta(body?.descripcion, LIMITES_TIENDA.descripcion),
    horario: recorta(body?.horario, LIMITES_TIENDA.horario),
    direccion: recorta(body?.direccion, LIMITES_TIENDA.direccion),
    web: normalizarWeb(body?.web),
  }

  if (typeof body?.nombre === 'string' && body.nombre.trim()) {
    cambios.nombre = body.nombre.trim().slice(0, 120)
  }

  // El slug solo se cambia si lo pide explícitamente. No se regenera al
  // cambiar el nombre: una URL ya repartida que muta sola rompe los enlaces
  // que el vendedor puso en su web y en Instagram.
  if (typeof body?.slug === 'string' && body.slug.trim()) {
    const deseado = slugify(body.slug)
    if (!slugValido(deseado) || slugReservado(deseado)) {
      return NextResponse.json({ ok: false, error: 'Esa dirección no es válida.' }, { status: 400 })
    }
    if (deseado !== perfil.slug) {
      const { data: ocupado } = await sb
        .from('perfiles')
        .select('id')
        .eq('slug', deseado)
        .neq('id', user.id)
        .maybeSingle()
      if (ocupado) {
        return NextResponse.json(
          { ok: false, error: 'Esa dirección ya está en uso. Prueba con otra.' },
          { status: 409 }
        )
      }
      cambios.slug = deseado
    }
  }

  const { data, error } = await sb
    .from('perfiles')
    .update(cambios)
    .eq('id', user.id)
    .select(CAMPOS)
    .maybeSingle()

  if (error) {
    const msg = /tienda/i.test(error.message)
      ? error.message
      : 'No se pudo guardar la tienda. Inténtalo de nuevo.'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true, tienda: data })
}
