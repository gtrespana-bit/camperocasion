import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import {
  enviarEmailDetallado,
  canalEmailInfo,
} from '@/lib/server-email'
import { emailLayout } from '@/lib/email-layout'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GET /api/admin/email-test — Diagnóstico del canal de email (sin enviar).
 * Devuelve qué proveedor está configurado y con qué remitente.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const info = await canalEmailInfo()
  return NextResponse.json({
    ok: true,
    resend: info.resend,
    smtp: info.smtp,
    from: info.from,
    smtpHost: info.smtp ? info.smtpHost : null,
    smtpPort: info.smtp ? info.smtpPort : null,
    hint: !info.resend && !info.smtp
      ? 'Sin canal: configura RESEND_API_KEY en Vercel (preferido) o SMTP_USER/SMTP_PASS.'
      : info.resend
        ? `Canal activo: Resend API. Si no llega, verifica en Resend que el dominio del remitente (${info.from}) esté verificado y revisa Resend → Logs.`
        : `Canal activo: SMTP (${info.smtpHost}:${info.smtpPort}).`,
  })
}

/**
 * POST /api/admin/email-test — Envía un correo de prueba a un destino.
 * Body: { to: string }
 * Devuelve el canal usado y el error exacto del proveedor si falla.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const ip = getClientIp(req)
  const limit = await checkRateLimit('admin:email-test', auth.user.id, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  let body: { to?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }
  const to = (body.to || '').trim().toLowerCase()
  if (!EMAIL_REGEX.test(to)) {
    return NextResponse.json({ ok: false, error: 'Email destino inválido' }, { status: 400 })
  }

  const info = await canalEmailInfo()
  const html = emailLayout(
    'Prueba de correo',
    `<p style="margin:0 0 16px">Hola,</p>
     <p style="margin:0 0 16px">Este es un correo de prueba de <strong>CamperOcasión</strong>. Si lo recibiste, el canal de email está funcionando. ✅</p>
     <p style="margin:0;color:#64748B;font-size:13px">Enviado el ${new Date().toLocaleString('es-VE')} desde el panel admin.</p>`,
  )

  const r = await enviarEmailDetallado(
    to,
    '✅ Prueba de correo — CamperOcasión',
    html,
  )

  if (r.ok) {
    return NextResponse.json({
      ok: true,
      canal: r.canal,
      id: r.id || null,
      from: info.from,
      to,
    })
  }

  return NextResponse.json(
    {
      ok: false,
      canal: r.canal,
      error: r.error,
      from: info.from,
      to,
      hint:
        r.canal === 'resend'
          ? 'Revisa: 1) que RESEND_API_KEY sea válida (re_...), 2) que el dominio del remitente esté verificado en Resend → Domains, 3) Resend → Logs para el detalle.'
          : r.canal === 'smtp'
            ? 'Revisa host/puerto/credenciales SMTP. Para Resend por SMTP: host=smtp.resend.com, puerto=465, user=resend, pass=RESEND_API_KEY.'
            : 'Configura RESEND_API_KEY en Vercel → Settings → Environment Variables y redespliega.',
    },
    { status: 502 },
  )
}
