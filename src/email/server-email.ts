'use server'
import { enviarEmailSMTP } from '@/lib/server-email'

async function enviar(_fromName: string, email: string, subject: string, html: string) {
  // Canal central: Resend API (RESEND_API_KEY) con fallback a SMTP.
  return enviarEmailSMTP(email, subject, html)
}

interface UserEmails {
  nombres: { nombre: string; email: string }[]
}

/**
 * 1. NUEVO PRODUCTO PUBLICADO
 */
export async function enviarEmailProducto(
  email: string,
  nombre: string,
  titulo: string,
  precio: string,
  slug: string
) {
  const url = `${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/producto/${slug}`
  return enviar('CamperOcasión', email, '✅ Tu anuncio fue publicado', `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">Hola ${nombre}!</h2>
      <p>Tu anuncio fue publicado exitosamente:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:bold">${titulo}</p>
        <p style="margin:8px 0 0;color:#1e3a8a;font-size:20px;font-weight:bold">${precio}</p>
      </div>
      <a href="${url}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:8px">Ver anuncio →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión — Publica más, vende más</p>
    </div>
  `)
}

/**
 * 2. MENSAJE RECIBIDO (aviso diferido de mensajes no leídos)
 *
 * Se envía desde el cron `avisos-mensajes`, no en el momento de recibir el
 * mensaje: si el usuario estaba en la web y ya ha respondido, no recibe nada.
 * Agrupa todos los mensajes no leídos de una misma conversación en un único
 * email para no reventar la bandeja de entrada en una charla animada.
 */
export async function enviarEmailMensaje(
  email: string,
  nombreDestinatario: string,
  nombreRemitente: string,
  producto: string,
  mensajePreview: string,
  opciones?: { total?: number; conversacionId?: string }
) {
  const base = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'
  const url = opciones?.conversacionId
    ? `${base}/chat?conversation=${opciones.conversacionId}`
    : `${base}/chat`
  const total = opciones?.total || 1
  const asunto = total > 1
    ? `💬 ${nombreRemitente} te ha enviado ${total} mensajes sobre "${producto}"`
    : `💬 ${nombreRemitente} te ha escrito sobre "${producto}"`

  return enviar('CamperOcasión', email, asunto, `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">¡Hola ${nombreDestinatario}!</h2>
      <p><strong>${nombreRemitente}</strong> está interesado en:</p>
      <p style="font-weight:bold">${producto}</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0;font-style:italic">&ldquo;${mensajePreview}&rdquo;</div>
      ${total > 1 ? `<p style="color:#6b7280;font-size:14px">Y ${total - 1} mensaje${total - 1 === 1 ? '' : 's'} más sin leer.</p>` : ''}
      <a href="${url}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Responder &rarr;</a>
      <p style="color:#6b7280;font-size:13px;margin-top:20px">Los compradores contactan con varios vendedores a la vez: quien responde antes, vende.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        CamperOcasión &middot;
        <a href="${base}/dashboard?tab=perfil" style="color:#6b7280">Dejar de recibir estos avisos</a>
      </p>
    </div>
  `)
}

/**
 * 3. CRÉDITOS AÑADIDOS
 */
export async function enviarEmailCreditos(
  email: string,
  nombre: string,
  cantidad: number,
  balanceTotal: number
) {
  return enviar('CamperOcasión', email, `✅ +${cantidad} créditos en tu cuenta`, `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">Hola ${nombre}!</h2>
      <p>Se acreditaron <strong style="color:#1e3a8a;font-size:22px">${cantidad} créditos</strong> a tu cuenta.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:10px;margin:16px 0;text-align:center">
        <p style="margin:0;color:#6b7280;font-size:12px">Balance total</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e3a8a">${balanceTotal}</p>
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión</p>
    </div>
  `)
}

/**
 * 4. VERIFICACIÓN COMPLETADA
 */
export async function enviarEmailVerificacion(
  email: string,
  nombre: string
) {
  return enviar('CamperOcasión', email, '🎉 Tu cuenta fue verificada!', `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">Hola ${nombre}!</h2>
      <div style="text-align:center;padding:20px">
        <p style="font-size:48px;margin:0">✅</p>
        <p style="font-size:20px;font-weight:bold;margin:12px 0">Tu cuenta fue verificada</p>
        <p>Ahora tienes el sello de verificación visible en todos tus anuncios. Los compradores confían más en vendedores verificados.</p>
      </div>
      <a href="${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/dashboard" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ir a tu perfil →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión</p>
    </div>
  `)
}

/**
 * 5. SUBIDA DE NIVEL
 */
export async function enviarEmailNivel(
  email: string,
  nombre: string,
  nivelNuevo: string,
  nivelAnterior: string
) {
  const nivelesEmoji: Record<string, string> = {
    'Bronce': '🥉',
    'Plata': '🥈',
    'Oro': '🥇',
    'Diamante': '💎',
  }
  const emoji = nivelesEmoji[nivelNuevo] || '⭐'
  return enviar('CamperOcasión', email, `${emoji} Subiste de nivel: ${nivelNuevo}!`, `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">Hola ${nombre}!</h2>
      <div style="text-align:center;padding:20px">
        <p style="font-size:48px;margin:0">${emoji}</p>
        <p style="font-size:20px;font-weight:bold;margin:12px 0">Ahora eres ${nivelNuevo}</p>
        <p>Subiste de <strong>${nivelAnterior}</strong> a <strong>${nivelNuevo}</strong>!</p>
      </div>
      <a href="${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/dashboard?tab=perfil" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ver perfil →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión</p>
    </div>
  `)
}

/**
 * DEV: Buscar emails de usuarios
 */
export async function buscarEmailUsuario(userId: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('perfiles')
    .select('nombre')
    .eq('id', userId)
    .single()

  // Buscar email en auth.users
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.id === userId)

  if (user && data && user.email) {
    return { nombre: data.nombre, email: user.email }
  }
  return null
}

/**
 * DEV: Buscar todos los emails de perfiles
 */
export async function buscarEmailsUsuarios(userIds: string[]): Promise<UserEmails['nombres']> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authUsers } = await supabase.auth.admin.listUsers()
  return authUsers.users
    .filter(u => userIds.includes(u.id) && u.email)
    .map(u => ({ nombre: u.email?.split('@')[0] || '', email: u.email! }))
}

/**
 * DIGEST SEMANAL DEL VENDEDOR
 * "Tus anuncios tuvieron N vistas esta semana" — endowment: le recuerda
 * el valor que la plataforma le genera gratis y lo trae de vuelta.
 */
export async function enviarDigestVendedor(
  email: string,
  nombre: string,
  stats: { visitas: number; guardados: number; topTitulo?: string }
) {
  const url = `${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/dashboard`
  const topLine = stats.topTitulo
    ? `<p style="margin:8px 0 0;color:#4b5563">Tu anuncio más visto: <strong>${stats.topTitulo}</strong></p>`
    : ''
  return enviar('CamperOcasión', email, `📊 ${stats.visitas} personas vieron tus anuncios esta semana`, `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#0F172A">Hola ${nombre}!</h2>
      <p>Así fueron tus anuncios esta semana en CamperOcasión:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0;text-align:center">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#0F172A">👀 ${stats.visitas}</p>
        <p style="margin:4px 0 12px;color:#6b7280">vistas esta semana</p>
        <p style="margin:0;font-size:20px;font-weight:bold;color:#0F172A">❤️ ${stats.guardados}</p>
        <p style="margin:4px 0 0;color:#6b7280">personas guardaron tus anuncios</p>
        ${topLine}
      </div>
      <p>¿Ya renovaste tus anuncios? Renovar los sube como "recién publicados" — gratis.</p>
      <a href="${url}" style="display:inline-block;background:#0F172A;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ver mis anuncios →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión — Publica más, vende más</p>
    </div>
  `)
}
