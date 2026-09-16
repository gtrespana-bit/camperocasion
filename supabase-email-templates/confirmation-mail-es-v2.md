# Template Emails de Confirmación - VendeT
## (Copiar esto en Supabase Dashboard → Authentication → Email Templates → Confirmation Mail)

---

## Email HTML (recomendado)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu cuenta en VendeT</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a1a2e;">
                Vende<span style="color: #fff;">T</span>
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #1a1a2e; font-weight: 500;">
                La plataforma de clasificados de Venezuela
              </p>
            </td>
          </tr>
          
          <!-- Contenido principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1f2937; font-weight: 700;">
                👋 ¡Bienvenido a VendeT, <span style="color: #7B2D3B;">{{ .Email }}</span>!
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Gracias por registrarte en VendeT, el marketplace de compraventa de Venezuela.
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Ya puedes:
              </p>
              
              <ul style="margin: 0 0 24px 0; padding-left: 20px;">
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">📝 Publicar productos gratis</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">💬 Contactar directamente con vendedores</li>
                <li style="color: #4b5563; font-size: 15px; margin-bottom: 8px;">🇻🇪 Acceder a miles de anuncios en toda Venezuela</li>
              </ul>
              
              <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e40af; font-weight: 600; text-align: center;">
                  🔐 Confirma tu dirección de correo electrónico
                </p>
                
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #3b82f6; text-align: center;">
                  Para activar tu cuenta y comenzar a usar todas las funcionalidades, haz clic en el botón de abajo:
                </p>
                
                <div style="text-align: center;">
                  <!-- EL BOTÓN USARÁ EL ENLACE DE CONFIRMACIÓN NATIVO DE SUPABASE -->
                  <a href="{{ .ConfirmationURL }}" 
                     style="display: inline-block; background-color: #7B2D3B; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                    CONFIRMAR MI CUENTA ➜
                  </a>
                </div>
                
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">
                  Si el botón no funciona, copia este enlace en tu navegador:
                </p>
                
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center; word-break: break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Si no solicitaste esta cuenta, por favor ignora este email o contáctanos.
              </p>
              
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                El enlace expirará en <strong>24 horas</strong>.
              </p>
              
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">
                  VendeT
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                  El marketplace de Venezuela 🇻🇪
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:gtrespana@gmail.com" style="color: #7B2D3B; text-decoration: none;">gtrespana@gmail.com</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
          © 2026 VendeT · vendet.online — Todos los derechos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## ¡IMPORTANTE! Configurar URL deconfirmación en Supabase

### Paso 1: En Supabase Dashboard

1. Ve a **Authentication** → **URLs**
2. En **Site URL**: `https://vendet.online`
3. En **Redirect URL**: `https://vendet.online/confirm`

### Paso 2: Guardar cambios
- Haz clic en **Save** o **Guardar cambios**
- ✅ Listo

---

## ¿Por qué esto?

- **Supabase** usa `.ConfirmationURL` que incluye el token
- Ese URL va a `https://vendet.online/api/confirm-email?token=XXX&type=email`
- El API route valida el token y redirige a `/confirm`
- `/confirm` muestra mensaje de éxito y redirige automáticamente al login

**Así funciona correctamente sin páginas 404** 🎯

---

## Prueba completa:

1. ✅ Usuario se registra → recibe email
2. ✅ Usuario hace clic en "CONFIRMAR MI CUENTA"
3. ✅ Supabase valida token → redirige a `/api/confirm-email`
4. ✅ API valida → redirige a `/confirm`
5. ✅ `/confirm` muestra "¡Confirmado!" → redirect a `/login`
6. ✅ Usuario hace login con su cuenta ya confirmana ✅

---

**¡Listo para copiar y pegar en Supabase!** 🚀
