import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Estado de configuración del panel admin.
 *
 * Devuelve qué canales están operativos para que el panel muestre una "salud
 * de la plataforma" accionable sin exponer secretos.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const config = {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    email: !!(
      process.env.RESEND_API_KEY ||
      process.env.EMAIL_SERVER_HOST ||
      ((process.env.SMTP_USER || process.env.ZOHO_SMTP_USER) &&
        (process.env.SMTP_PASS || process.env.ZOHO_SMTP_PASS))
    ),
    emailResend: !!process.env.RESEND_API_KEY,
    emailSmtp: !!(
      (process.env.SMTP_USER || process.env.ZOHO_SMTP_USER) &&
      (process.env.SMTP_PASS || process.env.ZOHO_SMTP_PASS)
    ),
    rateLimit: true,
    anuncios: false,
  }

  try {
    if (config.supabase) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { data, error } = await sb.from('anuncios_globales').select('id').limit(1)
      config.anuncios = !error && Array.isArray(data)
    }
  } catch {
    // no es crítico
  }

  return NextResponse.json({ ok: true, config, ts: new Date().toISOString() })
}
