# Modelo de cuentas y monetización — auditoría y propuesta

> 2026-10-22 · Análisis del código real + cambios aplicados en la rama
> `arena/a2595c50-camperocasion`.

---

## 1. Resumen ejecutivo

La intuición es correcta: **ahora mismo no hay «tres tipos de cuenta»**. Hay tres
cosas distintas mezcladas con nombres que se parecen:

| Capa | Qué es hoy | Qué debería ser |
|---|---|---|
| `particular / camperizador / profesional` | Una **identidad** gratuita que se elige al registrarse y se puede cambiar en el perfil. Da sello, filtro y (hasta hoy) tienda gratis. | Una identidad gratuita, verificable y separada del pago. |
| `gratis / starter / plus / unlimited` | Un **plan** de pago por capacidad (anuncios, fotos, destacados). | El único cobro recurrente. |
| Créditos | Una **moneda de pago por uso** para visibilidad puntual. | Se queda: es complementaria al plan, no sustituta. |

El problema no es el modelo de datos —está bien pensado— sino **cómo se
presenta y cuándo se enseña**:

1. Al registrarse se pregunta «¿qué tipo de vendedor eres?», que suena a
   elegir cuenta/plan, pero **no cobra nada ni explica qué implica**.
2. La página de planes (`/para-profesionales`) **no estaba enlazada ni en el
   header ni en el footer**. Solo se llegaba desde el aviso de cupo lleno o
   desde el sitemap.
3. El plan **no se muestra en el panel**. El usuario no ve qué tiene, cuánto
   usa ni cuándo termina la prueba. La prueba de 30 días caduca en silencio.
4. Se vende como ventaja del plan el **escaparate y el sello profesional**,
   que en realidad eran gratis para cualquiera que se declarase
   camperizador/profesional.
5. Un **particular podía pagar 19 € y seguir con 1 anuncio**, porque el cupo
   se calcula por identidad y no por plan.

Resultado: el usuario percibe que «ya está dentro» al registrarse y las
opciones de pago aparecen tarde, mal y sin contexto. La buena noticia es que
se arregla sobre todo con producto y copy, no reescribiendo la base de datos.

---

## 2. Qué hay implementado hoy (mapa real)

### 2.1 Registro

- `src/app/[locale]/(auth)/register/page.tsx` pide nombre, email, contraseña y
  **tipo de vendedor** (particular / camperizador / profesional).
- `POST /api/register` crea el usuario con `auth.admin.generateLink` y el
  trigger `crear_perfil()` copia `tipo_vendedor` a `perfiles`.
- **No se pide tarjeta, plan ni facturación.** El registro termina y el
  usuario ya puede publicar.
- Banner del registro: «1 crédito GRATIS» + «publica 10 anuncios y recibe 5
  créditos más».

### 2.2 Identidad (`perfiles.tipo_vendedor`)

- Se puede cambiar gratis desde el panel (`DashboardHeader` → `PATCH
  /api/perfil`).
- `camperizador` y `profesional` son funcionalmente iguales (`esProfesional`).
- Desbloquea la tienda (`/api/tienda`) y los cupones de pack
  (`/api/planes/canjear`). No tiene precio.

### 2.3 Plan (`perfiles.plan_anuncios` + `plan_hasta`)

- `src/lib/planes-anuncios.ts`: 4 estados (`gratis`, `starter`, `plus`,
  `unlimited`), 5/15/∞ anuncios, 3/5/15 destacados, 10/20/30 fotos.
- Se aplica desde Stripe (`api/stripe/webhook`), cupones o regalo del admin.
- **Prueba**: 30 días con Plus para todo profesional nuevo, calculados en
  vivo desde `perfiles.creado_en` y un interruptor global en
  `plataforma_ajustes`. No hay registro por usuario, ni emails de aviso, ni
  fecha de fin persistida.
- **Enforcement**: solo al publicar (`/api/publicar`): cupo y máximo de fotos.
  Si la prueba termina o se baja de plan, los anuncios ya publicados **siguen
  visibles**; solo se bloquea publicar nuevos.

### 2.4 Créditos

- `src/lib/creditos.ts`: paquetes de 2/15/40/100 créditos por 1/5/10/20 €.
- 1 crédito de bienvenida + 5 al llegar a 10 publicaciones (`011_credito_sistema.sql`).
- Se gastan con RPC atómicas: `usar_boost` (1 crédito, 7 días en el nº 1) y
  `usar_destacado` (4/6/10 créditos para 12/24/48 h).
- Pago: Stripe (`mode=payment`) o Bizum/transferencia/PayPal con comprobante.
  La parte de Stripe está bien resuelta: precio en servidor, firma verificada,
  idempotencia y comparación de importe.

### 2.5 Dónde aparecen hoy las opciones de pago

| Momento | ¿Se ve el precio? |
|---|---|
| Registro | No |
| Primer anuncio | No |
| Segundo anuncio / cupo lleno | **Sí, pero solo si eres profesional**. Un particular veía un enlace a «cambia tu tipo en el panel», no los precios. |
| Compra de créditos | Sí, en `/creditos` (enlazado en el header) |
| Panel / perfil | No. El plan no se muestra en ninguna pestaña. |
| Página de planes | Sí, pero **huérfana**: sin enlace en header/footer; solo desde el aviso de cupo y el sitemap. |

Esa es la respuesta corta a «¿en qué momento se muestran las opciones de
pago?»: **casi nunca, y cuando aparecen es porque el usuario ya está
frustrado porque no puede publicar**.

---

## 3. Los problemas, por gravedad

### P0 — Errores que cuestan dinero o confianza

1. **Un particular paga un plan y no recibe el cupo.**
   `cupoMaximo()` devuelve 1 para cualquier identidad que no sea
   camperizador/profesional, aunque tenga `plan_anuncios = 'plus'`. El checkout
   no comprobaba el tipo. Solo el modal de regalo del admin avisaba.
   *Arreglado:* al confirmarse un pack, el perfil pasa a `profesional`.

2. **El escaparate era gratis y el plan lo vendía como ventaja.**
   Cualquiera que se declarase camperizador/profesional abría `/tienda/su-slug`
   sin pagar. El plan prometía «escaparate y sello profesional» que ya tenía.
   *Arreglado:* abrir una tienda nueva exige pack o prueba; las tiendas ya
   publicadas se mantienen (abuelo). El sello profesional se saca de la lista
   de ventajas del plan porque es identidad gratuita.

3. **Suscripciones sin portal de cliente.**
   No había forma de cambiar la tarjeta, descargar facturas ni darse de baja
   sin escribir un email. En la UE, la baja debe estar a la misma distancia
   que el alta.
   *Arreglado:* `POST /api/planes/portal` + botón «Gestionar suscripción» en
   «Mi plan» y en la página de precios. Requiere activarlo en Stripe
   (Dashboard → Settings → Billing → Customer portal).

4. **Bizum en modo suscripción.**
   El checkout de packs enviaba `payment_method_types: ['card', 'bizum']`.
   Bizum no admite cobros recurrentes; según la cuenta, Stripe puede rechazar
   la sesión. *Arreglado:* tarjeta (Apple Pay/Google Pay incluidos) en
   suscripciones; Bizum se queda para créditos, que son pago único.

5. **El `?pago=ok` se ignoraba.**
   El usuario pagaba y volvía a la misma página, sin confirmación ni
   siguiente paso. *Arreglado:* banner de éxito con «Publicar anuncio» y
   «Ver mi plan», reintentos para esperar al webhook y estado de cancelación.

### P1 — Diseño de producto

6. **Registro que parece un plan.** Se pregunta el tipo sin explicar que es
   gratis y sin relación con el pago. *Mitigado:* copy «¿Cómo vas a vender?»,
   «Es gratis y podrás cambiarlo», y nombre «Profesional» en vez de «Pro»
   (que se confundía con Plus).

7. **El plan es invisible.** No hay estado, uso ni cuenta atrás. El usuario no
   puede echar de menos lo que no sabe que tiene.
   *Arreglado:* franja de plan en todas las pestañas del panel + pestaña «Mi
   plan» con cupo, fotos, destacados, créditos, cuenta atrás de la prueba y
   gestión de suscripción.

8. **Prueba global y silenciosa.** Se aplica por `creado_en`, no por usuario;
   apagarla afecta a quien está a mitad. No hay email/push antes de que
   termine. Es la mayor palanca de conversión sin usar.

9. **Sin anual.** Todo el mundo paga mes a mes, con más fricción y más churn.
   *Arreglado:* 90/190/390 € (10 mensualidades = 2 meses gratis) y precios
   estables en Stripe con `lookup_key`.

10. **Créditos y plan compiten sin explicación.** El boost de 1 crédito da 7
    días en el nº 1; un destacado de 12 h cuesta 4 créditos. El boost es mejor
    y más barato, y además puede tapar los destacados que el plan incluye.
    Quien compra 3 destacados en un mes debería ver que Plus le sale mejor.

11. **El pack de 2 créditos por 1 € no cubre comisiones.** Con Stripe
    (1,5 % + 0,25 €) el fee se come ~26 % del importe. No es un problema de
    producto, es de margen.

12. **Descubrimiento.** El plan no estaba enlazado desde el header/footer y no
    había venta cruzada desde `/creditos`.
    *Arreglado:* enlace en footer y menú móvil, venta cruzada en `/creditos` y
    en la pestaña Créditos, franja de plan en el panel.

### P2 — Operación y cumplimiento

13. **Dunning.** Si falla el cobro, el plan sigue hasta `plan_hasta` y luego
    cae sin aviso. *Arreglado (fase 2):* `invoice.payment_failed` marca
    `pago_pendiente_desde` y envía el email en el momento; el cron recuerda a
    los 3 y 7 días; `invoice.paid` limpia el aviso. El corte final lo decide el
    calendario de reintentos de Stripe (configúralo a 2 semanas).

14. **Clientes duplicados en Stripe.** Los créditos usan `customer_email` en
    cada compra; los packs guardan `stripe_customer_id`. Un mismo taller puede
    acabar con varios clientes y facturas repartidas. *Mitigado en packs:* se
    reutiliza el customer si existe. Pendiente en créditos.

15. **IVA y datos fiscales.** *Resuelto:* `tax_id_collection` en el checkout
    de packs y precios con IVA incluido (`tax_behavior: 'inclusive'`,
    9/19/39 € finales). Stripe Tax queda solo para ventas B2B fuera de España.

16. **Bajas y cupo.** Si alguien con 15 anuncios vuelve a Gratis, conserva
    los 15 publicados hasta que corre el cron: entonces se pausan los que
    sobran (no se borran) y se avisa por email. Ya no hay barra libre
    indefinida, pero tampoco se destruye nada.

### 3.1 Por qué un usuario no activa un pack (hipótesis y respuesta)

| Hipótesis | Lo que se veía | Lo que hay ahora |
|---|---|---|
| «No sabía que existía» | Página de planes sin enlace | Footer, menú móvil, panel, créditos, anuncio publicado |
| «Ya soy profesional al registrarme» | Identidad y plan con nombres parecidos | Bloque que separa identidad / plan / créditos |
| «La tienda ya la tengo gratis» | Escaparate gratis | Tienda nueva requiere pack o prueba |
| «No sé qué gano» | Lista de features genérica | Cupo, fotos, destacados, precio por anuncio y comparativa |
| «Pagar no me dará más ventas» | Sin prueba ni datos | Prueba Plus 30 días + cuenta atrás + destacados incluidos |
| «Miedo a una suscripción trampa» | Sin portal ni baja | Portal de Stripe, sin permanencia, factura con NIF |
| «No es el momento» | Sin anual ni urgencia | Anual con 2 meses gratis + avisos de fin de prueba (roadmap) |

### 3.2 Referencias de mercado (patrón, no copia)

Los clasificados que funcionan monetizan en este orden:

1. **Visibilidad** (pago por uso): subir, destacar, renovar. Es lo que ya hacen
   los créditos y lo que el vendedor entiende sin explicación.
2. **Capacidad** (suscripción): más anuncios, escaparate, herramientas. Es el
   pack.
3. **Software** (SaaS): importación de stock, multi-usuario, analítica,
   financiación. Es lo que justifica el plan alto.

CamperOcasión ya tiene el 1 y el 2 a medias; el 3 es la asignatura pendiente
para que Flota no sea solo «más anuncios». En un vertical como camper, la
confianza (homologación verificada) y los filtros técnicos ya son un
diferenciador real: conviene usarlos en el discurso comercial del pack, no
esconderlos.

---

## 4. El modelo que recomiendo

### 4.1 Tres capas, una sola de pago

```
IDENTIDAD (gratis)          PLAN (suscripción)           CRÉDITOS (pago por uso)
──────────────────          ───────────────────           ───────────────────────
Particular                  Gratis    1 anuncio          1 crédito = boost 7 días
Camperizador                Starter   5 anuncios         4/6/10 = destacado 12/24/48 h
Profesional                 Plus      15 anuncios        Sin caducidad
                            Flota     ∞ anuncios
```

Reglas de oro:

1. **La identidad nunca se cobra.** Define cómo apareces, no cuánto puedes
   publicar. Se puede verificar (documento) pero no se vende.
2. **El plan se vende por capacidad y herramientas**, no por «ser profesional».
3. **Los créditos son para un anuncio concreto**, no para desbloquear la
   cuenta.
4. **Nunca se pide pago antes de que el usuario haya visto el valor** (primera
   publicación gratuita y bien guiada).
5. **El plan se elige cuando se necesita**: segundo anuncio, escaparate,
   prueba que termina, más destacados.

### 4.2 Qué es gratis y qué se paga

| Función | Gratis | Starter | Plus | Flota |
|---|---|---|---|---|
| Anuncios activos | 1 | 5 | 15 | ∞ |
| Fotos por anuncio | 10 | 10 | 20 | 30 |
| Chat y contacto | ✅ | ✅ | ✅ | ✅ |
| Sello de identidad | ✅ | ✅ | ✅ | ✅ |
| Escaparate `/tienda/slug` | — | ✅ | ✅ | ✅ |
| Destacados incluidos/mes | — | 3 | 5 | 15 |
| Prioridad en homologación | Normal | Alta | Muy alta | Máxima |
| Créditos | Se compran | Se compran | Se compran | Se compran |

> Nota: el escaparate de las tiendas **ya publicadas** antes de este cambio se
> mantiene activo. La puerta solo aplica a tiendas nuevas.

### 4.3 Precios

Mantengo la estructura 9/19/39 porque es fácil de explicar y barata para el
sector. El anual es la palanca inmediata:

| Pack | Mensual | Anual | Equivalente | Ahorro |
|---|---|---|---|---|
| Starter | 9 €/mes | 90 €/año | 7,50 €/mes | 2 meses |
| Plus | 19 €/mes | 190 €/año | 15,83 €/mes | 2 meses |
| Flota | 39 €/mes | 390 €/año | 32,50 €/mes | 2 meses |

Recomendaciones a probar (no aplicadas todavía):

- **Starter a 12 €**: el precio actual está por debajo del valor percibido de
  un escaparate + 5 anuncios. Subir 3 € no debería mover la conversión y
  mejora el margen. Probar A/B antes de tocar la lista.
- **Quitar el pack de 2 créditos por 1 €** o subirlo a 2 €. El fee fijo se come
  el margen; y el usuario que compra 2 créditos no es el que necesita el
  producto, es el que prueba.
- **Reequilibrar boost y destacado**: o el boost dura 48 h, o el destacado
  baja a 2 créditos/12 h. Hoy el boost de 1 crédito (7 días en el nº 1) hace
  que el destacado parezca caro y canibaliza los destacados del plan.
- **Precio por anuncio visible**: 1,80 €/anuncio/mes en Starter y 1,27 € en
  Plus. Es el argumento más claro frente a «9 € al mes».

---

## 5. Los momentos de conversión (el corazón del asunto)

No se vende un plan en una página de precios a la que nadie llega. Se vende en
el momento en que el usuario choca con un límite o ve una oportunidad.

| # | Momento | Mensaje | CTA |
|---|---|---|---|
| 1 | Al registrarse | «Publicar tu primera camper es gratis» | Publicar |
| 2 | Anuncio publicado | «Tu anuncio ya está en el catálogo. Destácalo 12 h por 1,33 €» | Destacar / Ver planes |
| 3 | Segundo anuncio (particular) | «Solo puedes tener 1 activo. Si tienes stock, elige pack» | Starter / Plus |
| 4 | Cupo lleno (pro) | «Has llenado tus 5 anuncios. Plus te da 15» + pausar | Ampliar / Pausar |
| 5 | Día 1, 20, 27 y 30 de prueba | Franja con cuenta atrás + email/push | Activar Plus |
| 6 | Fin de prueba | 7 días de gracia, luego se pausan los que sobran (no se borran) | Reactivar |
| 7 | Abrir tienda | «El escaparate va con los packs» | Ver packs |
| 8 | Compra de créditos | «Si destacas 2+ al mes, Plus incluye 5» | Comparar |
| 9 | Resumen mensual | «Tus anuncios: X visitas, Y contactos. Con Plus…» | Mejorar |
| 10 | Baja | «¿Pausar 1 mes al 50 % en vez de cancelar?» | Pausar / Bajar de plan |

Principios de UI que ya están aplicados:

- **El plan siempre visible** en el panel (franja + pestaña «Mi plan»).
- **Uso, no promesas**: “4 de 5 anuncios”, no “hasta 5”.
- **Cuenta atrás real** de la prueba.
- **Precio por anuncio** al lado del precio del pack.
- **Recomendación según stock** (1–4 / 5–15 / 16+), no tres columnas idénticas.
- **Anual con ahorro explícito** («2 meses gratis»).
- **Garantías visibles**: sin permanencia, cancela en 2 clics, factura con
  NIF/CIF.
- **Una sola llamada a la acción por tarjeta**, con el pack actual deshabilitado.

---

## 6. Qué se ha implementado en esta rama

### 6.1 Precios y Stripe

- `src/lib/planes-anuncios.ts`: `precioAnual`, `Periodicidad`,
  `precioPlan()`, `precioMensualEquivalente()`, `descuentoAnualPct()`,
  `planRecomendado()`, `diasRestantesTrial()`, `etiquetaPlan()`, `PLAN_GRATIS`.
- `src/lib/stripe-precios.ts`: productos/precios estables con `lookup_key`
  (`camperocasion_<plan>_<mensual|anual>`). Se crean una vez y se reutilizan.
- `api/planes/checkout`:
  - precio calculado en servidor;
  - anual o mensual;
  - reutiliza `stripe_customer_id`;
  - alta nueva o **cambio de pack sobre la suscripción existente** (prorrateo),
    nunca dos suscripciones;
  - `tax_id_collection` para NIF/CIF;
  - solo tarjeta en recurrente (Bizum no lo soporta);
  - metadata `activar_profesional=1`;
  - 409 claro si ya tienes ese pack.
- `api/stripe/webhook`: al activar un pack, un particular pasa a profesional;
  `invoice.paid` renueva `plan_hasta` en cada periodo y `invoice.payment_failed`
  no corta el acceso de inmediato.
- `api/planes/portal`: portal de cliente de Stripe.
- `api/planes/estado`: plan, cupo, prueba, créditos y si se puede gestionar.

### 6.2 Página de precios

`/para-profesionales` se ha reescrito:

- Hero con la propuesta de valor («sin comisión por venta»).
- Bloque que explica **identidad vs plan vs créditos**.
- Selector de stock (1–4 / 5–15 / 16+) que **recomienda** un pack.
- Toggle mensual/anual con el ahorro real.
- Tres tarjetas + comparativa + garantías + 8 FAQ + JSON-LD (`Product`,
  `FAQPage`).
- Estado del pago (`ok` / `cancelado`), reintentos para esperar al webhook.
- Cupón plegado para no distraer.
- Si eres particular, aviso de que al contratar pasas a profesional.
- Si ya estás suscrito, botón de gestionar y cambio de pack con prorrateo.

### 6.3 Panel

- **Franja «Plan: …»** en todas las pestañas (`PlanBar`), con uso y cuenta
  atrás. Clic → Mi plan.
- **Pestaña «Mi plan»** (`TabPlan`): plan actual, renovación, prueba, cupo con
  barra, fotos, destacados, créditos, upsell contextual y portal.
- Explicación explícita: «Tu tipo de vendedor no es tu plan».

### 6.4 Resto

- **Escaparate**: abrir tienda nueva requiere pack o prueba; las existentes se
  mantienen. `api/tienda` devuelve `requierePlan` y `TabTienda` muestra el
  upsell.
- **Créditos**: venta cruzada al pack en `/creditos` y en la pestaña.
- **Registro**: copy «¿Cómo vas a vender?» + «Es gratis y podrás cambiarlo»;
  «Profesional» en vez de «Pro».
- **Descubrimiento**: enlace en footer y menú móvil.
- **Cupo lleno**: ahora siempre lleva a packs y ofrece «pausar uno», también
  para particulares (ya no se les manda a cambiar el tipo a ciegas).

### 6.5 Verificación

- `npx tsc --noEmit`: sin errores.
- `npm test`: **667 tests OK** (8 nuevos de precios/recomendación/prueba).
- `npm run build`: OK.
- La **fase 1** no necesitó migración: usa columnas existentes
  (`plan_anuncios`, `plan_hasta`, `tipo_vendedor`, `credito_balance`).
- La **fase 2** sí: `supabase/migrations/202610220001_planes_prueba_gracia_dunning.sql`
  (fechas de prueba, `pago_pendiente_desde`, `pausado_por_plan`, `plan_avisos`
  y la función `aplicar_cupo_planes()`).

---

## 7. Lo que tienes que decidir / hacer tú

### Esta semana (P0)

1. **Customer Portal**: activarlo no basta; hay que configurar la
   configuración por defecto (Stripe → Settings → Billing → Customer portal):
   - datos del negocio (nombre, dirección, email de soporte, condiciones y
     privacidad): es obligatorio para la UE;
   - funciones activas: actualizar método de pago, historial de facturas,
     cancelación **al final del periodo**, dirección y NIF;
   - **no** actives «cambiar de plan» en el portal salvo que quieras que el
     cambio se haga allí: nuestro checkout aplica prorrateo y actualiza el
     metadata. El webhook ya deduce el plan del `lookup_key` si falta, así que
     no rompería nada, pero el flujo de upsell se pierde.
   - El botón «Gestionar suscripción» (`POST /api/planes/portal`) usa la
     configuración por defecto; no hace falta crear una `configuration` aparte.
2. **Probar el flujo completo en modo test** (`sk_test_…`, tarjeta
   `4242 4242 4242 4242`):
   - contratar Starter mensual → webhook → plan activo;
   - contratar anual → precio 90 €;
   - cambiar a Plus → una sola suscripción, prorrateo;
   - abrir portal → cancelar → seguir activo hasta fin de periodo;
   - comprar créditos → saldo una sola vez.
3. **Comprobar el webhook**: eventos `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
4. **Abuelo de tiendas**: significa que las tiendas ya publicadas antes del
   cambio siguen gratis; solo las nuevas necesitan pack o prueba. Ya está
   implementado y no hay que hacer nada. Si algún día quieres avisar del
   cambio, hay 30 días de gracia en el código.
5. **IVA incluido**: decidido. 9/19/39 € son precio final. `stripe-precios.ts`
   crea los nuevos precios con `tax_behavior: 'inclusive'` y corrige los
   existentes; los créditos usan el mismo criterio. No actives Stripe Tax
   salvo que vendas a empresas de otros países con NIF intracomunitario.

### Fase 2 — implementada el 2026-10-22

6. **Prueba por usuario con fecha real**: `perfiles.trial_iniciado_en`,
   `trial_hasta` y `trial_plan`. El alta como profesional arranca la prueba
   (trigger SQL); un particular puede empezar Plus desde la página de precios
   o el panel (`POST /api/planes/prueba`) y se le promociona a profesional.
   Apagar el interruptor global no corta las pruebas en curso; solo impide
   conceder nuevas. Los profesionales anteriores a la migración se rellenan
   respetando su antigüedad.
7. **Avisos de prueba**: cron diario `/api/cron/planes` a las 09:10 UTC, con
   email y push a 10, 3 y 1 días; al terminar, aviso de los 7 días de gracia y
   del último día. `plan_avisos` (clave única por usuario y aviso) hace que no
   se dupliquen aunque el cron corra dos veces.
8. **Gracia de 7 días**: el plan sigue siendo Plus (`planEfectivo`) sin cobrar.
   Al terminar, `aplicar_cupo_planes()` pausa los anuncios que exceden el cupo:
   no borra nada, conserva primero destacados y los de más visitas, y los marca
   con `pausado_por_plan`. Se reactivan solos al ampliar el pack o con el botón
   «Reactivar los que quepan» (`POST /api/productos/reactivar-pausados`).
9. **Dunning**: `invoice.payment_failed` marca `pago_pendiente_desde` y envía
   el primer email en el momento; el cron recuerda a los 3 y 7 días.
   `invoice.paid` limpia la marca. Nunca se corta el acceso en el instante del
   fallo: manda `plan_hasta`. `customer.subscription.deleted` sí baja a gratis.
10. **Bloqueo de reactivación fuera de cupo**: reactivar un anuncio desde el
    panel (o republicar un vendido) comprueba el cupo en el servidor y
    devuelve `403 codigo:'CUPO'` si no cabe. Sin esto, la pausa por cupo se
    saltaba en dos clics.

### Fase 3 — implementada el 2026-10-22

11. ✅ **Cliente Stripe único en créditos**: `POST /api/stripe/checkout` reutiliza
    `stripe_customer_id` (y lo guarda si Stripe crea uno al vuelo, también desde
    el webhook). Las compras de créditos y la suscripción salen en la misma
    ficha del portal, sin clientes duplicados.
12. ✅ **Pack de 2 créditos / 1 € retirado**: el catálogo es 15/5 €, 40/10 € y
    100/20 €. El primero es ahora el «más popular».
13. ✅ **Win-back**: una semana después de perder el cupo (fin de la gracia de la
    prueba o baja confirmada en Stripe) se manda email + push con el estado real
    —anuncios guardados, cupo recuperable, sin permanencia— y un CTA a packs.
    Idempotente (`winback:<fecha>` en `plan_avisos`) y con ventana de 30 días
    para no enviar correos masivos la primera vez. Si `WINBACK_CUPON` está
    configurado, el email muestra el código.
14. ✅ **Resumen de plan en `/publicar`**: quien publica ve su pack, los días que
    quedan, la fecha de fin de la prueba y de la gracia, y qué pasa después, en
    el mismo formulario donde topa con el cupo.
15. ✅ **Email de soporte único**: `soporte@camperocasion.online` en el
    formulario, la FAQ, el pie de todos los emails y los mensajes de error.

### 1–2 meses (P2)

16. **Diferenciación real de packs** (lo que justifica subir de Starter a
    Plus/Flota y aún no existe):
    - importación CSV/XML de stock y sincronización con DMS;
    - varios usuarios por cuenta (comerciales);
    - estadísticas avanzadas: contactos, tiempo de venta, comparativa de
      mercado;
    - publicación automática en Instagram/Facebook;
    - generador de ficha con IA a partir de fotos.
17. **Cambio de plan desde el portal** (configurar planes en Stripe) o
    mantener el cambio actual con prorrateo.
18. **Stripe Tax** si se factura a empresas fuera de España.
19. **A/B tests**: precio Starter 9 vs 12; anual por defecto vs mensual;
    copy «sin comisión» vs «publica todo tu stock».
20. **Win-back con oferta**: pausa 1 mes al 50 % o downgrade guiado en el
    portal, conectado a `WINBACK_CUPON`.

---

## 8. Métricas que hay que mirar

| Métrica | Por qué | Objetivo inicial |
|---|---|---|
| Visitas a `/para-profesionales` | ¿Se descubre la oferta? | > 15 % de pros activos/mes |
| Inicio de checkout / visita | ¿La página convence? | > 8 % |
| Pago completado / inicio | ¿Stripe y el precio están bien? | > 60 % |
| Prueba → pago | Salud del onboarding | 15–25 % |
| Gratis → Starter | Valor del escaparate/cupo | 3–5 % de pros activos |
| Churn mensual de packs | Precio y valor | < 5 % |
| Starter → Plus | Diferenciación real | > 10 % en 6 meses |
| Attach de créditos | Venta cruzada | > 20 % de pros |
| Tiempo hasta el primer anuncio | Registro y publicación | < 10 min |

Instrumentación: hoy hay eventos de analítica, pero **no hay un embudo de
monetización**. Añadir eventos `pricing_view`, `checkout_start`,
`checkout_success`, `trial_banner_click`, `quota_paywall_view` y
`portal_open`. Sin eso, los A/B tests son a ciegas.

---

## 9. Riesgos y decisiones delicadas

- **Cambiar el escaparate a pago** puede enfadar a quien ya lo usaba gratis.
  Mitigado con abuelo. Si se quiere suavizar: 30 días de gracia y email
  explicando el cambio.
- **Promover a profesional al pagar** cambia el sello del vendedor. Es lo
  correcto para que reciba el cupo, pero conviene avisarlo en la página y en
  el email de bienvenida.
- **Precios anuales**: suponen caja por adelantado y menos churn, pero más
  obligación de devolución si se cancela. Deja claro que no hay reembolso
  prorrateado salvo lo que exija la ley.
- **Bizum**: no se puede usar en suscripciones. Si el público lo pide, la
  alternativa es domiciliación SEPA (Stripe la soporta para suscripciones).
- **La prueba global** podía cortar a usuarios a mitad. Resuelto en fase 2:
  las fechas se guardan por perfil, la migración respeta la antigüedad de quien
  ya estaba dentro y apagar el interruptor solo impide conceder pruebas nuevas.
- **Pausa de anuncios heredados**: al aplicar la migración, la primera pasada
  del cron pausará los anuncios que excedan el cupo también a cuentas antiguas.
  No borra nada y se reactivan al ampliar el pack. Antes de aplicarla, revisa la
  consulta de vista previa de `docs/PLANES-ANUNCIOS.md`.

---

## 10. Una frase para la home / registro

> «Publicar tu camper es gratis. Si eres taller o compraventa, elige un pack
> para tener todo tu stock, escaparate propio y destacados incluidos. Sin
> comisión por venta.»

Es la misma promesa que la página de precios, dicha antes de que el usuario
tenga que decidir nada.
