# Planes, mes de prueba y cupones

> Actualizado 2026-10-22. El análisis completo del modelo (identidad, plan y
> créditos) está en
> [`MODELO-CUENTAS-Y-MONETIZACION-2026-10.md`](./MODELO-CUENTAS-Y-MONETIZACION-2026-10.md).

## Cupos

| Plan | Anuncios activos | Destacados/mes | Fotos | Mensual | Anual (2 meses gratis) |
| --- | --- | --- | --- | --- | --- |
| Gratis (cualquier identidad) | 1 | 0 (créditos) | 10 | 0 € | 0 € |
| Starter | 5 | 3 | 10 | 9 €/mes | 90 €/año |
| Plus | 15 | 5 | 20 | 19 €/mes | 190 €/año |
| Unlimited Flota | sin límite | 15 | 30 | 39 €/mes | 390 €/año |

- El **tipo de vendedor** (particular / camperizador / profesional) es gratis y
  no es un plan: define el sello y los filtros.
- Abrir el **escaparate** (`/tienda/slug`) exige un pack activo o el mes de
  prueba. Las tiendas ya publicadas antes de 2026-10-22 se mantienen.
- Si un **particular** contrata un pack, el webhook lo pasa a `profesional`
  para que reciba el cupo pagado (`aplicarPlanPerfil` →
  `promoverAProfesional`).

## Prueba de 30 días (fase 2, 2026-10-22)

- Cada cuenta tiene **fechas reales de prueba** en `perfiles`:
  `trial_iniciado_en`, `trial_hasta` y `trial_plan` (Plus).
- **Cuándo empieza**: al darse de alta como camperizador/profesional (trigger
  `fn_iniciar_trial_perfil`), al cambiar de particular a profesional, o cuando
  el usuario pulsa «Probar 30 días gratis» (`POST /api/planes/prueba`). En ese
  último caso se le promociona a `profesional` para que reciba el cupo de Plus.
- **Una sola vez por cuenta**: si ya tiene fechas de prueba (aunque hayan
  caducado) no puede repetirla. Caer de un pack de pago a gratis tampoco
  genera una prueba nueva.
- **El interruptor global** de `/admin` → Planes y cupones solo decide si se
  concede una prueba **nueva**. Apagarlo ya **no** corta a quien está a mitad:
  sus fechas están guardadas.
- **Avisos**: cron diario `/api/cron/planes` (09:10 UTC), email + push a 10, 3
  y 1 días; al terminar, aviso de gracia y del último día de gracia.
  Idempotente con la tabla `plan_avisos`.
- **Gracia de 7 días**: durante la gracia el plan sigue siendo Plus y no se
  cobra nada. Al terminar, `aplicar_cupo_planes()` pausa los anuncios que
  exceden el cupo del plan gratuito. **No borra nada**, conserva primero los
  destacados y los de más visitas, y los marca con `pausado_por_plan`.
- **Reactivación**: al contratar o subir de pack se republican solos; también
  hay un botón «Reactivar los que quepan» en la pestaña Mi plan
  (`POST /api/productos/reactivar-pausados`). Reactivar a mano comprueba el
  cupo en el servidor.
- **Win-back (fase 3)**: una semana después de perder el cupo —fin de la gracia
  o baja confirmada en Stripe— el cron manda un email y un push que explican
  que los anuncios siguen guardados y que al volver se reactivan. Clave
  `winback:<fecha>` en `plan_avisos`; solo se envía si la pérdida ocurrió en
  los últimos 30 días, para no disparar correos masivos la primera vez. El
  webhook deja la fecha de baja como `baja:YYYY-MM-DD` en `plan_avisos`.
  Si defines `WINBACK_CUPON`, el email incluye ese código.

### Antes de aplicar la migración: vista previa

La primera pasada del cron pausará los anuncios que excedan el cupo también a
quien ya estaba dentro (por ejemplo, un camperizador con la prueba caducada y
5 anuncios). **No borra nada**, pero conviene saber a quién afecta. Esta
consulta es de solo lectura:

```sql
with efectivo as (
  select p.id, p.nombre,
    case
      when p.tipo_vendedor not in ('camperizador','profesional') then 'gratis'
      when p.plan_anuncios in ('starter','plus','unlimited')
           and (p.plan_hasta is null or p.plan_hasta >= now()) then p.plan_anuncios
      when p.trial_hasta is not null
           and p.tipo_vendedor in ('camperizador','profesional')
           and now() <= p.trial_hasta + interval '7 days'
           then coalesce(p.trial_plan, 'plus')
      else 'gratis'
    end as plan
  from public.perfiles p
),
cupos as (
  select id, case plan
    when 'starter' then 5 when 'plus' then 15 when 'unlimited' then null else 1
  end as cupo
  from efectivo
),
activos as (
  select pr.user_id, count(*) as n
  from public.productos pr
  where pr.activo is true
    and coalesce(pr.vendido,false) = false
    and coalesce(pr.es_demo,false) = false
  group by pr.user_id
)
select e.id, e.nombre, e.plan, c.cupo, a.n as activos
from efectivo e
join cupos c on c.id = e.id
join activos a on a.user_id = e.id
where c.cupo is not null and a.n > c.cupo
order by a.n - c.cupo desc;
```

### Probar la fase 2 sin esperar 30 días

Con un usuario de prueba, mueve sus fechas y ejecuta el cron a mano:

```sql
-- Deja la prueba a un día del final
update public.perfiles
   set trial_iniciado_en = now() - interval '29 days',
       trial_hasta = now() + interval '1 day',
       trial_plan = 'plus'
 where id = 'UUID_DEL_USUARIO';

-- Para probar la gracia: fin en el pasado, dentro de los 7 días
update public.perfiles
   set trial_hasta = now() - interval '2 days'
 where id = 'UUID_DEL_USUARIO';

-- Para probar la pausa: fin hace más de 7 días y varios anuncios activos
update public.perfiles
   set trial_hasta = now() - interval '8 days'
 where id = 'UUID_DEL_USUARIO';
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://camperocasion.online/api/cron/planes
```

La respuesta trae `avisos`, `emails`, `pausados` y `usuariosPausados`. Los
emails requieren `RESEND_API_KEY` (o SMTP) y el dominio verificado en Resend;
si no hay canal, el aviso se marca igualmente y se ve en el panel.

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

## Stripe y dunning

`POST /api/planes/checkout` crea una suscripción. El webhook
(`checkout.session.completed` + `customer.subscription.*` + `invoice.*`)
escribe `perfiles.plan_anuncios` y `plan_hasta`.

- `invoice.paid` renueva `plan_hasta` en cada periodo (sin esto el segundo mes
  pagado podía degradar al cliente a gratis) y limpia
  `pago_pendiente_desde`.
- `invoice.payment_failed` marca `pago_pendiente_desde`, envía el primer email
  e **no corta el acceso**: manda `plan_hasta`. El cron recuerda a los 3 y 7
  días.
- `customer.subscription.deleted` baja a `gratis` y limpia el dunning.
- Los precios se venden **con IVA incluido** (`tax_behavior: 'inclusive'`).
- Si falta el metadata (p. ej. un cambio hecho en el portal), el plan se
  deduce del `lookup_key` del precio.

Migraciones:
- `supabase/migrations/202609280001_planes_cupones.sql` (planes, cupones y ajustes).
- `supabase/migrations/202610220001_planes_prueba_gracia_dunning.sql` (prueba
  con fechas, dunning, pausa por cupo y tabla `plan_avisos`).
