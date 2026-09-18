/**
 * Confirmación de cuenta por correo gestionada por la propia app.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * El email de confirmación de Supabase Auth se envía con el SMTP que esté
 * configurado en el Dashboard del proyecto (hoy: smtp.zoho.com). Si esa cuenta
 * se degrada al plan gratuito de Zoho (que NO incluye SMTP/IMAP/POP), o el
 * SMTP del dashboard falla por cualquier motivo, el usuario se registra pero
 * NUNCA recibe el correo → no puede confirmar su cuenta.
 *
 * SOLUCIÓN
 * --------
 * El enlace de confirmación se genera con `auth.admin.generateLink({ type:
 * 'signup' })` (no envía ningún correo; solo crea el usuario si no existe o
 * renueva el token si existe sin confirmar) y el correo lo envía la propia app
 * por el MISMO canal SMTP que usan las demás notificaciones transaccionales
 * (ver `enviarEmailSMTP` en src/lib/server-email.ts).
 *
 * Notas verificadas contra el código fuente de GoTrue (supabase/auth,
 * internal/api/mail.go):
 *  - type 'signup' + usuario inexistente → crea el usuario (sin confirmar),
 *    con la contraseña y `user_metadata` suministrados. No envía email.
 *  - type 'signup' + usuario existente sin confirmar → NO toca la contraseña,
 *    renueva confirmation_token / confirmation_sent_at (reenvío válido 24 h)
 *    y devuelve un action_link fresco.
 *  - type 'signup' + usuario ya confirmado → error "already been registered".
 *  - El admin NO está sujeto al rate-limit de envío de Supabase (2/hora del
 *    SMTP por defecto) porque aquí no se usa el mailer de Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { emailLayout } from '@/lib/email-layout'
import { enviarEmailDetallado } from '@/lib/server-email'

const SITIO_URL = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'
/** Página de la app que completa la verificación (token en URL). */
const REDIRECT_CONFIRMACION = `${SITIO_URL}/confirm`

export type CanalEnvio = 'app' | 'supabase'

export type ResultadoConfirmacion =
  | { ok: true; canal: CanalEnvio }
  // `detalle`: error técnico del proveedor de email (Resend/SMTP). NO lleva
  // secretos; se enseña solo en la respuesta JSON (F12 → Network) para poder
  // diagnosticar el 'smtp' genérico sin entrar a los logs de Vercel.
  | { ok: false; codigo: 'registrado' | 'smtp' | 'auth'; mensaje: string; detalle?: string }

function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** ¿Hay canal de envío para que la app envíe el correo? (Resend API o SMTP) */
export function smtpConfigurado(): boolean {
  if (process.env.RESEND_API_KEY) return true
  return !!(
    process.env.SMTP_USER || process.env.ZOHO_SMTP_USER
  ) && !!(
    process.env.SMTP_PASS || process.env.ZOHO_SMTP_PASS
  )
}

function htmlConfirmacion(nombre: string, accionLink: string): string {
  const nombreHtml = nombre ? `<strong>${escapeHtml(nombre)}</strong>` : ''
  return emailLayout(
    'Confirma tu cuenta',
    `<p style="margin:0 0 16px">Hola ${nombreHtml},</p>
     <p style="margin:0 0 20px">¡Bienvenido a CamperOcasión! Solo falta un paso para activar tu cuenta: confirmar tu correo electrónico.</p>
     <p style="margin:0 0 20px">Haz clic en el botón y tu cuenta quedará lista para publicar anuncios gratis y contactar vendedores.</p>
     <p style="margin:0 0 8px;font-size:12px;color:#64748B">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
     <p style="margin:0 0 8px;font-size:12px;word-break:break-all"><a href="${accionLink}" style="color:#0F172A">${accionLink}</a></p>
     <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">¿No te registraste en CamperOcasión? Ignora este correo; el enlace caduca en 24 horas.</p>`,
    'CONFIRMAR MI CUENTA',
    accionLink,
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Genera el enlace de confirmación vía service-role (sin enviar nada). */
async function generarEnlaceConfirmacion(
  email: string,
  nombre: string,
  password?: string,
  tipoVendedor?: string,
) {
  const sb = getAdminClient()
  // Contraseña del usuario: se usa SOLO si el usuario NO existe (primera vez).
  // Si el usuario ya existe sin confirmar, GoTrue ignora la contraseña y solo
  // renueva el token de confirmación (por eso en los reenvíos se pasa una
  // aleatoria: no tiene ningún efecto).
  const clave = password && password.length >= 8 ? password : randomBytes(24).toString('base64url')

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'signup',
    email,
    password: clave,
    options: {
      // `tipo_vendedor` viaja en la metadata del usuario; el trigger
      // `crear_perfil()` lo copia a perfiles.tipo_vendedor al confirmar
      // (migración 202609180002).
      data: { nombre, ...(tipoVendedor ? { tipo_vendedor: tipoVendedor } : {}) },
      redirectTo: REDIRECT_CONFIRMACION,
    },
  })

  if (error) {
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('already') || msg.includes('registrado') || msg.includes('registered')) {
      return { ok: false as const, codigo: 'registrado' as const, mensaje: 'Ya existe una cuenta con este email' }
    }
    console.error('❌ [confirmacion-email] generateLink error:', error.message)
    return { ok: false as const, codigo: 'auth' as const, mensaje: error.message || 'Error generando el enlace de confirmación' }
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    console.error('❌ [confirmacion-email] generateLink sin action_link', JSON.stringify(data))
    return { ok: false as const, codigo: 'auth' as const, mensaje: 'No se pudo generar el enlace de confirmación' }
  }
  return { ok: true as const, actionLink }
}

/**
 * Genera el enlace de confirmación y envía el correo por el SMTP de la app.
 * Si la app no tiene SMTP configurado (solo dev/preview), intenta el reenvío
 * nativo de Supabase como último recurso.
 *
 * `password` es la contraseña elegida por el usuario en el registro: queda
 * guardada en la cuenta creada. Sin ella el usuario confirmaría su email
 * pero nunca podría entrar (la cuenta quedaría en el limbo).
 */
export async function enviarConfirmacion(
  email: string,
  nombre: string,
  password?: string,
  tipoVendedor?: string,
): Promise<ResultadoConfirmacion> {
  const enlace = await generarEnlaceConfirmacion(email, nombre, password, tipoVendedor)
  if (!enlace.ok) return enlace

  const envio = await enviarEmailDetallado(
    email,
    '🔐 Confirma tu cuenta en CamperOcasión',
    htmlConfirmacion(nombre, enlace.actionLink),
  )

  if (envio.ok) {
    return { ok: true, canal: 'app' }
  }
  const detalle = envio.error

  // Sin credenciales SMTP en la app → último recurso: mailer de Supabase.
  if (!smtpConfigurado()) {
    console.warn('⚠️ [confirmacion-email] SMTP de la app no configurado; intentando reenvío nativo de Supabase')
    try {
      const sb = getAdminClient()
      const { error } = await sb.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: REDIRECT_CONFIRMACION },
      })
      if (!error) return { ok: true, canal: 'supabase' }
      console.error('❌ [confirmacion-email] resend fallback error:', error.message)
    } catch (e: any) {
      console.error('❌ [confirmacion-email] resend fallback exception:', e?.message || e)
    }
  }

  return {
    ok: false,
    codigo: 'smtp',
    mensaje: 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo en unos minutos o escríbenos a contacto@camperocasion.online',
    detalle,
  }
}

/**
 * Reenvío para cuentas existentes (página /confirmacion y login):
 * solo regenera el token si la cuenta existe y NO está confirmada.
 * Si el usuario no existe devuelve ok:true con yaRegistrado:false sin enviar
 * nada (no se crean cuentas por un "reenviar" y no se revela si el correo
 * existe). Si ya confirmó, devuelve yaRegistrado:true.
 */
export async function reenviarConfirmacion(email: string): Promise<
  { ok: true; canal?: CanalEnvio; yaRegistrado?: boolean }
  | { ok: false; codigo: 'smtp' | 'auth'; mensaje: string; detalle?: string }
> {
  const sb = getAdminClient()

  let usuario: { email?: string; email_confirmed_at?: string | null; user_metadata?: { nombre?: string } } | undefined
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    usuario = data?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase())
  } catch (e: any) {
    console.error('❌ [confirmacion-email] listUsers error:', e?.message || e)
  }

  if (!usuario) {
    // No existe cuenta: responder igual para no filtrar direcciones.
    return { ok: true, yaRegistrado: false }
  }

  if (usuario.email_confirmed_at) {
    return { ok: true, yaRegistrado: true }
  }

  const nombre = (usuario.user_metadata?.nombre as string) || (usuario.email || '').split('@')[0] || ''
  const enlace = await generarEnlaceConfirmacion(email, nombre)
  if (!enlace.ok) {
    // Una cuenta sin confirmar nunca debería dar 'registrado'; si pasa, es un error real.
    return { ok: false, codigo: enlace.codigo === 'registrado' ? 'auth' : enlace.codigo, mensaje: enlace.mensaje }
  }

  const envio = await enviarEmailDetallado(email, '🔐 Confirma tu cuenta en CamperOcasión', htmlConfirmacion(nombre, enlace.actionLink))
  if (envio.ok) return { ok: true, canal: 'app' }
  const detalle = envio.error
  if (!smtpConfigurado()) {
    try {
      const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: REDIRECT_CONFIRMACION } })
      if (!error) return { ok: true, canal: 'supabase' }
      console.error('❌ [confirmacion-email] resend fallback error:', error?.message)
    } catch (e: any) {
      console.error('❌ [confirmacion-email] resend fallback exception:', e?.message || e)
    }
  }
  return {
    ok: false,
    codigo: 'smtp',
    mensaje: 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo en unos minutos o escríbenos a contacto@camperocasion.online',
    detalle,
  }
}
