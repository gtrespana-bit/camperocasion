# Respuesta al aviso de seguridad Node.js / Stripe (octubre 2026)

## Cambios preparados en el repositorio

- `.nvmrc`: Node 22.23.4 para desarrollo y para la plantilla de CI.
- `package.json`: admite `>=22.23.4 <23`; `.npmrc` exige engines compatibles.
- Comprobación previa a instalación, desarrollo, build (incluidas variantes) y start.
- Plantilla de CI preparada en `docs/ci/ci-node-security.yml`: copiar su contenido
  a `.github/workflows/ci.yml` desde GitHub para activarla. Verifica el runtime
  y los tests de la comprobación antes de instalar. El workflow activo no se ha
  modificado porque la conexión no tiene permiso `workflows`.
- `instrumentation.ts` registra la versión efectiva en logs del servidor Node,
  sin exponer variables de entorno ni crear un endpoint público.

Referencia: https://github.com/nodejs/node/releases/tag/v22.23.4
Este es el mínimo adoptado ante el aviso, no una garantía contra futuros fallos.
Actualizar el paquete `stripe` no sustituye actualizar Node.

## Despliegue: pendiente de ejecutar por el operador

1. Inventariar todos los servicios, máquinas y despliegues (producción y previews)
   que tienen acceso a las claves de la cuenta afectada, no solo este repositorio.
2. Conservar y revisar los logs del proveedor y de Stripe. Si hay indicios de
   compromiso, aislar el servicio y reconstruir desde una base confiable antes
   de introducir credenciales nuevas. No borrar evidencia al «limpiar».
3. En Vercel, revisar Settings → Build and Deployment → Node.js Version y usar
   la rama 22.x. Vercel controla el parche efectivo: seleccionar 22.x no prueba
   que ya esté parcheado. Confirmar con el proveedor si es necesario.
4. Desplegar los cambios desde una fuente revisada, sin reutilizar la caché de
   build. El build debe mostrar Node 22.23.4 o un parche posterior de la rama 22.
5. Preguntar al runtime real, no al build. Abrir con sesión de admin:

   ```
   https://<dominio>/api/diagnostico/runtime
   ```

   o desde terminal (sin pegar el secreto en el historial compartido):

   ```
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/diagnostico/runtime
   ```

   La respuesta trae `runtime.node`, `runtime.cumple`, `runtime.region` y el
   `commit` desplegado. Debe indicar 22.23.4 o un parche posterior de la rama 22
   con `cumple: true`. Si dice `cumple: false`, producción sigue vulnerable:
   redesplegar y, si persiste, escalar al proveedor.

   Como comprobación secundaria, `instrumentation.ts` escribe `[runtime] Node.js ...`
   en los logs de función al arrancar cada instancia (solo en logs de ejecución,
   no en los de build). Es fácil que esa línea se pierda entre peticiones; el
   endpoint es la fuente fiable.
   Si producción sigue vulnerable, no considerar el incidente resuelto: solicitar
   actualización al proveedor y restringir/suspender el servicio afectado según
   el riesgo hasta disponer de un runtime parcheado.
6. Retirar o proteger despliegues antiguos accesibles que conserven runtimes
   vulnerables. No hacer rollback a un despliegue vulnerable.

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
6. Monitorizar actividad tras la rotación y confirmar que las claves antiguas ya
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
