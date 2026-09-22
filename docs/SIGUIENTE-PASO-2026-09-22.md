# Estado al 22/09/2026 — qué está hecho y qué tienes que hacer tú

## 1. Variables para Vercel (copiar y pegar)

Settings → Environment Variables → marcar **Production** y **Preview**.
Después de añadirlas hay que **redeploy** (las `NEXT_PUBLIC_*` se incrustan en
el build).

```
NEXT_PUBLIC_TITULAR_NOMBRE=Lanza CamperOcasion SL
NEXT_PUBLIC_TITULAR_NIF=B56514201
NEXT_PUBLIC_TITULAR_DOMICILIO=Calle Agustín Espinosa 68, 35500 Arrecife, Las Palmas
NEXT_PUBLIC_TITULAR_EMAIL=legal@camperocasion.online
```

Con esas tres primeras, el aviso legal se enlaza en el pie y pasa a indexarse
solo. Si más adelante constituyes la sociedad específica, solo hay que cambiar
estos valores: no se toca código.

Opcional pero recomendable (atención al cliente y confianza):

```
NEXT_PUBLIC_TITULAR_TELEFONO=+34 ...
NEXT_PUBLIC_TITULAR_REGISTRO=Inscrita en el Registro Mercantil de Las Palmas, tomo …, folio …, hoja …
```

`NEXT_PUBLIC_TITULAR_REGISTRO` **es obligatorio para sociedades** según el
art. 10 de la LSSI. Búscalo en la escritura de constitución y rellénalo cuando
lo tengas a mano.

Y las de Stripe, cuando crees el webhook:

```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

## 2. Los buzones de correo — cómo se hacen (no es Resend)

Resend sirve para **enviar** correo desde la web, no para recibirlo. Lo que
falta es poder **recibir** en `legal@` y `privacidad@`, y eso se resuelve donde
tengas el dominio. Lo más simple y gratis:

**Opción A — Cloudflare Email Routing (gratis, 5 minutos).** Si el DNS de
`camperocasion.online` está en Cloudflare: panel → *Email* → *Email Routing* →
activar → *Create address*. Creas `legal@camperocasion.online` y
`privacidad@camperocasion.online` y las rediriges a tu Gmail. Cloudflare añade
solo los registros MX. No cuesta nada y no hay buzón que mantener.

**Opción B — tu registrador de dominio.** Casi todos (IONOS, Namecheap,
Hostinger) ofrecen reenvío de correo gratuito en el panel del dominio: busca
«Email forwarding» o «Redirecciones de correo».

**Opción C — Google Workspace / Zoho Mail** si quieres buzones de verdad con
los que también puedas responder desde esa dirección (Zoho tiene plan gratuito
para un dominio).

Con A o B recibes, pero al responder saldría tu Gmail personal. Si quieres
responder *como* `legal@camperocasion.online`, en Gmail: Configuración → Cuentas
→ «Enviar como» → añadir la dirección.

Lo importante es que **alguien lea esos buzones**: una obligación legal que
apunta a un correo que nadie contesta no cumple la norma.

## 3. Migraciones SQL pendientes de aplicar en Supabase

Aplicada ya: `202609220001_stripe_pagos.sql` ✅ (confirmado por ti).

⚠️ **Vuelve a ejecutarla.** Se corrigió un fallo real de permisos después de que
la aplicaras: en PostgreSQL toda función nueva nace con `EXECUTE` concedido a
`PUBLIC`, y `revoke … from anon, authenticated` **no** quita ese permiso
heredado. Lo detectó el verificador nuevo. La migración es idempotente, así que
volver a ejecutarla es seguro y deja los permisos como deben estar.

Nueva, **pendiente**:

```
supabase/migrations/202609220002_tiendas_profesionales.sql
```

Sin ella, la pestaña «Mi tienda» avisa de que falta la migración y `/tiendas`
sale vacío — no se rompe nada.

## 4. Lo implementado en esta tanda

### Stripe (cobro automático)

Detalle completo en [`docs/STRIPE.md`](./STRIPE.md). Resumen: `/creditos` ahora
ofrece «Pagar ahora con tarjeta o Bizum», los créditos se acreditan solos por
webhook y Stripe emite la factura. El pago manual sigue como red de seguridad.

Verificado contra un Postgres real con `scripts/verify_stripe_sql.py` (18/18):
un reintento de webhook **no** duplica créditos, y ni `anon` ni `authenticated`
pueden acreditarse nada.

### Tienda para profesionales

- **`/tienda/[slug]`** — escaparate con portada, logo, descripción, horario,
  web, stock completo con buscador, rango de precios y JSON-LD `AutoDealer`
  (ficha de negocio local en Google).
- **`/tiendas`** — directorio de camperizadores y profesionales, con CTA de
  captación.
- **Dashboard → «Mi tienda»** — el vendedor edita todo y ve su URL en grande
  con botón de copiar. Ese es el gancho: una dirección que puede pegar en su
  Instagram.
- Reglas en la base: el slug se genera solo sin colisiones
  (`camper-center`, `camper-center-2`), un particular no puede abrir tienda, y
  si un profesional se pasa a particular su tienda se cierra sola.
- El slug **no** se regenera al cambiar el nombre, a propósito: una URL ya
  repartida que muta sola rompe los enlaces que el vendedor colocó.

## 5. Lo que queda

- **Páginas de modelo** con precios reales de mercado (siguiente tanda).
- Avisos de renovación y estadísticas del vendedor.
- Partner real de gestoría y cobro del servicio.
- Revisión de un abogado antes de facturar en serio (acordado: al final).
