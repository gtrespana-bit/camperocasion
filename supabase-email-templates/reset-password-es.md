# Template Email de Recuperación de Contraseña — CamperOcasión
## (Copiar en Supabase Dashboard → Authentication → Email Templates → Reset Email)

---

## Email HTML (recomendado)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña — CamperOcasión</title>
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
                🔐 Recuperación de contraseña
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hola, <span style="color: #16A34A;">{{ .Email }}</span>
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer tu contraseña de CamperOcasión.
              </p>
              <div style="background-color: #fffbeb; border-left: 4px solid #EA580C; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-size: 15px; color: #92400e; font-weight: 600;">⚠️ Seguridad importante:</p>
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  Si <strong>no fuiste tú</strong> quien solicitó este cambio, ignora este email y tu contraseña permanecerá sin cambios.
                </p>
              </div>
              <div style="background-color: #f0fdf4; border: 2px solid #16A34A; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #15803d; font-weight: 600; text-align: center;">
                  🔄 Restablece tu contraseña ahora
                </p>
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #16A34A; text-align: center;">
                  Haz clic en el botón para crear una nueva contraseña segura:
                </p>
                <div style="text-align: center;">
                  <a href="{{ .ConfirmationURL }}"
                     style="display: inline-block; background-color: #EA580C; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700;">
                    REESTABLECER CONTRASEÑA ➜
                  </a>
                </div>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
                O copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 12px; color: #9ca3af; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #374151;">📋 Consejos para una contraseña segura:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563;">
                  <li style="margin-bottom: 6px;">Usa al menos 8 caracteres</li>
                  <li style="margin-bottom: 6px;">Combina mayúsculas y minúsculas</li>
                  <li style="margin-bottom: 6px;">Añade números y símbolos</li>
                  <li>Evita información personal obvia</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Si no solicitaste este cambio, ignora este email. Tu contraseña permanecerá sin cambios.
              </p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                El enlace expirará en <strong>1 hora</strong>.
              </p>
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0F172A;">
                  CamperOcasión
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                  El marketplace camper de España 🚐🇪🇸
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@camperocasion.online" style="color: #16A34A; text-decoration: none;">soporte@camperocasion.online</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
          © 2026 CamperOcasión — camperocasion.online
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Texto Plano (backup)

```
Recuperación de Contraseña — CamperOcasión

Hola,

Hemos recibido una solicitud para restablecer tu contraseña de CamperOcasión.

Si fuiste tú, usa este enlace para crear una nueva contraseña:

{{ .ConfirmationURL }}

⚠️ Si NO fuiste tú, ignora este email. Tu contraseña permanecerá sin cambios.

Consejos:
- Usa al menos 8 caracteres
- Combina mayúsculas y minúsculas
- Añade números y símbolos
- Evita información personal obvia

El enlace expirará en 1 hora.

¿Necesitas ayuda? Escríbenos a: soporte@camperocasion.online

---
CamperOcasión
El marketplace camper de España 🚐

© 2026 CamperOcasión.
```

---

## Instrucciones Supabase

1. Dashboard → Authentication → Email Templates → **Reset Email**
2. Borrar contenido actual y pegar el HTML completo (doctype incluido)
3. En **Plain Text Template** pegar el texto plano
4. Guardar

Variables: `{{ .Email }}`, `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .RedirectURL }}`

Branding: grafito #0F172A / verde #16A34A / naranja #EA580C — CamperOcasión, idioma español peninsular.
