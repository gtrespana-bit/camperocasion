# Plantillas de email de Supabase — CamperOcasión

> Copiar/pegar en **Supabase Dashboard → Authentication → Emails**.
> SMTP: Resend (configurado 2026-09-17). Remitente por defecto del sitio:
> `"CamperOcasión" <noreply@camperocasion.online>`.
> Branding común: grafito `#0F172A` / verde `#16A34A` / naranja `#EA580C`,
> español peninsular y dominio `camperocasion.online`.

## Autenticación (llevan token o enlace de verificación)

| Template | Fichero | Variables clave |
|---|---|---|
| Confirm signup («Confirmation Mail») | `confirmation-mail-es.md` (HTML definitivo) · `confirmation-mail-es-v2.md` (variante) | `{{ .Email }}`, `{{ .ConfirmationURL }}` |
| Reset password | `reset-password-es.md` | `{{ .Email }}`, `{{ .ConfirmationURL }}` |

## Notificaciones de seguridad (solo avisan: sin token; requieren interruptor activado)

| Template | Fichero | Variables clave |
|---|---|---|
| Password changed | `password-changed-es.md` | `{{ .Email }}`, `{{ .SiteURL }}` |
| Phone number changed | `phone-number-changed-es.md` | `{{ .OldPhone }}` (antes), `{{ .Phone }}` (nuevo) |

⚠️ Las notificaciones de seguridad **no se envían** si su interruptor está
apagado en el dashboard, aunque la plantilla esté rellena. Sin SMTP personalizado
tampoco se envía nada (Supabase lo exige para producción).

## Flujo de confirmación del sitio

`{{ .ConfirmationURL }}` → `/api/confirm-email?token=…` → `/confirm` → login.
Site URL y Redirect URLs deben apuntar a `https://camperocasion.online`
(`./confirm` y `./reset-password` incluidas).

## Resto de plantillas del dashboard (quedan por personalizar, opcional)

Invite user, Magic Link, Change Email Address, Reauthentication y las demás
notificaciones (Email address changed, Sign-in method linked/removed,
Verification method added/removed). El default de Supabase funciona; el
branding es cosa fina.
