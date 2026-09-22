/**
 * API Route: Sube una foto a Supabase Storage (bucket productos-fotos).
 *
 * POST /api/storage-upload  (multipart/form-data)
 *   - file: File
 *   - key:  ruta dentro del bucket, p.ej. "<userId>/<timestamp>_<n>.webp"
 *
 * Respuesta: { publicUrl: string }
 *
 * Importante: se sube con service_role DESPUÉS de exigir sesión. El cliente
 * ligero con anon key no lleva JWT del usuario, así que RLS de Storage
 * (`TO authenticated` + carpeta = auth.uid()) rechaza siempre la subida
 * y el anuncio se publicaba sin foto.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const BUCKET = 'productos-fotos'
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function extensionDe(file: File, key: string): string {
  if (file.type === 'image/webp' || key.endsWith('.webp')) return 'webp'
  if (file.type === 'image/png' || key.endsWith('.png')) return 'png'
  return 'jpg'
}

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
    const keyRaw = String(formData.get('key') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
    }
    if (!keyRaw) return NextResponse.json({ error: 'Key faltante' }, { status: 400 })
    if (!keyRaw.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Key no permitida' }, { status: 403 })
    }
    const tipo = (file.type || '').toLowerCase()
    if (tipo && !TIPOS_PERMITIDOS.includes(tipo) && !tipo.startsWith('image/')) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }
    if (tipo && !TIPOS_PERMITIDOS.includes(tipo) && tipo.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Usa JPG, PNG o WebP (el recorte del móvil a HEIC no se admite).' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 })
    }

    const ext = extensionDe(file, keyRaw)
    const seguro = keyRaw.replace(/[^a-zA-Z0-9._/-]/g, '_')
    const base = seguro.replace(/\.[^.]+$/, '')
    const key = `${base}.${ext}`

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType =
      tipo === 'image/png' ? 'image/png' : tipo === 'image/webp' ? 'image/webp' : 'image/jpeg'

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, buffer, {
        contentType,
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploadErr) {
      console.error('Supabase storage upload error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message || 'Error al subir' }, { status: 500 })
    }

    const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(key)
    return NextResponse.json({ publicUrl: pubData.publicUrl })
  } catch (error) {
    console.error('storage-upload error:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
