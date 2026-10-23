'use server'
import { enviarEmailSMTP } from '@/lib/server-email'
import { escapeHtml } from '@/lib/html-escape'
import { emailLayout, COLORS } from '@/lib/email-layout'

const htmlText = (value: unknown) => escapeHtml(String(value ?? ''))

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
  const url = `${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/producto/${encodeURIComponent(slug)}`
  return enviar('CamperOcasión', email, '✅ Tu anuncio fue publicado', `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1e3a8a">Hola ${htmlText(nombre)}!</h2>
      <p>Tu anuncio fue publicado exitosamente:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:bold">${htmlText(titulo)}</p>
        <p style="margin:8px 0 0;color:#1e3a8a;font-size:20px;font-weight:bold">${htmlText(precio)}</p>
      </div>
      <a href="${htmlText(url)}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:8px">Ver anuncio →</a>
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
      <h2 style="color:#1e3a8a">¡Hola ${htmlText(nombreDestinatario)}!</h2>
      <p><strong>${htmlText(nombreRemitente)}</strong> está interesado en:</p>
      <p style="font-weight:bold">${htmlText(producto)}</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0;font-style:italic">&ldquo;${htmlText(mensajePreview)}&rdquo;</div>
      ${total > 1 ? `<p style="color:#6b7280;font-size:14px">Y ${total - 1} mensaje${total - 1 === 1 ? '' : 's'} más sin leer.</p>` : ''}
      <a href="${htmlText(url)}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Responder &rarr;</a>
      <p style="color:#6b7280;font-size:13px;margin-top:20px">Los compradores contactan con varios vendedores a la vez: quien responde antes, vende.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        CamperOcasión &middot;
        <a href="${htmlText(`${base}/dashboard?tab=perfil`)}" style="color:#6b7280">Dejar de recibir estos avisos</a>
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
      <h2 style="color:#1e3a8a">Hola ${htmlText(nombre)}!</h2>
      <p>Se acreditaron <strong style="color:#1e3a8a;font-size:22px">${htmlText(cantidad)} créditos</strong> a tu cuenta.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:10px;margin:16px 0;text-align:center">
        <p style="margin:0;color:#6b7280;font-size:12px">Balance total</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e3a8a">${htmlText(balanceTotal)}</p>
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
      <h2 style="color:#1e3a8a">Hola ${htmlText(nombre)}!</h2>
      <div style="text-align:center;padding:20px">
        <p style="font-size:48px;margin:0">✅</p>
        <p style="font-size:20px;font-weight:bold;margin:12px 0">Tu cuenta fue verificada</p>
        <p>Ahora tienes el sello de verificación visible en todos tus anuncios. Los compradores confían más en vendedores verificados.</p>
      </div>
      <a href="${htmlText(`${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/dashboard`)}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ir a tu perfil →</a>
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
      <h2 style="color:#1e3a8a">Hola ${htmlText(nombre)}!</h2>
      <div style="text-align:center;padding:20px">
        <p style="font-size:48px;margin:0">${emoji}</p>
        <p style="font-size:20px;font-weight:bold;margin:12px 0">Ahora eres ${htmlText(nivelNuevo)}</p>
        <p>Subiste de <strong>${htmlText(nivelAnterior)}</strong> a <strong>${htmlText(nivelNuevo)}</strong>!</p>
      </div>
      <a href="${htmlText(`${process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'}/dashboard?tab=perfil`)}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ver perfil →</a>
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
    ? `<p style="margin:8px 0 0;color:#4b5563">Tu anuncio más visto: <strong>${htmlText(stats.topTitulo)}</strong></p>`
    : ''
  return enviar('CamperOcasión', email, `📊 ${stats.visitas} personas vieron tus anuncios esta semana`, `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#0F172A">Hola ${htmlText(nombre)}!</h2>
      <p>Así fueron tus anuncios esta semana en CamperOcasión:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:10px;margin:16px 0;text-align:center">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#0F172A">👀 ${htmlText(stats.visitas)}</p>
        <p style="margin:4px 0 12px;color:#6b7280">vistas esta semana</p>
        <p style="margin:0;font-size:20px;font-weight:bold;color:#0F172A">❤️ ${htmlText(stats.guardados)}</p>
        <p style="margin:4px 0 0;color:#6b7280">personas guardaron tus anuncios</p>
        ${topLine}
      </div>
      <p>¿Ya renovaste tus anuncios? Renovar los sube como "recién publicados" — gratis.</p>
      <a href="${htmlText(url)}" style="display:inline-block;background:#0F172A;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Ver mis anuncios →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">CamperOcasión — Publica más, vende más</p>
    </div>
  `)
}

// ────────────────────────────────────────────────────────────────────────────
// AVISOS DE PLAN (fase 2): prueba, gracia, cobro fallido y anuncios pausados
//
// Son transaccionales, no marketing: van a quien tiene una suscripción o una
// prueba en curso, y siempre incluyen una salida (activar, actualizar tarjeta
// o pausar). Se envían desde el cron `/api/cron/planes` y desde el webhook,
// nunca en bucle por cada visita.
// ────────────────────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'

function fechaLarga(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function boton(texto: string, url: string): string {
  return `<a href="${htmlText(url)}" style="display:inline-block;background:${COLORS.accent};color:#fff;padding:13px 30px;text-decoration:none;border-radius:10px;font-weight:700;margin-top:8px">${htmlText(texto)}</a>`
}

/**
 * La prueba termina en N días (o hoy). Se manda a 10, 3 y 0 días.
 */
export async function enviarEmailTrialTermina(
  email: string,
  nombre: string,
  opts: { dias: number; fechaFin: string; plan: string },
) {
  const plan = opts.plan || 'Plus'
  const cuando =
    opts.dias <= 0
      ? 'hoy'
      : `en ${opts.dias} día${opts.dias === 1 ? '' : 's'}`
  const subject =
    opts.dias <= 0
      ? `Hoy es el último día de tu prueba ${plan}`
      : `Tu prueba ${plan} termina ${cuando}`

  const cuerpo = `
    <p style="margin:0 0 14px;font-size:16px;color:${COLORS.dark}">Hola ${htmlText(nombre)},</p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Tu prueba del pack <strong style="color:${COLORS.dark}">${htmlText(plan)}</strong> termina ${htmlText(cuando)}${opts.fechaFin ? ` (${htmlText(fechaLarga(opts.fechaFin))})` : ''}.
    </p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      <strong style="color:${COLORS.dark}">No se borra ninguno de tus anuncios.</strong> Si no activas un pack,
      tu cuenta volverá al plan gratuito y se pausarán los que excedan el cupo; podrás reactivarlos cuando quieras.
    </p>
    <p style="margin:0 0 18px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Si quieres mantener el cupo, el escaparate y los destacados incluidos, elige el pack que encaje con tu stock.
      Sin permanencia y se cancela en dos clics.
    </p>
    ${boton('Ver packs y activar', `${SITE_URL}/dashboard?tab=plan`)}
    <p style="margin:18px 0 0;font-size:13px;color:${COLORS.gray}">
      Si ya has activado un pack, ignora este mensaje.
    </p>
    <p style="margin:22px 0 0;font-size:13px;color:${COLORS.gray}">CamperOcasión — Publica más, vende más</p>
  `
  return enviar(
    'CamperOcasión',
    email,
    subject,
    emailLayout(`Tu prueba ${plan} está por terminar`, cuerpo),
  )
}

/**
 * La prueba ya terminó y empieza la gracia. Explica qué pasa y cuándo.
 */
export async function enviarEmailTrialGracia(
  email: string,
  nombre: string,
  opts: { graciaHasta: string; graciaDias: number; pausados?: number },
) {
  const pausados = Math.max(0, Number(opts.pausados) || 0)
  const cuerpo = `
    <p style="margin:0 0 14px;font-size:16px;color:${COLORS.dark}">Hola ${htmlText(nombre)},</p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Tu prueba ha terminado. Te damos <strong style="color:${COLORS.dark}">${htmlText(opts.graciaDias)} días de gracia</strong>
      (hasta el ${htmlText(fechaLarga(opts.graciaHasta))}) para decidir con calma.
    </p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Durante la gracia todo sigue como está: tus anuncios publicados, tu escaparate y tus estadísticas.
      Después, si no activas un pack, se pausarán los anuncios que excedan el cupo del plan gratuito.
      <strong style="color:${COLORS.dark}">No se borra nada.</strong>
    </p>
    ${pausados > 0 ? `<p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray}">Ahora mismo tienes <strong>${pausados}</strong> anuncio${pausados === 1 ? '' : 's'} más de los que permite el plan gratuito.</p>` : ''}
    ${boton('Activar mi pack', `${SITE_URL}/dashboard?tab=plan`)}
    <p style="margin:18px 0 0;font-size:13px;color:${COLORS.gray}">
      ¿Prefieres otra cosa? Desde tu panel puedes pausar anuncios y seguir gratis.
    </p>
    <p style="margin:22px 0 0;font-size:13px;color:${COLORS.gray}">CamperOcasión</p>
  `
  return enviar(
    'CamperOcasión',
    email,
    `Tu prueba terminó: ${opts.graciaDias} días de gracia`,
    emailLayout('Tu prueba ha terminado', cuerpo),
  )
}

/**
 * Dunning: no se ha podido cobrar el pack. Nunca se corta el acceso en este
 * email; se pide actualizar la tarjeta y se recuerda hasta cuándo hay servicio.
 */
export async function enviarEmailPagoFallido(
  email: string,
  nombre: string,
  opts: { plan: string; fechaFin?: string | null; diasGracia?: number },
) {
  const plan = opts.plan || 'tu pack'
  const cuerpo = `
    <p style="margin:0 0 14px;font-size:16px;color:${COLORS.dark}">Hola ${htmlText(nombre)},</p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      No hemos podido cobrar <strong style="color:${COLORS.dark}">${htmlText(plan)}</strong> en la tarjeta que tenemos guardada.
      Suele ser una tarjeta caducada o un límite del banco: se arregla en un minuto.
    </p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      <strong style="color:${COLORS.dark}">Tu plan sigue activo${opts.fechaFin ? ` hasta el ${htmlText(fechaLarga(opts.fechaFin))}` : ''}.</strong>
      No hemos pausado ningún anuncio. Actualiza el método de pago y no tendrás que hacer nada más.
    </p>
    ${boton('Actualizar mi tarjeta', `${SITE_URL}/dashboard?tab=plan`)}
    <p style="margin:18px 0 0;font-size:13px;color:${COLORS.gray}">
      Si el cobro sigue fallando, Stripe reintentará automáticamente. Puedes ver las facturas y cambiar la tarjeta
      desde el portal de cliente, sin escribirnos.
    </p>
    <p style="margin:22px 0 0;font-size:13px;color:${COLORS.gray}">CamperOcasión</p>
  `
  return enviar(
    'CamperOcasión',
    email,
    'No hemos podido cobrar tu pack: actualiza la tarjeta',
    emailLayout('Problema con el pago de tu pack', cuerpo),
  )
}

/**
 * Se han pausado anuncios por cupo. Se listan por título para que no parezca
 * que han desaparecido, y se da una salida en un clic.
 */
export async function enviarEmailAnunciosPausados(
  email: string,
  nombre: string,
  opts: { titulos: string[]; cupo: number },
) {
  const titulos = opts.titulos.filter(Boolean)
  const n = titulos.length
  const lista = titulos
    .slice(0, 8)
    .map(
      (t) =>
        `<li style="margin:0 0 6px;color:${COLORS.gray};font-size:14px">${htmlText(t)}</li>`,
    )
    .join('')
  const resto = n > 8 ? `<p style="margin:6px 0 0;font-size:13px;color:${COLORS.gray}">y ${n - 8} más</p>` : ''

  const cuerpo = `
    <p style="margin:0 0 14px;font-size:16px;color:${COLORS.dark}">Hola ${htmlText(nombre)},</p>
    <p style="margin:0 0 14px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Tu plan permite <strong style="color:${COLORS.dark}">${htmlText(opts.cupo)} anuncio${opts.cupo === 1 ? '' : 's'} activo${opts.cupo === 1 ? '' : 's'}</strong>
      y hemos tenido que pausar ${n} que excedían el cupo.
    </p>
    <p style="margin:0 0 10px;font-size:15px;color:${COLORS.dark}"><strong>No se ha borrado ninguno:</strong></p>
    <ul style="margin:0 0 16px;padding-left:20px">${lista}</ul>
    ${resto}
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.gray};line-height:1.6">
      Puedes reactivarlos en un clic si amplías el pack, o pausar otro para dejar sitio. También puedes dejarlos
      pausados sin coste: siguen guardados y se republican cuando quieras.
    </p>
    ${boton('Ver mis anuncios', `${SITE_URL}/dashboard?tab=productos`)}
    <p style="margin:18px 0 0;font-size:13px;color:${COLORS.gray}">
      Si quieres recuperar todos a la vez: <a href="${htmlText(`${SITE_URL}/dashboard?tab=plan`)}" style="color:${COLORS.accent}">ampliar el pack</a>.
    </p>
    <p style="margin:22px 0 0;font-size:13px;color:${COLORS.gray}">CamperOcasión</p>
  `
  return enviar(
    'CamperOcasión',
    email,
    `Hemos pausado ${n} anuncio${n === 1 ? '' : 's'} (no se ha borrado nada)`,
    emailLayout('Anuncios pausados por cupo', cuerpo),
  )
}
