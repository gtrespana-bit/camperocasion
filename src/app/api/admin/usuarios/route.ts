import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Lista perfiles del marketplace con el email de auth.users.
 * `perfiles` no tiene columna email — vive en auth.users.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: perfiles, error } = await supabaseAdmin
      .from('perfiles')
      .select(
        'id, nombre, telefono, estado, ciudad, credito_balance, verificado, nivel_confianza, creado_en'
      )
      .order('creado_en', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Emails viven en auth.users; paginar hasta cubrir los perfiles cargados
    const emailById = new Map<string, string>()
    let page = 1
    const perPage = 200
    // Máximo 5 páginas (1000 usuarios) para no alargar la respuesta
    while (page <= 5) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (listError) {
        console.error('Error listando auth.users:', listError.message)
        break
      }
      const users = listData?.users || []
      for (const u of users) {
        if (u.id && u.email) emailById.set(u.id, u.email)
      }
      if (users.length < perPage) break
      page += 1
    }

    const usuarios = (perfiles || []).map((p) => ({
      ...p,
      email: emailById.get(p.id) || null,
    }))

    return NextResponse.json({ ok: true, usuarios })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
