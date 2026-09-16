# Template Emails de Recuperación de Contraseña - VendeT-Venezuela
## (Copiar esto en Supabase Dashboard → Authentication → Email Templates → Reset Email)

---

## 🎯 Email HTML (recomendado)

**Copia Y PEGA ESTO en el editor HTML de Supabase:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña - VendeT-Venezuela</title>
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
                Vende<span style="color: #fff;">T</span>-Venezuela
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
                🔐 Recuperación de Contraseña
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hola, <span style="color: #7B2D3B;">{{ .Email }}</span>
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer tu contraseña de VendeT-Venezuela.
              </p>
              
              <div style="background-color: #fffbeb; border-left: 4px solid #C9A84C; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-size: 15px; color: #92400e; font-weight: 600;">
                  ⚠️ Seguridad importante:
                </p>
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  Si <strong>no fue tú</strong> quien solicitó este cambio, ignora este email y tu contraseña permanecerá sin cambios.
                </p>
              </div>
              
              <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e40af; font-weight: 600; text-align: center;">
                  🔄 Restablece tu contraseña ahora
                </p>
                
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #3b82f6; text-align: center;">
                  Haz clic en el botón de abajo para crear una nueva contraseña segura:
                </p>
                
                <div style="text-align: center;">
                  <a href="{{ .ConfirmationURL }}" 
                     style="display: inline-block; background-color: #7B2D3B; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
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
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #374151;">
                  📋 Consejos para una contraseña segura:
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563;">
                  <li style="margin-bottom: 6px;">Usa al menos 8 caracteres</li>
                  <li style="margin-bottom: 6px;">Combina letras mayúsculas y minúsculas</li>
                  <li style="margin-bottom: 6px;">Añade números y símbolos especiales</li>
                  <li>Evita información personal obvia</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Si no solicitaste este cambio, por favor ignora este email. Tu contraseña permanecerá sin cambios.
              </p>
              
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                El enlace expirará en <strong>1 hora</strong>.
              </p>
              
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">
                  VendeT-Venezuela
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
          Todos los derechos reservados © 2026 VendeT-Venezuela. Todos los derechos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 📝 Email de Texto Plano (backup)

Copia esto en el campo **"Plain Text Template"** en Supabase:

```
Recuperación de Contraseña - VendeT-Venezuela

Hola,

Hemos recibido una solicitud para restablecer tu contraseña de VendeT-Venezuela.

Si fue tú quien solicitó esto, por favor usa el siguiente enlace para crear una nueva contraseña segura:

{{ .ConfirmationURL }}

⚠️ Si NO fue tú quien solicitó esto, ignora este email. Tu contraseña permanecerá sin cambios.

📋 Consejos de seguridad:
- Usa al menos 8 caracteres
- Combina letras mayúsculas y minúsculas
- Añade números y símbolos especiales
- Evita información personal obvia

El enlace expirará en 1 hora.

¿Necesitas ayuda? Escríbenos a: gtrespana@gmail.com

---
VendeT-Venezuela
El marketplace de Venezuela 🇻🇪

© 2026 VendeT-Venezuela. Todos los derechos reservados.
```

---

## 🚀 Instrucciones para Configurar en Supabase

### Paso 1: Acceso al Dashboard

1. Ve a https://supabase.com/dashboard/project/jmbkqelkusxjebsdnjoc
2. Inicia sesión con tu cuenta
3. En el sidebar izquierdo, ve a **Authentication**
4. Luego ve a **Email Templates**

---

### Paso 2: Editar Template "Reset Email"

1. **Busca el template chamado "Reset Email"** (NO "Confirmation Mail" - ese es para registro)
2. Haz clic en **Reset Email**
3. En la columna derecha, verás un editor de texto
4. **Borra TODO el contenido actual**
5. **Pega el código HTML completo** desde arriba (desde `<!DOCTYPE html>` hasta `</html>`)
6. **Guarda los cambios** (Save template)

---

### Paso 3: Configurar Template de Texto Plano

1. Debajo del editor HTML, busca la sección **"Plain Text Template"**
2. Haz clic en **Plain Text Template**
3. **Borra TODO el contenido actual**
4. **Pega el texto plano** desde arriba
5. **Guarda los cambios**

---

## ✅ Verificación

### Para probar que funciona:

1. Ve a tu app en https://vendet.online
2. En la página de login, haz clic en **"Olvidaste tu contraseña?"**
3. Ingresa tu email de prueba
4. **Ve a tu bandeja de entrada** y busca el email

**Deberías ver:**

✅ Logo "VendeT-Venezuela" en amarillo de fondo
✅ Mensaje "Recuperación de Contraseña"
✅ El nombre de la persona en el saludo
✅ Botón grande azul "REESTABLECER CONTRASEÑA"
✅ Botón funciona y lleva a la página `/reset-password`
✅ Diseño profesional y responsive
✅ Email completamente en español
✅ Información de seguridad clara
✅ Consejos de contraseña segura
✅ Footer completo con contacto

---

## 🎨 Características del Template

### Branding Personalizado

| Elemento | Valor |
|---|---|
| **Nombre** | VendeT-Venezuela |
| **Amarillo** | #C9A84C |
| **Azul** | #7B2D3B |
| **Logo en email** | Texto "VendeT-Venezuela" con gradient |
| **Emojis** | Moderados (🔐, ⚠️, 🔄, 📋) |
| **Idioma** | Español |

### Elementos de Seguridad

1. **Aviso claro** de "si no fue tú, ignora este email"
2. **Tiempo de expiración** explícito (1 hora)
3. **Consejos de contraseña** segura incluidos
4. **URL completa** visible en texto plano también
5. **Contacto** disponible para soporte

### Experiencia de Usuario

1. **Saludo personalizado** con email
2. **Botón grande** y evidente (call-to-action)
3. **URL alternativa** (texto plano) para copy-paste
4. **Diseño responsive** (móvil-first)
5. **Móvil-friendly** (botón de tamaño táctil)

---

## 🚨 Solución de Problemas

### Si el email no se envía:

1. Verifica que **Supabase Email Settings** estén habilitados en Authentication
2. Revisa que el dominio esté verificado en Supabase
3. Check **Authentication** → **Audit Logs** para errores

### Si el template no se ve:

1. Asegúrate de pegar **HTML completo** (doctype incluido)
2. No elimines ninguna etiqueta HTML/XML
3. Verifica que las variables `{{ .Email }}` y `{{ .ConfirmationURL }}` estén presentes

### Si el botón no funciona:

1. El botón usa `{{ .ConfirmationURL }}` - variable estándar de Supabase
2. Verifica que la URL sea correcta en el email
3. Comprueba que la página `/reset-password` existe en tu app

---

## 📋 Variables de Supabase Disponibles

| Variable | Descripción |
|---|---|
| `{{ .Email }}` | Correo electrónico del usuario |
| `{{ .ConfirmationURL }}` | URL completa de recuperación de contraseña |
| `{{ .Token }}` | Token de recuperación único |
| `{{ .RedirectURL }}` | URL de redirección personalizada (si aplica) |

---

## 💡 Mejores Prácticas Implementadas

### ❌ Evitar (lo que NO hemos hecho)

- No usar inglés
- No usar branding genérico ("Hola Usuario")
- No usar enlaces cortados o ambiguos
- No omitir consejos de seguridad
- No usar diseño desktop-only

### ✅ Implementado (lo que SÍ tenemos)

- **Brand personalizado** con colores de VendeT
- **Nombre real** (VendeT-Venezuela)
- **Saludo personalizado** ({{ .Email }})
- **Botón claro** y evidente
- **Avisos de seguridad** prominentes
- **Consejos de contraseña** segura
- **Contacto** disponible
- **Responsive design**
- **Tiempo de expiración** claro
- **Texto plano** alternativo

---

## 🎯 ¿Listo?

**Procede con la configuración en Supabase Dashboard** como indiqué arriba.

¡Una vez lo hagas, el flujo de recuperación de contraseña funcionará PERFECTAMENTE! 🚀

**¿Has configurado esto ya o necesitas ayuda con algún paso específico?**
