// Solo servidor/CLI. Nunca importar desde componentes cliente.
const { randomBytes } = require('node:crypto')
const { VENDEDORES, emailVendedor } = require('./semilla-datos.js')

async function buscarUsuarioPorEmail(sb, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`No se pudo consultar usuarios: ${error.message}`)
    const users = data?.users || []
    const hit = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (users.length < 200) return null
  }
}

// Aplicado también a los anuncios ya existentes al volver a ejecutar la semilla.
const CAMPOS_ANUNCIO_SEMILLA = {
  es_demo: true,
  metodos_contacto: {},
  vendedor_verificado: false,
  verificacion_homologacion: 'sin_verificar',
  verificacion_homologacion_revisada_en: null,
  reservado: false,
  reservado_hasta: null,
}

async function asegurarVendedores(sb, soloLectura = false) {
  const ids = {}
  let creados = 0, reutilizados = 0
  for (const v of VENDEDORES) {
    const email = emailVendedor(v)
    let usuario = await buscarUsuarioPorEmail(sb, email)
    // No modificar una cuenta real si coincide con uno de los emails del guion.
    if (usuario && usuario.app_metadata?.semilla !== true && usuario.user_metadata?.semilla !== true) {
      throw new Error(`La cuenta ${email} no pertenece a la semilla`)
    }
    if (usuario) reutilizados++
    if (soloLectura) {
      if (usuario) ids[v.slug] = usuario.id
      continue
    }
    // Rotar también las contraseñas antiguas, que eran públicas/previsibles.
    // El bloqueo impide iniciar sesión o renovar tokens de estas identidades.
    const credentials = { password: randomBytes(48).toString('base64url'), ban_duration: '876000h', app_metadata: { ...(usuario?.app_metadata || {}), semilla: true } }
    if (!usuario) {
      const { data, error } = await sb.auth.admin.createUser({
        email, ...credentials, email_confirm: true,
        user_metadata: { nombre: v.nombre, semilla: true },
      })
      if (error || !data?.user) throw new Error(`createUser ${email}: ${error?.message || 'sin usuario'}`)
      usuario = data.user
      creados++
    } else {
      const { error } = await sb.auth.admin.updateUserById(usuario.id, credentials)
      if (error) throw new Error(`Proteger cuenta ${email}: ${error.message}`)
    }
    ids[v.slug] = usuario.id
    const { error } = await sb.from('perfiles').upsert({
      id: usuario.id, nombre: v.nombre,
      telefono: null, estado: v.estado, ciudad: v.ciudad,
      whatsapp_disponible: false, telefono_visible: false, email_visible: false,
      verificado: false, verificado_desde: null, es_demo: true,
      tipo_vendedor: v.tipo || 'particular', actualizado_en: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) throw new Error(`perfil ${v.nombre}: ${error.message}`)
  }
  return { ids, creados, reutilizados }
}

module.exports = { buscarUsuarioPorEmail, asegurarVendedores, CAMPOS_ANUNCIO_SEMILLA }
