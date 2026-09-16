/**
 * API Route: Sube una foto directamente a Supabase Storage (bucket productos-fotos).
 *
 * POST /api/storage-upload  (multipart/form-data)
 *   - file: File
 *   - key:  ruta dentro del bucket, p.ej. "<userId>/<timestamp>_<n>.jpg"
 *
 * Respuesta: { publicUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const BUCKET = 'productos-fotos'
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const userId = auth.user.id
    const ip = getClientIp(req)
    const limit = await checkRateLimit('storage-upload', userId, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const formData = await req.formData()
    const file = formData.get('file')
    const key = String(formData.get('key') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
    }
    if (!key) return NextResponse.json({ error: 'Key faltante' }, { status: 400 })
    if (!key.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Key no permitida' }, { status: 403 })
    }
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const supabase = getSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 })
    }

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploadErr) {
      console.error('Supabase storage upload error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message || 'Error al subir' }, { status: 500 })
    }

    const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(key)
    const publicUrl = pubData.publicUrl

    return NextResponse.json({ publicUrl })
  } catch (error) {
    console.error('storage-upload error:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
