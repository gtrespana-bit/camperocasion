import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import {
  VENDEDORES,
  ANUNCIOS,
  emailVendedor,
  haceHoras,
  dentroDias,
} from '@/lib/semilla-datos.js'

/**
 * SEMILLA DE ANUNCIOS (admin) — siembra el marketplace desde el navegador.
 *
 * Pensado para el flujo "todo en la nube": no hace falta clonar el repo ni
 * instalar nada en local. El admin abre esta URL en el navegador (con su
 * sesión iniciada) y pulsa un botón:
 *
 *   GET  /api/admin/semilla           → mini-panel HTML con los botones
 *   POST /api/admin/semilla           → siembra lo que falte (idempotente)
 *   POST /api/admin/semilla?dry=1     → solo informa del estado actual
 *   POST /api/admin/semilla?reset=1   → borra los anuncios sembrados y repuebla
 *
 * Seguridad: POST exige sesión de admin (requireAdmin, por cookies, igual
 * que el resto de /api/admin/*). La service_role key nunca sale del servidor:
 * se usa la que ya está configurada como env var del despliegue.
 *
 * Las fotos viajan en el repo (public/semilla-fotos/) porque la función
 * serverless no puede leer el filesystem del repo en ejecución: la ruta las
 * descarga de su propio dominio y las sube al bucket `productos-fotos`,
 * exactamente como hace la app con las fotos de un vendedor real.
 */

// Puede tardar ~1 min con las 68 fotos; ampliamos el límite de la función.
export const maxDuration = 300

const BUCKET = 'productos-fotos'
const CATEGORIA = 'camper'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function resolverCategoriaCamper(sb: any): Promise<number> {
  const { data } = await sb.from('categorias').select('id').eq('nombre', CATEGORIA).maybeSingle()
  if (data?.id != null) return data.id as number

  const { data: creada, error } = await sb
    .from('categorias')
    .insert({ nombre: CATEGORIA })
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`categoría "${CATEGORIA}": ${error.message}`)
  return creada.id as number
}

/** Busca un usuario por email con la admin API (paginando). */
async function buscarUsuarioPorEmail(sb: any, email: string): Promise<any | null> {
  let page = 1
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers p.${page}: ${error.message}`)
    const users = data?.users || []
    const hit = users.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (users.length < 200) return null
    page++
  }
}

/** Crea (o reutiliza) los 14 vendedores demo y completa sus perfiles. */
async function asegurarVendedores(sb: any): Promise<{ ids: Record<string, string>; creados: number; reutilizados: number }> {
  const ids: Record<string, string> = {}
  let creados = 0
  let reutilizados = 0

  for (const v of VENDEDORES as any[]) {
    const email = emailVendedor(v)
    let usuario = await buscarUsuarioPorEmail(sb, email)

    if (!usuario) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: `Semilla#${v.slug}#camper2026`,
        email_confirm: true,
        user_metadata: { nombre: v.nombre, semilla: true },
      })
      if (error) throw new Error(`createUser ${email}: ${error.message}`)
      usuario = data.user
      creados++
    } else {
      reutilizados++
    }

    ids[v.slug] = usuario.id

    const { error: pErr } = await sb.from('perfiles').upsert(
      {
        id: usuario.id,
        nombre: v.nombre,
        // Sin teléfono: los números del guion de la semilla son inventados y
        // en España pertenecen a personas reales. Un anuncio de ejemplo no
        // debe poder generar llamadas.
        telefono: null,
        estado: v.estado,
        ciudad: v.ciudad,
        whatsapp_disponible: false,
        telefono_visible: false,
        email_visible: false,
        // Los perfiles de la semilla NUNCA son verificados: el sello
        // "verificado" es una promesa de identidad comprobada.
        verificado: false,
        es_demo: true,
        tipo_vendedor: v.tipo || 'particular',
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (pErr) throw new Error(`perfil ${v.nombre}: ${pErr.message}`)
  }

  return { ids, creados, reutilizados }
}

/**
 * Sube una foto al bucket y devuelve su URL pública (upsert → idempotente).
 * La descarga del propio despliegue (public/semilla-fotos/...).
 */
async function subirFoto(
  sb: any,
  origen: string,
  cache: Map<string, string>,
  sellerId: string,
  rutaRel: string,
): Promise<string> {
  const key = `${sellerId}/semilla/${rutaRel.replace(/\//g, '-')}`
  const enCache = cache.get(key)
  if (enCache) return enCache

  const res = await fetch(`${origen}/semilla-fotos/${rutaRel}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`no se pudo descargar /semilla-fotos/${rutaRel} (HTTP ${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())

  const { error } = await sb.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Storage ${key}: ${error.message}`)

  const { data } = sb.storage.from(BUCKET).getPublicUrl(key)
  cache.set(key, data.publicUrl)
  return data.publicUrl as string
}

async function ejecutarSemilla(sb: any, origen: string, reset: boolean, dry: boolean) {
  const categoriaId = await resolverCategoriaCamper(sb)
  const { ids, creados, reutilizados } = await asegurarVendedores(sb)
  const sellerIds = Object.values(ids)

  // ¿Cuánto hay ya sembrado?
  const { data: previos, error: ePrev } = await sb
    .from('productos')
    .select('titulo, user_id')
    .in('user_id', sellerIds)
  if (ePrev) throw new Error(`consulta previos: ${ePrev.message}`)
  const yaExiste = new Set((previos || []).map((p: any) => `${p.user_id}::${p.titulo}`))

  if (dry) {
    return {
      modo: 'dry-run',
      vendedores: { total: (VENDEDORES as any[]).length, creados, reutilizados },
      anunciosPrevistos: (ANUNCIOS as any[]).length,
      anunciosYaSembrados: previos?.length || 0,
      pendientes: (ANUNCIOS as any[]).filter((a) => !yaExiste.has(`${ids[a.vendedor]}::${a.titulo}`)).length,
      mensaje: 'No se ha modificado nada. Pulsa "Generar anuncios" para sembrar.',
    }
  }

  let borrados = 0
  if (reset && (previos?.length || 0) > 0) {
    const { error } = await sb.from('productos').delete().in('user_id', sellerIds)
    if (error) throw new Error(`reset delete: ${error.message}`)
    borrados = previos!.length
    yaExiste.clear()
  }

  const urlCache = new Map<string, string>()
  let insertados = 0
  let saltados = 0
  const fallidos: string[] = []

  for (const a of ANUNCIOS as any[]) {
    const sellerId = ids[a.vendedor]
    const vendedor = (VENDEDORES as any[]).find((x) => x.slug === a.vendedor)

    if (yaExiste.has(`${sellerId}::${a.titulo}`)) {
      saltados++
      continue
    }

    try {
      const urls: string[] = []
      for (const f of a.fotos as string[]) {
        urls.push(await subirFoto(sb, origen, urlCache, sellerId, f))
      }

      const creado = haceHoras(a.creado)
      const fila = {
        user_id: sellerId,
        titulo: a.titulo,
        descripcion: a.descripcion,
        categoria_id: categoriaId,
        subcategoria: a.sub,
        marca: a.marca,
        modelo: a.modelo,
        estado: a.estado,
        precio: a.precio,
        precio_eur: a.precio,
        precio_usd: a.precio, // columna legado: aquí se guarda en euros
        ubicacion_estado: vendedor.estado,
        ubicacion_ciudad: vendedor.ciudad,
        imagen_url: urls[0],
        imagenes: urls,
        especificaciones: a.ficha,
        // Solo el email de la propia plataforma: sin teléfono ni WhatsApp,
        // porque el anuncio es un ejemplo y no hay nadie al otro lado.
        metodos_contacto: { email: emailVendedor(vendedor) },
        es_demo: true,
        estado_moderacion: 'aprobado',
        motivo_moderacion: null,
        activo: true,
        destacado: !!a.destacado,
        destacado_hasta: a.destacado ? dentroDias(25) : null,
        boosteado_en: a.boosteado ? haceHoras(18) : null,
        // El sello de vendedor verificado no se hereda de un guion: los
        // anuncios de demostración salen siempre sin verificar.
        vendedor_verificado: false,
        verificacion_homologacion: a.verificacion || 'sin_verificar',
        ...(a.verificacion === 'verificada'
          ? { verificacion_homologacion_revisada_en: haceHoras(Math.max(a.creado - 30, 12)) }
          : {}),
        vendido: false,
        vendido_en: null,
        comprador_id: null,
        reservado: !!a.reservado,
        ...(a.reservado ? { reservado_hasta: dentroDias(4) } : {}),
        visitas: a.visitas,
        creado_en: creado,
        actualizado_en: creado,
      }

      const { error } = await sb.from('productos').insert(fila)
      if (error) throw new Error(error.message)
      insertados++
    } catch (err: any) {
      fallidos.push(`${a.titulo}: ${err.message}`)
    }
  }

  return {
    modo: reset ? 'reset' : 'insert',
    vendedores: { total: (VENDEDORES as any[]).length, creados, reutilizados },
    borradosEnReset: borrados,
    insertados,
    saltados,
    fallidos: fallidos.length,
    errores: fallidos,
    mensaje:
      fallidos.length === 0
        ? '✅ Semilla terminada. Abre /catalogo y verás los anuncios.'
        : '⚠️ Terminado con errores — revisa "errores" y reintenta (es idempotente).',
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  try {
    const url = new URL(request.url)
    const reset = url.searchParams.get('reset') === '1'
    const dry = url.searchParams.get('dry') === '1'
    const sb = getClient()
    const resultado = await ejecutarSemilla(sb, url.origin, reset, dry)
    return NextResponse.json({ ok: resultado.fallidos === 0 || resultado.modo === 'dry-run', ...resultado })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

/** Mini-panel HTML: sin framework, habla con POST usando las cookies de sesión. */
export async function GET(request: NextRequest) {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Semilla de anuncios — CamperOcasión</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; background:#0f172a; color:#e2e8f0; }
  h1 { font-size: 22px; } p { line-height: 1.5; color:#94a3b8; }
  button { font-size:15px; padding: 12px 18px; border-radius: 10px; border: 0; cursor: pointer; margin: 6px 8px 6px 0; font-weight: 600; }
  .estado { background:#334155; color:#e2e8f0; }
  .generar { background:#16a34a; color:#fff; }
  .reset { background:#b91c1c; color:#fff; }
  button:disabled { opacity:.5; cursor:wait; }
  pre { background:#020617; border:1px solid #1e293b; border-radius:10px; padding:14px; white-space:pre-wrap; word-break:break-word; font-size:13px; max-height:60vh; overflow:auto; }
</style>
</head>
<body>
<h1>🚐 Semilla de anuncios</h1>
<p>Genera <strong>20 anuncios completos</strong> (gran volumen, mediana, mini, perfilada, capuchina, integral y overland) con ficha técnica, descripciones reales y 68 fotos, repartidos entre 14 vendedores de demostración por toda España. Es idempotente: no duplica lo que ya exista.</p>
<p>
  <button class="estado" onclick="ejecutar('dry=1')">👀 Ver estado (sin tocar nada)</button>
  <button class="generar" id="btn-gen" onclick="ejecutar('')">🌱 Generar 20 anuncios</button>
  <button class="reset" onclick="reiniciar()">🧹 Reset (borra lo sembrado y repuebla)</button>
</p>
<pre id="log">Pulsa un botón para empezar…</pre>
<script>
async function ejecutar(qs) {
  const log = document.getElementById('log')
  for (const b of document.querySelectorAll('button')) b.disabled = true
  log.textContent = '⏳ Trabajando… (las fotos tardan ~1 minuto)\\n'
  try {
    const res = await fetch('/api/admin/semilla' + (qs ? '?' + qs : ''), {
      method: 'POST',
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      log.textContent = res.status === 401 || res.status === 403
        ? '⛔ ' + res.status + ' — Inicia sesión como administrador y vuelve a entrar en esta página.'
        : '❌ Error ' + res.status + '\\n' + (data ? JSON.stringify(data, null, 2) : '(sin cuerpo)')
    } else {
      log.textContent = JSON.stringify(data, null, 2)
    }
  } catch (e) {
    log.textContent = '❌ Error de red: ' + e
  } finally {
    for (const b of document.querySelectorAll('button')) b.disabled = false
  }
}
function reiniciar() {
  if (confirm('¿Seguro? Se BORRARÁN todos los anuncios sembrados y se volverán a insertar desde cero.')) {
    ejecutar('reset=1')
  }
}
</script>
</body>
</html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
