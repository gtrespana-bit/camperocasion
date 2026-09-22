# Stripe — cobro automático de créditos

Implementado el 2026-09-22. Convive con el pago manual: si Stripe no está
configurado, la web sigue exactamente como antes (Bizum/transferencia/PayPal
con comprobante). No hay forma de que una variable ausente rompa producción.

## Qué hace

- **`/creditos`** muestra un bloque «Pagar ahora con tarjeta o Bizum» encima de
  los métodos manuales. El usuario paga en Stripe y vuelve con los créditos ya
  acreditados. Sin captura de pantalla, sin aprobación a mano.
- **Factura automática** de Stripe por email y enlace guardado en la
  transacción (`factura_url`).
- **Telegram** avisa de cada cobro, igual que antes.

## Piezas

| Archivo | Papel |
|---|---|
| `src/lib/stripe.ts` | Cliente de Stripe (solo servidor) y URL del sitio |
| `src/lib/stripe-pagos.ts` | **Reglas puras** de qué se acredita y qué no (testeadas) |
| `src/app/api/stripe/checkout/route.ts` | Crea la Checkout Session |
| `src/app/api/stripe/webhook/route.ts` | Único sitio donde se acreditan créditos |
| `src/app/api/stripe/estado/route.ts` | Dice al cliente si el pago está activo |
| `supabase/migrations/202609220001_stripe_pagos.sql` | Columnas, índice único y RPC `acreditar_pago_stripe` |
| `tests/unit/stripe-pagos.test.ts` | 13 tests sobre el dinero |

## Cómo está protegido el dinero

1. **El precio lo pone el servidor.** El cliente solo manda cuántos créditos
   quiere; el importe sale de `PAQUETES_CREDITO`. Si viniera del navegador,
   cualquiera compraría 100 créditos por un céntimo.
2. **La firma del webhook se verifica** con `STRIPE_WEBHOOK_SECRET` sobre el
   cuerpo crudo. Sin firma válida no se toca la base de datos.
3. **Idempotencia real**: índice único sobre `stripe_session_id`. Stripe
   reintenta los webhooks; sin esto, un reintento sumaría créditos dos veces.
4. **El importe cobrado se compara con el precio del paquete.** Si aparece una
   sesión creada fuera de nuestro flujo (un Payment Link hecho a mano de 1 €
   con metadata de 100 créditos), se descarta.
5. **`payment_status === 'paid'` obligatorio.** Bizum es asíncrono: el evento
   llega antes de que el banco confirme. Acreditar ahí sería regalar créditos.
6. **La RPC solo la puede llamar `service_role`**, nunca un usuario logueado.

## Puesta en marcha (lo que tienes que hacer tú)

### 1. Aplicar la migración en Supabase

SQL Editor → pegar y ejecutar:

```
supabase/migrations/202609220001_stripe_pagos.sql
```

Es idempotente. Sin ella el webhook devuelve error y Stripe reintenta, así que
**hazlo antes de activar el webhook**.

### 2. Cuenta de Stripe **propia** (no reutilizar CotizaT ni otro proyecto)

El Checkout **no** coge el nombre de esta web: enseña el de la cuenta de Stripe
cuyas claves hayas pegado. Si ves «Pagar a CotizaT», PAB u otra divisa, las
claves de Vercel son las de **otro** negocio. Crea (o usa) una cuenta Stripe
de CamperOcasión, España, liquidación en **EUR**.

Dashboard → *Settings → Public details*:

- **Business name**: CamperOcasión (esto es el «Pagar a …» del checkout)
- **Statement descriptor**: CAMPEROCASION
- **Support**: soporte@camperocasion.online / camperocasion.online
- **Brand**: logo y color de CamperOcasión

Dashboard → *Settings → Account details*: país ES, moneda predeterminada EUR.

Luego *Developers → API keys* **de esa cuenta**:

```
STRIPE_SECRET_KEY = sk_live_…      (o sk_test_… para probar)
```

Marca los entornos Production y Preview. **No** hace falta ninguna variable
pública: la clave publicable no se usa porque redirigimos a Checkout alojado.

En el código el precio ya va en `eur` y Adaptive Pricing está desactivado
para que no aparezca «Elige divisa». El nombre comercial **no** se puede
cambiar por API: solo en el dashboard de la cuenta correcta.

### 3. Crear el webhook

Dashboard de Stripe → *Developers → Webhooks → Add endpoint*:

- **URL**: `https://camperocasion.online/api/stripe/webhook`
- **Eventos**: `checkout.session.completed` y
  `checkout.session.async_payment_succeeded`

Copia el *Signing secret* (`whsec_…`) y añádelo en Vercel:

```
STRIPE_WEBHOOK_SECRET = whsec_…
```

Luego **redeploy** (las variables solo se aplican en un despliegue nuevo).

### 4. Activar Bizum en la cuenta de Stripe

Dashboard → *Settings → Payment methods → Bizum*. Requiere cuenta con entidad
en España. Si no está activo, el checkout muestra solo tarjeta y no falla.

### 5. Probar antes de cobrar de verdad

Con `sk_test_…` y tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC):

1. `/creditos` → elegir paquete → «Pagar ahora».
2. Completar el pago → vuelves a `/creditos?pago=ok`.
3. Comprobar en Supabase que hay una fila en `transacciones_creditos` con
   `metodo_pago = 'stripe'`, `estado = 'aprobado'` y `stripe_session_id`.
4. Comprobar que `perfiles.credito_balance` subió **una sola vez**.
5. En Stripe → el webhook debe figurar en verde (200).

Para reintentar el webhook y verificar la idempotencia: en el dashboard del
webhook, botón *Resend*. El saldo **no** debe cambiar y la respuesta debe traer
`"duplicado": true`.

## Verificación hecha el 22/09/2026 (local, con la app compilada)

| Prueba | Resultado |
|---|---|
| `/api/stripe/estado` con claves | `{"disponible":true}` |
| Webhook **sin** cabecera de firma | 400 «Falta la firma» |
| Webhook con firma **falsa** | 400 «Firma inválida» |
| Webhook con payload **manipulado** y firma del original | rechazado por la librería de Stripe |
| Checkout **sin sesión** | 401 |
| Pago **no confirmado** (Bizum pendiente) | 200, no acredita |
| Evento irrelevante (`payment_intent.created`) | 200, ignorado |
| **100 créditos pagando 1 €** | descartado: «Importe cobrado (1 €) no coincide con el paquete (20 €)» |
| Paquete inventado (999) | descartado |
| Sesión sin usuario | descartado |
| Sin claves configuradas | 503 y `/creditos` sigue cargando (no rompe) |

Contra Postgres real (`scripts/verify_stripe_sql.py`, 18/18): un reintento del
webhook **no** duplica créditos, y ni `anon` ni `authenticated` pueden ejecutar
la RPC de acreditación.

Lo único que **no** se puede verificar desde aquí es el cobro real de extremo a
extremo, porque requiere tus claves y el dominio en producción. Esa prueba está
descrita en el paso 5 de arriba y son dos minutos.

## Qué pasa con el pago manual

Se queda. Es la red de seguridad mientras Stripe esté en pruebas y la vía para
quien no quiera pagar con tarjeta. Cuando Stripe lleve semanas funcionando y la
mayoría lo use, se puede retirar borrando las variables `PAGO_*`: la página
oculta sola los métodos no configurados.
