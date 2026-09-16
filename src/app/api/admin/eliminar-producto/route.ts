/**
 * API Route: Eliminar producto definitivamente (owner y admin)
 * 
 * POST /api/admin/eliminar-producto
 * Body: { productId: string }
 * 
 * - Si el usuario de la sesión es el dueño del producto → borrado por propietario
 * - Si el usuario de la sesión es admin → borrado por admin
 * - Borra también las imágenes de R2
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireUUIDs } from '@/lib/validation'
import { requireUser, getAdminEmails } from '@/lib/require-auth'

export async function POST(req: NextRequest) {
  try {
    // El propietario (o admin) debe ser la sesión real; antes era un userId opcional del body
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const sessionUserId = auth.user.id
    const isAdmin = getAdminEmails().includes((auth.user.email || '').toLowerCase())

    const body = await req.json()
    const { productId } = body

    // Validar UUIDs
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the product
    const { data: producto, error: prodError } = await supabaseAdmin
      .from('productos')
      .select('id, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, user_id, imagen_url, imagenes, destacado, destacado_hasta, boosteado_en')
      .eq('id', productId)
      .single()

    if (prodError || !producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Only owner or admin can delete
    if (producto.user_id !== sessionUserId && !isAdmin) {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    // Also delete images from R2
    const R2_BUCKET = process.env.R2_BUCKET || 'vendet-fotos'
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })

    const imagenesUrl = (producto.imagenes as string[]) || []
    const imagenUrl = producto.imagen_url
    const allUrls = [imagenUrl, ...imagenesUrl].filter(Boolean) as string[]

    const deletePromises = allUrls.map(async (url) => {
      if (!url.includes(R2_PUBLIC_URL)) return
      const key = url.replace(R2_PUBLIC_URL + '/', '')
      if (!key) return
      try {
        await r2Client.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        }))
      } catch (e) {
        console.error('Error deleting R2 image:', key, e)
      }
    })

    await Promise.all(deletePromises)

    // Delete from database
    const { error } = await supabaseAdmin
      .from('productos')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('Database delete error:', error)
      return NextResponse.json({ error: 'Error al eliminar: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
