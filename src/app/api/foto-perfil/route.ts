import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // El userId SIEMPRE sale de la sesión (evita cambiar el avatar de otros)
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const userId = auth.user.id
    const ip = getClientIp(req)
    const limit = await checkRateLimit('foto-perfil:update', userId, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen debe ser menor a 2MB' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/avatar.${ext}`

    // Upload via service_role (bypass storage RLS)
    const { error: uploadErr } = await sb.storage
      .from('foto_perfil')
      .upload(filePath, file, { upsert: true, cacheControl: '3600', contentType: file.type })
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = sb.storage.from('foto_perfil').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    // Update profile via service_role (bypass table RLS)
    const { error: updateErr } = await sb
      .from('perfiles')
      .update({ foto_perfil_url: publicUrl })
      .eq('id', userId)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
