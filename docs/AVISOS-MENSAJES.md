# Avisos por email de mensajes sin leer

## El problema

Recibir un mensaje en el chat generaba una notificación in-app (la campanita) y
un push. El push **solo llega a quien aceptó notificaciones del navegador**, que
es una minoría. Un vendedor que publica y no vuelve a entrar no se enteraba de
que tenía un comprador esperando.

En este sector el comprador escribe a cuatro o cinco vendedores a la vez y
compra al primero que le contesta. El tiempo de respuesta es lo que decide si
el portal vende.

Curiosidad: la plantilla `enviarEmailMensaje()` ya existía en
`src/email/server-email.ts` desde hacía tiempo, pero **no la llamaba nadie**.
Estaba escrita y muerta.

## La solución: aviso diferido

Un cron cada 10 minutos (`/api/cron/avisos-mensajes`) busca mensajes sin leer y
sin avisar, y manda **un email por conversación**.

Diferido, no instantáneo, por dos motivos:

1. Si el usuario estaba en la web y ya ha respondido, no recibe nada. Un email
   sobre algo que ya has leído enseña a ignorar nuestros correos.
2. Una conversación animada de ocho mensajes sería ocho emails. Eso es una
   denuncia por spam y el dominio penalizado. Se agrupa: «y 7 mensajes más».

Es el mismo patrón de Wallapop y Airbnb.

### Reglas (en `src/lib/avisos-mensajes.ts`, 19 tests)

| Regla | Valor | Motivo |
|---|---|---|
| Gracia antes de avisar | 10 min | Puede estar leyéndolo ahora mismo |
| Antigüedad máxima | 24 h | Si el cron estuvo caído, no se vacía una avalancha de correos viejos al recuperarse |
| Agrupación | Por conversación | Un email, no uno por mensaje |
| Repetición | Nunca | `mensajes.aviso_email_en` marca lo ya avisado |
| Autoenvío | Bloqueado | Nunca se avisa a alguien de su propio mensaje |

El email enseña el texto del mensaje **más reciente**, el título del anuncio y
un botón que abre esa conversación concreta.

## Opt-out

`perfiles.email_avisos_mensajes`, por defecto `true` (es un aviso transaccional
que el usuario espera: alguien quiere comprarle algo).

El interruptor está en el panel, pestaña Resumen. Se guarda por `/api/perfil`,
**no por el cliente de Supabase**: la tabla `perfiles` tiene permisos por
columna y esa preferencia no está expuesta al navegador a propósito
(verificado con un test contra PostgreSQL real).

Si el usuario lo apaga, sus mensajes se marcan igualmente como avisados: de lo
contrario el cron los reevaluaría cada diez minutos durante 24 horas sin hacer
nada.

## Aviso legal y privacidad

Con las variables `NEXT_PUBLIC_TITULAR_*` configuradas, verificado en build real:

| Página | Nombre | NIF | Domicilio |
|---|---|---|---|
| `/aviso-legal` | ✅ | ✅ | ✅ |
| `/politica-de-privacidad` | ✅ | ✅ | ✅ |
| `/en/politica-de-privacidad` | ✅ | ✅ | ✅ |

La política de privacidad solo remitía al aviso legal para identificar al
responsable. El RGPD (art. 13.1.a) exige la identidad en la propia información
que se da al interesado, así que ahora se inserta en la sección 1. Si el
titular no estuviera configurado, se mantiene el texto anterior: **nunca se
inventan datos identificativos**.

**Ojo:** las variables `NEXT_PUBLIC_*` se incrustan en el **build**, no al
arrancar. Después de añadirlas en Vercel hace falta un **redeploy**; reiniciar
no basta.

## Pendiente

- Aplicar `supabase/migrations/202609220004_avisos_mensajes.sql` (anexada al
  final de `setup-camperocasion.sql`). Hasta entonces el cron responde
  `{ok:true, reason:'migracion-pendiente'}` sin ensuciar los logs.
- Falta `NEXT_PUBLIC_TITULAR_REGISTRO` (Registro Mercantil), obligatorio para
  una SL según el art. 10 de la LSSI.
