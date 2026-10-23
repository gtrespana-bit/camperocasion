# Respuesta al aviso de seguridad Node.js / Stripe (octubre 2026)

## Cambios preparados en el repositorio

- `.nvmrc`: Node 24.22.1 para desarrollo y para la plantilla de CI.
- `package.json`: admite `>=24.22.1 <25`; `.npmrc` exige engines compatibles.
  El `engines` de `package.json` **manda sobre el selector de Vercel**: el
  proyecto tenía el dashboard en 22.x y el runtime seguía reportando 22.23.2.
- Comprobación previa a instalación, desarrollo, build (incluidas variantes) y start.
- Plantilla de CI preparada en `docs/ci/ci-node-security.yml`: copiar su contenido
  a `.github/workflows/ci.yml` desde GitHub para activarla. Verifica el runtime
  y los tests de la comprobación antes de instalar. El workflow activo no se ha
  modificado porque la conexión no tiene permiso `workflows`.
- `instrumentation.ts` registra la versión efectiva en logs del servidor Node,
  sin exponer variables de entorno ni crear un endpoint público.

Referencia: https://github.com/nodejs/node/releases/tag/v24.22.1
Aviso del proveedor: https://vercel.com/kb/bulletin/node-js-security-advisory
Este es el mínimo adoptado ante el aviso, no una garantía contra futuros fallos.
Actualizar el paquete `stripe` no sustituye actualizar Node.

## Despliegue: pendiente de ejecutar por el operador

1. Inventariar todos los servicios, máquinas y despliegues (producción y previews)
   que tienen acceso a las claves de la cuenta afectada, no solo este repositorio.
2. Conservar y revisar los logs del proveedor y de Stripe. Si hay indicios de
   compromiso, aislar el servicio y reconstruir desde una base confiable antes
   de introducir credenciales nuevas. No borrar evidencia al «limpiar».
3. En Vercel, `engines.node` de `package.json` prevalece sobre
   Settings → Build and Deployment → Node.js Version. El dashboard solo ofrece
   majors (20.x, 22.x, 24.x) y **Vercel decide el parche**. Por eso este repo
   fija la rama 24 (`>=24.22.1 <25`) y verifica el parche en ejecución.
   Comprobado el 2026-10-23: con el dashboard en 22.x, el runtime seguía en
   **22.23.2** (sin parche) en la región `iad1`.
4. Desplegar los cambios desde una fuente revisada, sin reutilizar la caché de
   build.
5. Preguntar al runtime real, no al build. Abrir con sesión de admin:

   ```
   https://<dominio>/api/diagnostico/runtime
   ```

   o desde terminal (sin pegar el secreto en el historial compartido):

   ```
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/diagnostico/runtime
   ```

   La respuesta trae `runtime.node`, `runtime.cumple`, `runtime.region` y el
   `commit` desplegado. Debe indicar 24.22.1 o un parche posterior de la rama 24
   con `cumple: true`. Si dice `cumple: false`, producción sigue vulnerable:
   redesplegar y, si persiste, escalar al proveedor.

   Vigilancia automática: el cron diario `/api/cron/runtime-check` (08:00 UTC)
   lee la versión del proceso real, guarda el último estado en
   `plataforma_ajustes` (clave `runtime_node`) y avisa por Telegram
   (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) **solo cuando cambia algo**:
   cuando por fin alcanza el mínimo, cuando aparece otra versión aún vulnerable
   o cuando hay una regresión. Sin Telegram configurado no falla: responde con
   `avisado: false`.

   Como comprobación secundaria, `instrumentation.ts` escribe `[runtime] Node.js ...`
   en los logs de función al arrancar cada instancia (solo en logs de ejecución,
   no en los de build). Es fácil que esa línea se pierda entre peticiones; el
   endpoint es la fuente fiable.
   Si producción sigue vulnerable, no considerar el incidente resuelto: solicitar
   actualización al proveedor y restringir/suspender el servicio afectado según
   el riesgo hasta disponer de un runtime parcheado. El build falla (`.npmrc`
   tiene `engine-strict=true`) si el runtime no cumple el mínimo: es preferible
   un despliegue detenido a uno vulnerable.
6. Retirar o proteger despliegues antiguos accesibles que conserven runtimes
   vulnerables. No hacer rollback a un despliegue vulnerable.

## Exposición concreta de esta aplicación (revisado 2026-10-23)

CVE-2026-111497 se explota decodificando Brotli controlado por un atacante.
Vercel aplica reglas WAF a todo el tráfico entrante, pero **no cubre las
respuestas que la función descarga de otros servidores**. En este código:

- Optimizador de imágenes: solo Supabase Storage y los dos hosts de R2
  (`next.config.js`); no acepta hosts arbitrarios.
- `/api/admin/comprobante`: exige host de Supabase, carpeta `comprobantes` y
  sesión de admin.
- `/api/notify` y el resto de llamadas salientes: URL fija a Telegram.

No hay ningún punto donde se descomprima Brotli controlado por un tercero, así
que el vector remoto de la aplicación está cerrado por diseño mientras se
completa el parche del runtime.

## Si Vercel sigue sirviendo un runtime sin parchear

Comprobado el 2026-10-23, tras dos redespliegues sin caché y con `engines.node`
a `>=24.22.1 <25`:

| Fecha | Runtime reportado |
|---|---|
| 2026-10-23 22:08 | 22.23.2 (`iad1`) |
| 2026-10-23 22:33 | 24.21.0 (`iad1`) |
| 2026-10-23 22:4x | 24.21.0 (`iad1`, redeploy manual) |

El build sí cumple el mínimo: con `engine-strict=true`, un build por debajo de
24.22.1 habría fallado. Lo que queda desactualizado es la imagen de las
funciones, que Vercel gestiona por su cuenta y va rotando de forma gradual.

No hay ajuste en el repositorio que lo resuelva: `engines.node` fija la rama y
el selector del dashboard solo ofrece majors. Mientras se resuelve:

- El WAF de Vercel bloquea el vector de entrada del CVE desde el 21 de octubre.
- La aplicación no decodifica Brotli de terceros (ver la sección de exposición).
- Rotar la clave de Stripe **después** de que el runtime cumpla, no antes.
- Escalar a Vercel con el commit, la región y la evidencia de la tabla anterior.

## Rotación después de asegurar los entornos

1. Revisar en Stripe los registros de solicitudes, pagos, reembolsos, transferencias,
   cuentas bancarias y cambios de configuración. Conservar evidencia de anomalías.
2. Rotar las claves secretas/restringidas afectadas desde el Dashboard de Stripe.
   Actualizar `STRIPE_SECRET_KEY` en todos los servicios que la utilicen y en los
   ámbitos necesarios de Vercel (Production, Preview y Development). No copiar
   claves a chats, código, capturas, terminales compartidos ni logs.
3. Redesplegar con la nueva clave y revocar la antigua cuanto antes. Minimizar
   cualquier solapamiento; ante abuso activo, priorizar revocación inmediata.
4. Valorar como expuestos los demás secretos accesibles al proceso si hubo
   compromiso. `STRIPE_WEBHOOK_SECRET` es independiente de la clave API: rotarlo
   por separado mediante el procedimiento de Stripe si hay exposición posible,
   coordinando actualización y despliegue para evitar perder eventos.
5. Verificar checkout, recepción de webhooks, procesamiento idempotente y tareas
   programadas. Revisar eventos fallidos y reintentarlos según corresponda.
6. **Si la clave se generó mientras producción seguía en un runtime vulnerable,
   rotarla otra vez** con el entorno ya parcheado. Stripe recomienda limpiar el
   entorno *antes* de generar claves nuevas.
7. Monitorizar actividad tras la rotación y confirmar que las claves antiguas ya
   no funcionan. Registrar versiones efectivas, despliegue, fecha de revocación
   y resultados de las verificaciones, nunca los valores de las claves.

## Desarrollo local

```sh
nvm install
nvm use
npm ci
npm run check:node
node --test tests/node-version.test.cjs
npm test -- --ci
```

Cambiar estos archivos no actualiza automáticamente equipos, despliegues existentes
ni las claves de Stripe. El incidente solo puede cerrarse tras verificar esos pasos.
