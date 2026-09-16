# Template Emails de Confirmación — CamperOcasión
## (Copiar en Supabase Dashboard → Authentication → Email Templates → Confirmation Mail)

---

## Email HTML (recomendado)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu cuenta en CamperOcasión</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0F172A 0%, #16A34A 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">
                Camper<span style="color: #F59E0B;">Ocasión</span>
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #e5e7eb; font-weight: 500;">
                El marketplace de furgonetas camper y autocaravanas de ocasión en España 🚐
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1f2937; font-weight: 700;">
                👋 ¡Bienvenido a CamperOcasión, <span style="color: #16A34A;">{{ .Email }}</span>!
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Gracias por registrarte en CamperOcasión, el marketplace vertical de campers y autocaravanas de ocasión en España.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Ya puedes:
              </p>
              <ul style="margin: 0 0 24px 0; padding-left: 20px;">
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">🚐 Publicar tu camper o autocaravana gratis</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">💬 Contactar directamente con vendedores</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">🇪🇸 Acceder a campers en las 52 provincias de España</li>
              </ul>
              <div style="background-color: #f0fdf4; border: 2px solid #16A34A; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #15803d; font-weight: 600; text-align: center;">
                  🔐 Confirma tu dirección de correo electrónico
                </p>
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #16A34A; text-align: center;">
                  Para activar tu cuenta y comenzar, haz clic en el botón:
                </p>
                <div style="text-align: center;">
                  <a href="{{ .ConfirmationURL }}"
                     style="display: inline-block; background-color: #EA580C; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700;">
                    CONFIRMAR MI CUENTA ➜
                  </a>
                </div>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
                O copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 12px; color: #9ca3af; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Si no solicitaste esta cuenta, por favor ignora este email.
              </p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                El enlace expirará en <strong>24 horas</strong>.
              </p>
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0F172A;">
                  CamperOcasión
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                  El marketplace camper de España 🚐🇪🇸
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@camperocasion.es" style="color: #16A34A; text-decoration: none;">soporte@camperocasion.es</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
          © 2026 CamperOcasión · camperocasion.es — Todos los derechos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Email de Texto Plano (backup)

```
¡Bienvenido a CamperOcasión!

Gracias por registrarte en CamperOcasión, el marketplace de campers y autocaravanas de ocasión en España.

Ya puedes:
- Publicar tu camper o autocaravana gratis
- Contactar directamente con vendedores
- Acceder a campers en las 52 provincias

Para activar tu cuenta, confirma tu correo haciendo clic en:

{{ .ConfirmationURL }}

El enlace expirará en 24 horas.
¿No solicitaste esta cuenta? Por favor ignora este email.

---
CamperOcasión
El marketplace camper de España 🚐

¿Necesitas ayuda? Escríbenos a: soporte@camperocasion.es

© 2026 CamperOcasión. Todos los derechos reservados.
```

---

## Instrucciones para configurar en Supabase:

1. **Ir a Supabase Dashboard** → Authentication → Email Templates
2. **Confirmation Mail** → Edit Template
3. **Pegar el código HTML** en el editor
4. **Guardar** (Save template)

---

## Notas

- Variables: `{{ .Email }}`, `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .RedirectURL }}`
- Branding: grafito #0F172A / verde #16A34A / naranja #EA580C — paleta CamperOcasión
- Idioma: español peninsular
- CTA: botón naranja visible
