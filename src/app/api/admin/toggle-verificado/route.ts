import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

export async function POST(request: NextRequest) {
  try {
    // Solo admin: impedir auto-verificación
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { userId, verificado, verificado_desde } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (verificado === undefined || typeof verificado !== 'boolean') {
      return NextResponse.json({ error: 'verificado debe ser boolean' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateData: Record<string, any> = { verificado: verificado === true }
    if (verificado === true) {
      updateData.verificado_desde = verificado_desde || new Date().toISOString()
    }

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Push notification
    await notifyUser(supabaseAdmin, userId, {
      title: verificado ? '✅ Perfil verificado' : '❌ Verificación revocada',
      body: verificado
        ? 'Tu perfil ya está verificado en CamperOcasión.'
        : 'Tu perfil ya no está verificado en CamperOcasión.',
      tag: verificado ? 'verified' : 'verified-revoked',
      icon: '/icon-192.png',
      click_url: '/dashboard',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
