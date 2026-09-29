# Planes, mes de prueba y cupones

> 2026-09-28

## Cupos

| Cuenta | Anuncios activos | Destacados/mes | Fotos |
| --- | --- | --- | --- |
| Particular | 1 | 0 (créditos) | 10 |
| Starter 9 €/mes | 5 | 3 | 10 |
| Plus 19 €/mes | 15 | 5 | 20 |
| Unlimited Flota 39 €/mes | sin límite | 15 | 30 |

Particular = una camper. Stock = cuenta profesional + pack.

## Mes gratis

Cada profesional/camperizador nuevo tiene N días (por defecto 30) **desde
`perfiles.creado_en`** con el pack Plus. El admin lo enciende o apaga en
`/admin` → Planes y cupones. Al apagarlo, deja de aplicar también a quien
estuviera a mitad de prueba.

## Regalo directo desde el panel

Además del mes de prueba global y de los cupones, el admin puede **regalar días
de pack a un usuario concreto**: `/admin` → *Planes y cupones* → «Regalar pack a
un usuario» (o el botón 🎁 de la pestaña Usuarios). Es `POST
/api/admin/regalar-plan`, que escribe `perfiles.plan_anuncios` / `plan_hasta`
—los mismos campos que Stripe— y deja constancia en la tabla `planes_regalos`
(quién, qué pack, cuántos días, modo, motivo y qué admin lo hizo).

- **Días**: 1 – 3650. Atajos de 7, 15, 30, 90, 180 y 365 en el modal.
- **Modo**: `extender` suma los días al final del periodo vigente (si es el
  mismo pack); `reemplazar` empieza a contar ahora.
- **Sin pack** (`gratis`) retira el pack: vuelve al plan gratuito.
- El canje de cupones exige cuenta profesional; el regalo del admin **no**: si
  el usuario es «particular» y se le regala un pack, el modal ofrece marcarlo
  como profesional, porque si no el cupo de 1 anuncio sigue aplicando.
- El usuario recibe un email de aviso (`emailPlanRegalado`) para que no le
  extrañe tener más cupo sin haber pagado.

`GET /api/admin/regalar-plan` devuelve quién tiene pack activo ahora (con los
días que le quedan) y los últimos 50 regalos, que es lo que se ve en esa misma
pestaña.

## Stripe

`POST /api/planes/checkout` crea una suscripción. El webhook
(`checkout.session.completed` + `customer.subscription.*`) escribe
`perfiles.plan_anuncios` y `plan_hasta`.

Hay que añadir en el webhook de Stripe los eventos de suscripción (además de
los de checkout de créditos).

Migración: `supabase/migrations/202609280001_planes_cupones.sql`.
