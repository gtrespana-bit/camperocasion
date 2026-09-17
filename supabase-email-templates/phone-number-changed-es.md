# Template «Phone number changed» (teléfono cambiado) — CamperOcasión
## (Copiar en Supabase Dashboard → Authentication → Emails → Security → Phone number changed)

> Es un email de **notificación de seguridad** (no lleva token ni enlace de
> verificación). Supabase solo lo envía si el interruptor de esta notificación
> está activado en el proyecto y hay SMTP configurado (Resend, ya hecho).
> Variables propias aquí: `{{ .OldPhone }}` (anterior) y `{{ .Phone }}` (**nuevo**).
> Globales: `{{ .Email }}` y `{{ .SiteURL }}`.

**Asunto (Subject):**

```
📱 Tu número de teléfono de CamperOcasión se ha actualizado
```

---

## Email HTML

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu número de teléfono se ha actualizado — CamperOcasión</title>
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
                📱 Tu número de teléfono se ha actualizado
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hola, <span style="color: #16A34A;">{{ .Email }}</span>
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                El número de teléfono asociado a tu cuenta de CamperOcasión ha cambiado:
              </p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Número anterior</p>
                <p style="margin: 0 0 16px 0; font-size: 18px; color: #9ca3af; font-weight: 700; text-decoration: line-through;">
                  {{ .OldPhone }}
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Número nuevo</p>
                <p style="margin: 0; font-size: 20px; color: #16A34A; font-weight: 900;">
                  {{ .Phone }}
                </p>
              </div>
              <div style="background-color: #f0fdf4; border: 2px solid #16A34A; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 16px 0; font-size: 15px; color: #15803d; font-weight: 600;">
                  ✅ Si fuiste tú, no necesitas hacer nada más.
                </p>
                <a href="{{ .SiteURL }}/mi-perfil"
                   style="display: inline-block; background-color: #EA580C; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700;">
                  REVISAR MI PERFIL ➜
                </a>
              </div>
              <div style="background-color: #fffbeb; border-left: 4px solid #EA580C; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-size: 15px; color: #92400e; font-weight: 600;">⚠️ ¿No reconoces este número?</p>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #92400e;">
                  Alguien podría haber accedido a tu cuenta. Cambia la contraseña cuanto antes desde
                  <a href="{{ .SiteURL }}/reset-password" style="color: #EA580C; font-weight: 700; text-decoration: underline;">este enlace</a>
                  y avísanos respondiendo a
                  <a href="mailto:soporte@camperocasion.online" style="color: #EA580C; text-decoration: underline;">soporte@camperocasion.online</a>
                  para revertir el cambio.
                </p>
                <p style="margin: 0; font-size: 12px; color: #a16207; word-break: break-all;">
                  {{ .SiteURL }}/reset-password
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="margin-top: 0; padding-top: 0; border-top: 0;">
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
          © 2026 CamperOcasión · camperocasion.online — Todos los derechos reservados.
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
📱 Tu número de teléfono de CamperOcasión se ha actualizado

Hola, {{ .Email }}

El número de teléfono asociado a tu cuenta de CamperOcasión ha cambiado:

Número anterior: {{ .OldPhone }}
Número nuevo: {{ .Phone }}

✅ Si fuiste tú, no necesitas hacer nada más.
Revisa tu perfil: {{ .SiteURL }}/mi-perfil

⚠️ ¿No reconoces este número?
Alguien podría haber accedido a tu cuenta. Cambia la contraseña cuanto antes
desde {{ .SiteURL }}/reset-password y avísanos respondiendo a
soporte@camperocasion.online para revertir el cambio.

---
CamperOcasión
El marketplace camper de España 🚐

¿Necesitas ayuda? Escríbenos a: soporte@camperocasion.online

© 2026 CamperOcasión. Todos los derechos reservados.
```

---

## Instrucciones para configurar en Supabase

1. **Supabase Dashboard** → Authentication → **Emails** (pestaña de plantillas)
2. Bajar a la sección de **notificaciones de seguridad** → **Phone number changed** → Edit
3. Pegar el **Asunto** y el **HTML**, y guardar
4. **Activar el interruptor** de la notificación (si está apagada, nunca se envía, tenga o no template)
5. Requisito previo: SMTP configurado (Resend ✅) — sin SMTP personalizado Supabase no envía estos correos

## Notas

- Variables usadas: `{{ .OldPhone }}` (anterior), `{{ .Phone }}` (**nuevo**), `{{ .Email }}` y `{{ .SiteURL }}`. **No** uses `{{ .Token }}` aquí: esta notificación no genera OTP
- `/mi-perfil` y `/reset-password` son rutas reales del sitio y `/reset-password` ya está en las Redirect URLs de Supabase
- Branding: grafito #0F172A / verde #16A34A / naranja #EA580C — paleta CamperOcasión
- Idioma: español peninsular
