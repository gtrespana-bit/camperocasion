import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

/**
 * Listado y gestión de denuncias.
 *
 * `denuncias` está protegida por RLS (`reportante o is_admin()`), y el embed
 * `reportante:perfiles(nombre)` del cliente era inválido (no existe FK directa
 * `denuncias -> perfiles`), lo que producía un 400. Aquí se resuelve todo con
 * service_role: se embebe el producto por su FK real y se resuelve el nombre
 * del reportante con una consulta aparte a `perfiles`.
 */

const DENUNCIA_COLUMNS = 'id, producto_id, reportante_id, motivo, descripcion, estado, creada_en'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const [{ data: activas, error: errorActivas }, { data: revisadas, error: errorRevisadas }] =
      await Promise.all([
        sb
          .from('denuncias')
          .select(`${DENUNCIA_COLUMNS}, producto:productos(titulo, user_id, precio_usd, imagen_url)`)
          .eq('estado', 'activa')
          .order('creada_en', { ascending: false }),
        sb
          .from('denuncias')
          .select('id, producto_id, motivo, estado, creada_en')
          .in('estado', ['resuelta', 'invalidada'])
          .order('creada_en', { ascending: false })
          .limit(20),
      ])

    if (errorActivas || errorRevisadas) {
      return NextResponse.json(
        { error: (errorActivas || errorRevisadas)!.message },
        { status: 500 },
      )
    }

    // Resolver nombre del reportante (no hay FK denuncias -> perfiles).
    const reportanteIds = Array.from(
      new Set((activas || []).map((d: any) => d.reportante_id).filter(Boolean)),
    ).slice(0, 100)

    const nombreById: Record<string, string> = {}
    if (reportanteIds.length > 0) {
      const { data: perfiles } = await sb
        .from('perfiles')
        .select('id, nombre')
        .in('id', reportanteIds)
      ;(perfiles || []).forEach((p: any) => {
        nombreById[p.id] = p.nombre
      })
    }

    const denuncias = (activas || []).map((d: any) => ({
      ...d,
      reportante: { nombre: nombreById[d.reportante_id] || null },
    }))

    return NextResponse.json({ ok: true, denuncias, revisados: revisadas || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { action, id } = body

    const uuidCheck = requireUUIDs(body, ['id'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (!['ignorar', 'bloquear'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const estado = action === 'ignorar' ? 'invalidada' : 'resuelta'
    const { error } = await sb
      .from('denuncias')
      .update({ estado, resuelta_en: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
