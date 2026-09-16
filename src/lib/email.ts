import { enviarEmailDetallado } from '@/lib/server-email'

export interface EmailParams {
  to: string
  subject: string
  html: string
  replyTo?: string
}

/**
 * Envío genérico (compat). Usa el canal central: Resend API si hay
 * RESEND_API_KEY, si no SMTP (SMTP_* o ZOHO_SMTP_*).
 */
export async function enviarEmail(params: EmailParams) {
  const r = await enviarEmailDetallado(params.to, params.subject, params.html, {
    replyTo: params.replyTo,
  })
  if (r.ok) return { success: true, canal: r.canal, id: r.id }
  console.error('❌ Error enviando email:', r.error)
  return { success: false, error: r.error }
}
