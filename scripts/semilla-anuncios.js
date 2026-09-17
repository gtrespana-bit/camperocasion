// ═══════════════════════════════════════════════════════════════════════════
// SEMILLA DE ANUNCIOS — CamperOcasión (versión LOCAL)
// ─────────────────────────────────────────────────────────────────────────────
// Rellena el marketplace con 20 anuncios completos y realistas. Los DATOS
// viven en src/lib/semilla-datos.js (compartidos con el endpoint admin
// /api/admin/semilla, que hace lo mismo desde el navegador sin instalar nada).
//
// USO (en un ordenador con el repo clonado):
//   1. Claves en .env.local:
//          NEXT_PUBLIC_SUPABASE_URL=https://hbiywrddxrsidniwxuhe.supabase.co
//          SUPABASE_SERVICE_KEY=eyJhbGciOi...   (service_role / sb_secret_...)
//   2. Ejecuta:
//          npm run semilla                   → inserta lo que falte
//          npm run semilla:reset             → borra lo sembrado y repuebla
//          node scripts/semilla-anuncios.js --dry-run  → plan sin tocar nada
//
// IDEMPOTENCIA: salta anuncios con el mismo título del mismo vendedor y las
// fotos se suben con upsert. ⚠️ SOLO para desarrollo / demostración.
// ═══════════════════════════════════════════════════════════════════════════

const path = require('path')
const fs = require('fs')

// Carga las claves de .env / .env.local (paquete dotenv si está; si no,
// parseo mínimo compatible con KEY=VALOR).
function cargarEnv() {
  try {
    require('dotenv').config({ path: '.env' })
    require('dotenv').config({ path: '.env.local', override: true })
    return
  } catch {
    for (const f of ['.env', '.env.local']) {
      if (!fs.existsSync(f)) continue
      for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
        const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const valor = m[2].replace(/^["']|["']$/g, '').trim()
        if (!process.env[m[1]]) process.env[m[1]] = valor
      }
    }
  }
}
cargarEnv()

const { VENDEDORES, ANUNCIOS, emailVendedor, haceHoras, dentroDias } = require('../src/lib/semilla-datos.js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const ARGS = process.argv.slice(2)
const RESET = ARGS.includes('--reset')
const DRY_RUN = ARGS.includes('--dry-run')

const BUCKET = 'productos-fotos'
const FOTOS_DIR = path.join(__dirname, 'semilla', 'fotos')
const CATEGORIA = 'camper'

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    '❌ Faltan credenciales. Define NEXT_PUBLIC_SUPABASE_URL y\n' +
      '   SUPABASE_SERVICE_KEY (o SUPABASE_SERVICE_ROLE_KEY) en .env.local\n' +
      '   (Supabase → Project Settings → API Keys → service_role / sb_secret_).\n' +
      '   Alternativa sin instalar nada: abre la web como admin y usa\n' +
      '   https://camperocasion.online/api/admin/semilla'
  )
  process.exit(1)
}

let supabase = null
if (!DRY_RUN) {
  const { createClient } = require('@supabase/supabase-js')
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function resolverCategoriaCamper() {
  const { data } = await supabase
    .from('categorias')
    .select('id')
    .eq('nombre', CATEGORIA)
    .maybeSingle()
  if (data?.id) return data.id

  const { data: creada, error } = await supabase
    .from('categorias')
    .insert({ nombre: CATEGORIA })
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`No se pudo crear la categoría "${CATEGORIA}": ${error.message}`)
  return creada.id
}

/** Busca un usuario por email (admin API, paginando). Null si no existe. */
async function buscarUsuarioPorEmail(email) {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers p.${page}: ${error.message}`)
    const hit = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (!data?.users?.length || data.users.length < 200) return null
    page++
  }
}

/** Crea (o reutiliza) los vendedores y deja sus perfiles completos. */
async function asegurarVendedores() {
  const ids = {}
  let creados = 0, reutilizados = 0

  for (const v of VENDEDORES) {
    const email = emailVendedor(v)
    let usuario = await buscarUsuarioPorEmail(email)

    if (!usuario) {
      const { data, error } = await supabase.auth.admin.createUser({
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

    const { error: pErr } = await supabase.from('perfiles').upsert(
      {
        id: usuario.id,
        nombre: v.nombre,
        telefono: v.telefono,
        estado: v.estado,
        ciudad: v.ciudad,
        whatsapp_disponible: true,
        telefono_visible: true,
        email_visible: false,
        verificado: v.verificado,
        ...(v.verificado ? { verificado_desde: haceHoras(24 * 200) } : {}),
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`perfil ${v.nombre}: ${pErr.message}`)
  }

  console.log(`👥 Vendedores: ${creados} creados, ${reutilizados} reutilizados (${VENDEDORES.length} en total)`)
  return ids
}

/** Sube una foto al bucket y devuelve su URL pública (upsert → idempotente). */
const urlCache = new Map()
async function subirFoto(sellerId, rutaRel) {
  const key = `${sellerId}/semilla/${rutaRel.replace(/\//g, '-')}`
  if (urlCache.has(key)) return urlCache.get(key)

  const buffer = fs.readFileSync(path.join(FOTOS_DIR, rutaRel))
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Storage ${key}: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  urlCache.set(key, data.publicUrl)
  return data.publicUrl
}

/** Borra todos los anuncios de los vendedores de la semilla (--reset). */
async function resetear(ids) {
  const idList = Object.values(ids)
  const { data: existentes, error: e1 } = await supabase
    .from('productos')
    .select('id')
    .in('user_id', idList)
  if (e1) throw new Error(`reset select: ${e1.message}`)
  if (!existentes?.length) {
    console.log('🧹 --reset: no había anuncios sembrados.\n')
    return
  }
  const { error } = await supabase.from('productos').delete().in('user_id', idList)
  if (error) throw new Error(`reset delete: ${error.message}`)
  console.log(`🧹 --reset: ${existentes.length} anuncios sembrados borrados.\n`)
}

async function main() {
  console.log('🚐 SEMILLA DE ANUNCIOS — CamperOcasión (local)')
  console.log(`   ${ANUNCIOS.length} anuncios · ${VENDEDORES.length} vendedores · modo ${DRY_RUN ? 'DRY-RUN' : RESET ? 'RESET + INSERT' : 'INSERT (salta existentes)'}\n`)

  // Validación local de fotos antes de tocar la red.
  let totalFotos = 0
  for (const a of ANUNCIOS) {
    for (const f of a.fotos) {
      if (!fs.existsSync(path.join(FOTOS_DIR, f))) {
        console.error(`❌ Falta la foto: scripts/semilla/fotos/${f} (anuncio "${a.titulo}")`)
        process.exit(1)
      }
      totalFotos++
    }
    if (!VENDEDORES.some(v => v.slug === a.vendedor)) {
      console.error(`❌ Vendedor desconocido "${a.vendedor}" en "${a.titulo}"`)
      process.exit(1)
    }
  }
  console.log(`📸 ${totalFotos} referencias a fotos locales verificadas (media ${(totalFotos / ANUNCIOS.length).toFixed(1)} por anuncio)\n`)

  if (DRY_RUN) {
    console.log('── Plan de inserción ─────────────────────────────────────────')
    for (const [i, a] of ANUNCIOS.entries()) {
      const v = VENDEDORES.find(x => x.slug === a.vendedor)
      console.log(
        `${String(i + 1).padStart(2, '0')}. ${a.titulo}\n    ${a.precio.toLocaleString('es-ES')} € · ${a.sub} · ${v.ciudad} · ${a.fotos.length} fotos · ${Object.keys(a.ficha).length} specs · desc ${a.descripcion.length} caracteres` +
          `${a.destacado ? ' · ⭐destacado' : ''}${a.boosteado ? ' · 🚀boost' : ''}${a.reservado ? ' · 🔒reservado' : ''}${a.verificacion === 'verificada' ? ' · ✅homologación verificada' : ''}`
      )
    }
    console.log('\n✅ Todo correcto (dry-run). Ejecuta sin --dry-run para sembrar.')
    return
  }

  const categoriaId = await resolverCategoriaCamper()
  console.log(`✅ Categoría "camper": id ${categoriaId}`)

  const ids = await asegurarVendedores()
  console.log()

  if (RESET) await resetear(ids)

  // Anuncios ya existentes (para saltarlos en modo normal).
  const { data: previos, error: ePrev } = await supabase
    .from('productos')
    .select('titulo, user_id')
    .in('user_id', Object.values(ids))
  if (ePrev) throw new Error(`consulta previos: ${ePrev.message}`)
  const yaExiste = new Set((previos || []).map(p => `${p.user_id}::${p.titulo}`))

  let insertados = 0, saltados = 0, fallidos = 0
  const errores = []
  const t0 = Date.now()

  for (const [i, a] of ANUNCIOS.entries()) {
    const etiqueta = `[${String(i + 1).padStart(2, '0')}/${ANUNCIOS.length}]`
    const sellerId = ids[a.vendedor]
    const vendedor = VENDEDORES.find(x => x.slug === a.vendedor)

    if (yaExiste.has(`${sellerId}::${a.titulo}`)) {
      console.log(`${etiqueta} ⏭️  ya existe: ${a.titulo.slice(0, 70)}`)
      saltados++
      continue
    }

    try {
      const urls = []
      for (const f of a.fotos) urls.push(await subirFoto(sellerId, f))

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
        metodos_contacto: {
          email: emailVendedor(vendedor),
          telefono: vendedor.telefono,
          whatsapp: vendedor.telefono,
        },
        estado_moderacion: 'aprobado',
        motivo_moderacion: null,
        activo: true,
        destacado: !!a.destacado,
        destacado_hasta: a.destacado ? dentroDias(25) : null,
        boosteado_en: a.boosteado ? haceHoras(18) : null,
        vendedor_verificado: vendedor.verificado,
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

      const { error } = await supabase.from('productos').insert(fila)
      if (error) throw new Error(error.message)

      console.log(`${etiqueta} ✅ ${a.titulo.slice(0, 64)}`)
      console.log(`       ${a.precio.toLocaleString('es-ES')} € · ${vendedor.ciudad} · ${a.fotos.length} fotos subidas · ${a.visitas} visitas`)
      insertados++
    } catch (err) {
      console.error(`${etiqueta} ❌ ${a.titulo.slice(0, 64)}`)
      console.error(`       Error: ${err.message}`)
      errores.push(`${a.titulo}: ${err.message}`)
      fallidos++
    }
    await sleep(120)
  }

  const segundos = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('\n════════════════════════════════════════════════════════════')
  console.log(`🎉 Terminado en ${segundos}s: ${insertados} insertados · ${saltados} ya existían · ${fallidos} fallidos`)
  if (fallidos > 0) {
    console.log('⚠️  Hubo fallos. Revisa los mensajes de arriba.')
    process.exitCode = 1
  } else {
    console.log('👉 Abre https://camperocasion.online/es/catalogo y verás los anuncios.')
    console.log('   Para sembrar de cero otra vez: npm run semilla:reset')
  }
}

main().catch(e => {
  console.error('\n💥 Error fatal:', e.message)
  process.exit(1)
})
