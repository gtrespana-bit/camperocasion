/**
 * Recuperación de contraseña gestionada por la propia app.
 *
 * `supabase.auth.resetPasswordForEmail()` envía por el SMTP configurado en el
 * Dashboard de Supabase (antes smtp.zoho.com). Si ese SMTP falla, el usuario
 * nunca recibe el enlace. Aquí el enlace se genera con
 * `auth.admin.generateLink({ type: 'recovery' })` (no envía nada) y el correo
 * lo envía la propia app por su canal (Resend API o SMTP).
 */
import { createClient } from '@supabase/supabase-js'
import { emailLayout } from '@/lib/email-layout'
import { enviarEmailSMTP } from '@/lib/server-email'

const SITIO_URL = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.es'

function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlRecuperacion(nombre: string, accionLink: string): string {
  const nombreHtml = nombre ? ` <strong>${escapeHtml(nombre)}</strong>` : ''
  return emailLayout(
    'Recupera tu contraseña',
    `<p style="margin:0 0 16px">Hola${nombreHtml},</p>
     <p style="margin:0 0 20px">Recibimos una solicitud para restablecer la contraseña de tu cuenta en CamperOcasión. Haz clic en el botón para crear una nueva contraseña.</p>
     <p style="margin:0 0 8px;font-size:12px;color:#64748B">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
     <p style="margin:0 0 8px;font-size:12px;word-break:break-all"><a href="${accionLink}" style="color:#0F172A">${accionLink}</a></p>
     <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">¿No solicitaste este cambio? Ignora este correo; tu contraseña seguirá igual. El enlace caduca en 1 hora.</p>`,
    'RESTABLECER CONTRASEÑA',
    accionLink,
  )
}

export type ResultadoRecuperacion =
  | { ok: true }
  | { ok: false; mensaje: string }

/**
 * Envía el email de recuperación. Si el email no existe, devuelve ok:true
 * sin enviar nada (no revela qué correos están registrados).
 */
export async function enviarRecuperacion(
  email: string,
  locale?: string,
): Promise<ResultadoRecuperacion> {
  const sb = getAdminClient()

  let usuario: { email?: string; user_metadata?: { nombre?: string } } | undefined
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    usuario = data?.users?.find(
      (u: any) => (u.email || '').toLowerCase() === email.toLowerCase(),
    )
  } catch (e: any) {
    console.error('❌ [recuperacion-email] listUsers error:', e?.message || e)
    return { ok: false, mensaje: 'Error inesperado. Inténtalo de nuevo.' }
  }

  if (!usuario) return { ok: true }

  const prefijo = locale === 'en' ? '/en' : ''
  const redirectTo = `${SITIO_URL}${prefijo}/reset-password`
  const nombre =
    (usuario.user_metadata?.nombre as string) ||
    (usuario.email || '').split('@')[0] ||
    ''

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error) {
    console.error('❌ [recuperacion-email] generateLink error:', error.message)
    return { ok: false, mensaje: 'No se pudo generar el enlace. Inténtalo de nuevo.' }
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    console.error('❌ [recuperacion-email] generateLink sin action_link')
    return { ok: false, mensaje: 'No se pudo generar el enlace. Inténtalo de nuevo.' }
  }

  const enviado = await enviarEmailSMTP(
    email,
    '🔑 Restablece tu contraseña en CamperOcasión',
    htmlRecuperacion(nombre, actionLink),
  )

  if (!enviado) {
    return {
      ok: false,
      mensaje:
        'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos o escríbenos a contacto@camperocasion.es',
    }
  }
  return { ok: true }
}
