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

## Stripe

`POST /api/planes/checkout` crea una suscripción. El webhook
(`checkout.session.completed` + `customer.subscription.*`) escribe
`perfiles.plan_anuncios` y `plan_hasta`.

Hay que añadir en el webhook de Stripe los eventos de suscripción (además de
los de checkout de créditos).

Migración: `supabase/migrations/202609280001_planes_cupones.sql`.
