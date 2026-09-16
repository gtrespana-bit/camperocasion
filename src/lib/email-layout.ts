/**
 * Layout HTML de los correos transaccionales de CamperOcasión.
 *
 * Módulo puro (sin 'use server' ni IO) para poder importarlo tanto desde
 * módulos de servidor normales como desde módulos de server actions.
 */

export const COLORS = {
  primary: '#0F172A',
  primaryHover: '#1E293B',
  accent: '#EA580C',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#E2E8F0',
  success: '#059669',
}

const URL_BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_URL) || 'https://camperocasion.es'
const CONTACT = 'contacto@camperocasion.es'
const LOGO = `${URL_BASE}/logo-camperocasion.png`

export function emailLayout(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="es" style="margin:0;padding:0">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:24px 0">
    <tr>
      <td align="center" valign="top">
        <!-- Container 600 -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORS.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td align="center" style="background:${COLORS.primary};padding:32px 24px 28px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:8px">
                    <a href="${URL_BASE}" style="text-decoration:none">
                      <img src="${LOGO}" alt="CamperOcasión" width="160" style="display:block;max-width:160px;height:auto;border:0">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.white};letter-spacing:-0.3px">${title}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td height="3" style="background:${COLORS.accent}"></td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 8px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;color:${COLORS.dark};line-height:1.65">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td align="left" style="padding:24px 28px 32px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <th align="center" style="background:${COLORS.primary};border-radius:8px">
                    <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 36px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:${COLORS.white};text-decoration:none;letter-spacing:0.3px">
                      ${ctaText}
                    </a>
                  </th>
                </tr>
              </table>
            </td>
          </tr>` : ''}
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid ${COLORS.lightGray};padding:24px 28px;background:${COLORS.bg}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:12px;color:${COLORS.gray};line-height:1.65">
                    <p style="margin:0 0 6px;font-weight:600;color:${COLORS.dark}">CamperOcasión</p>
                    <p style="margin:0 0 6px">El marketplace español</p>
                    <p style="margin:0"><a href="mailto:${CONTACT}" style="color:${COLORS.primary};text-decoration:none">${CONTACT}</a></p>
                    <p style="margin:6px 0 0"><a href="${URL_BASE}" style="color:${COLORS.primary};text-decoration:none">${URL_BASE}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!-- /Container -->
      </td>
    </tr>
  </table>
  <!-- /Wrapper -->
</body>
</html>`
}

export function card(body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};border-radius:10px;padding:20px;margin:8px 0;border:1px solid ${COLORS.lightGray}"><tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;color:${COLORS.dark};line-height:1.6">${body}</td></tr></table>`
}

export function priceLine(label: string, value: string): string {
  return `<tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray};padding:4px 0">${label}</td><td align="right" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:${COLORS.primary};padding:4px 0">${value}</td></tr>`
}
