'use server'

import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { emailLayout, card, priceLine, COLORS } from '@/lib/email-layout'

// ─── Remitente ─────────────────────────────────────────────
// Configurable con EMAIL_FROM. Por defecto noreply@camperocasion.online.
// IMPORTANTE (Resend): el dominio del `from` debe estar verificado en
// Resend (Domains → camperocasion.online → Verified). Si aún no lo verificas,
// Resend rechaza el envío con 403 y el correo NUNCA llega.
// Mientras verificas, puedes usar temporalmente:
//   EMAIL_FROM="CamperOcasión <onboarding@resend.dev>"
// pero en ese modo Resend solo entrega al email dueño de la cuenta.
const FROM =
  process.env.EMAIL_FROM || '"CamperOcasión" <noreply@camperocasion.online>'
const URL = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'

// ─── Canal 1: Resend API (preferido) ───────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null
  try {
    return new Resend(RESEND_API_KEY)
  } catch {
    return null
  }
}

// ─── Canal 2: SMTP genérico (fallback) ─────────────────────
// Soporta dos espacios de variables:
//  1. SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (preferido, neutral)
//  2. ZOHO_SMTP_* (legado)
// Para usar Resend por SMTP en vez de API:
//   SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_xxx
function smtpConfig() {
  const host =
    process.env.SMTP_HOST || process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com'
  const port =
    Number(process.env.SMTP_PORT || process.env.ZOHO_SMTP_PORT) || 587
  const user = process.env.SMTP_USER || process.env.ZOHO_SMTP_USER
  const pass = process.env.SMTP_PASS || process.env.ZOHO_SMTP_PASS
  return { host, port, user, pass }
}

function getTransporter() {
  const { host, port, user, pass } = smtpConfig()
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: false },
  })
}

// ─── Diagnóstico (sin exponer secretos) ────────────────────
export interface CanalEmailInfo {
  resend: boolean
  smtp: boolean
  from: string
  smtpHost: string
  smtpPort: number
}

export async function canalEmailInfo(): Promise<CanalEmailInfo> {
  const { host, port, user, pass } = smtpConfig()
  return {
    resend: !!RESEND_API_KEY,
    smtp: !!(user && pass),
    from: FROM,
    smtpHost: host,
    smtpPort: port,
  }
}

/** ¿Hay al menos un canal de envío configurado? */
export async function emailConfigurado(): Promise<boolean> {
  if (RESEND_API_KEY) return true
  const { user, pass } = smtpConfig()
  return !!(user && pass)
}

export type ResultadoEnvio =
  | { ok: true; canal: 'resend' | 'smtp'; id?: string }
  | { ok: false; canal: 'resend' | 'smtp' | 'ninguno'; error: string }

/**
 * Envío transaccional de la app.
 * Orden: 1) Resend API si hay RESEND_API_KEY → 2) SMTP si hay credenciales.
 * Devuelve el canal usado y el detalle del error para diagnóstico.
 */
export async function enviarEmailDetallado(
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string; text?: string },
): Promise<ResultadoEnvio> {
  // 1) Resend API
  if (RESEND_API_KEY) {
    try {
      const resend = getResend()
      if (resend) {
        const { data, error } = await resend.emails.send({
          from: FROM,
          to,
          subject,
          html,
          ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
          ...(opts?.text ? { text: opts.text } : {}),
        })
        if (error) {
          const msg =
            (error as any)?.message || JSON.stringify(error) || 'Error Resend'
          console.error('❌ [email] Resend error:', msg, '| from:', FROM, '| to:', to)
          // No fallback silencioso a SMTP si Resend está configurado pero
          // falla por dominio no verificado: el admin debe ver el error real.
          // Solo caemos a SMTP si además hay credenciales SMTP.
          const { user, pass } = smtpConfig()
          if (!user || !pass) {
            return { ok: false, canal: 'resend', error: `Resend: ${msg}` }
          }
          console.warn('⚠️ [email] Resend falló, intentando SMTP como respaldo…')
        } else {
          return { ok: true, canal: 'resend', id: (data as any)?.id }
        }
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.error('❌ [email] Resend excepción:', msg)
      const { user, pass } = smtpConfig()
      if (!user || !pass) {
        return { ok: false, canal: 'resend', error: `Resend: ${msg}` }
      }
      console.warn('⚠️ [email] Resend falló, intentando SMTP como respaldo…')
    }
  }

  // 2) SMTP (nodemailer)
  const { host, port, user, pass } = smtpConfig()
  if (!user || !pass) {
    const msg =
      'Sin canal de envío: configura RESEND_API_KEY o SMTP_USER/SMTP_PASS en Vercel'
    console.warn('⚠️ [email]', msg)
    return { ok: false, canal: 'ninguno', error: msg }
  }
  try {
    const info = await getTransporter().sendMail({
      from: FROM,
      to,
      subject,
      html,
      ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts?.text ? { text: opts.text } : {}),
    })
    return { ok: true, canal: 'smtp', id: (info as any)?.messageId }
  } catch (e: any) {
    const msg = e?.message || String(e)
    console.error(
      `❌ [email] SMTP error (${host}:${port}):`,
      msg,
      '| código:',
      e?.code,
      '| respuesta:',
      e?.response,
    )
    return { ok: false, canal: 'smtp', error: `SMTP (${host}): ${msg}` }
  }
}

/**
 * Envío SMTP genérico de la app. Devuelve true solo si el correo quedó
 * entregado al proveedor (Resend API o SMTP según configuración).
 * Se mantiene el nombre por compatibilidad con el resto del código.
 */
export async function enviarEmailSMTP(
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string; text?: string },
): Promise<boolean> {
  const r = await enviarEmailDetallado(to, subject, html, opts)
  return r.ok
}

async function enviar(
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string },
): Promise<boolean> {
  return enviarEmailSMTP(to, subject, html, opts)
}

// ─── 1. Producto Publicado ─────────────────────────────────

export async function emailProductoPublicado(
  email: string,
  nombre: string,
  titulo: string,
  precio: string,
  slug: string,
): Promise<boolean> {
  return enviar(email, '✅ Tu anuncio fue publicado', emailLayout(
    'Anuncio publicado',
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <p style="margin:0 0 20px">Tu anuncio ya está visible en CamperOcasión para que miles de compradores lo vean.</p>
     ${card(`
       <p style="margin:0 0 8px;font-weight:600;font-size:16px;color:${COLORS.dark}">${titulo}</p>
       <p style="margin:0;font-size:22px;font-weight:700;color:${COLORS.primary}">$${precio} USD</p>
     `)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Consejo: revisa tu anuncio desde tu perfil para asegurarte de que la foto principal sea la mejor.</p>`,
    'Ver mi anuncio',
    `${URL}/producto/${slug}`,
  ))
}

// ─── 2. Mensaje Recibido ───────────────────────────────────

export async function emailMensajeRecibido(
  emailVendedor: string,
  nombreVendedor: string,
  nombreComprador: string,
  producto: string,
  mensajePreview: string,
): Promise<boolean> {
  return enviar(emailVendedor, `💬 Nuevo mensaje sobre "${producto}"`, emailLayout(
    'Nuevo mensaje',
    `<p style="margin:0 0 16px">Hola <strong>${nombreVendedor}</strong>,</p>
     <p style="margin:0 0 20px">Un comprador te escribió sobre tu anuncio:</p>
     ${card(`
       <p style="margin:0 0 12px;font-weight:600;color:${COLORS.dark}">${producto}</p>
       <p style="margin:0 0 8px"><strong>De:</strong> ${nombreComprador}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.white};border-radius:8px;padding:16px;margin-top:8px;border-left:3px solid ${COLORS.primary}">
         <tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.dark};font-style:italic;line-height:1.6">"${mensajePreview}"</td></tr>
       </table>
     `)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Responder pronto aumenta tus posibilidades de venta.</p>`,
    'Responder mensaje',
    `${URL}/dashboard?tab=mensajes`,
  ))
}

// ─── 3. Créditos Añadidos ──────────────────────────────────

export async function emailCreditosAgregados(
  email: string,
  nombre: string,
  cantidad: number,
  balanceTotal: number,
): Promise<boolean> {
  return enviar(email, `✅ +${cantidad} créditos en tu cuenta`, emailLayout(
    'Créditos añadidos',
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <p style="margin:0 0 20px">Se acreditaron créditos a tu cuenta:</p>
     ${card(`
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr>${priceLine('Créditos añadidos', `+${cantidad}`)}</tr>
         <tr style="border-top:1px solid ${COLORS.lightGray}"><td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Balance total</td><td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.success}">${balanceTotal}</td></tr>
       </table>
     `)}`,
    'Ir a mi perfil',
    `${URL}/dashboard?tab=perfil`,
  ))
}

// ─── 4. Verificación Aprobada ──────────────────────────────

export async function emailVerificacionAprobada(email: string, nombre: string): Promise<boolean> {
  return enviar(email, '🎉 Tu cuenta fue verificada', emailLayout(
    'Cuenta verificada',
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <div style="text-align:center;padding:24px 0">
       <p style="font-size:52px;margin:0">✅</p>
       <p style="font-size:18px;font-weight:700;color:${COLORS.primary};margin:12px 0">Verificación completada</p>
     </div>
     <p style="margin:0 0 16px;text-align:center">Tu cuenta ahora tiene el sello de verificación visible en todos tus anuncios.</p>
     <p style="margin:0;text-align:center;color:${COLORS.gray};font-size:14px">Esto aumenta la confianza de los compradores y mejora tus ventas.</p>`,
    'Ver mi perfil',
    `${URL}/dashboard`,
  ))
}

// ─── 5. Subida de Nivel ────────────────────────────────────

export async function emailSubidaNivel(
  email: string,
  nombre: string,
  nivelNuevo: string,
  nivelAnterior: string,
): Promise<boolean> {
  const emojis: Record<string, string> = { Bronce: '🥉', Plata: '🥈', Oro: '🥇', Diamante: '💎' }
  const emoji = emojis[nivelNuevo] || '⭐'
  return enviar(email, `${emoji} Subiste de nivel: ${nivelNuevo}`, emailLayout(
    `¡Ahora eres ${nivelNuevo}!`,
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <div style="text-align:center;padding:24px 0">
       <p style="font-size:52px;margin:0">${emoji}</p>
       <p style="font-size:18px;font-weight:700;color:${COLORS.primary};margin:12px 0">Subiste de nivel</p>
     </div>
     ${card(`
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         ${priceLine('Nivel anterior', nivelAnterior)}
         <tr style="border-top:1px solid ${COLORS.lightGray}"><td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Nuevo nivel</td><td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:18px;font-weight:700;color:${COLORS.accent}">${nivelNuevo}</td></tr>
       </table>
     `)}`,
    'Ver mi perfil',
    `${URL}/dashboard?tab=perfil`,
  ))
}
