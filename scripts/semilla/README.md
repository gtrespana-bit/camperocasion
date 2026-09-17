# Semilla de anuncios — scripts/semilla/

Rellena el marketplace con **20 anuncios completos y realistas** de campers y
autocaravanas de ocasión en España (gran volumen, mediana, mini, perfilada,
capuchina, integral y 4x4 overland), para que el sitio no se vea vacío en
desarrollo y demos.

## ⭐ Opción A — desde el navegador (sin instalar nada)

La misma semilla está disponible como endpoint admin dentro de la propia web
(el código vive en `src/app/api/admin/semilla/route.ts` y la
`SUPABASE_SERVICE_ROLE_KEY` la toma de las variables de entorno del hosting):

1. Despliega la versión que incluya este commit (merge a `main`).
2. En el navegador, **con tu sesión de administrador iniciada**, abre:
   `https://camperocasion.online/api/admin/semilla`
3. Pulsa **👀 Ver estado** para comprobar qué hay sembrado ya, y luego
   **🌱 Generar 20 anuncios**. Tarda ~1 minuto (sube las fotos al bucket).
4. Abre `/catalogo` y comprueba el resultado.
5. Si quieres rehacerla desde cero: **🧹 Reset**.

Las fotos viajan en el repo (`public/semilla-fotos/`): el endpoint las
descarga de su propio dominio y las sube a Supabase Storage, igual que hace
la app con las fotos de un vendedor real. No las borres de `public/` mientras
quieras poder re-ejecutar la semilla.

## Opción B — desde local (opcional)

Si en algún momento trabajas con el repo clonado:

```bash
# .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY
npm run semilla          # inserta lo que falte (idempotente)
npm run semilla:reset    # borra los anuncios sembrados y repuebla
node scripts/semilla-anuncios.js --dry-run   # plan sin tocar nada
```

## Qué incluye cada anuncio

- Ficha técnica completa (22-24 especificaciones, con las **mismas claves que
  usan el formulario `/publicar` y los filtros del catálogo** → los anuncios
  aparecen al filtrar por DGT, plazas, calefacción, MMA, etc.).
- **3-4 fotos reales** por anuncio, verificadas visualmente y coherentes con
  el vehículo.
- Descripción larga y natural escrita a mano (1200-1500 caracteres), con
  motivo de venta, mantenimiento, equipamiento y pegas.
- Vendedor de demostración con perfil completo (14 perfiles por toda España;
  algunos verificados ✅).
- Fechas, visitas, destacados ⭐, boosts 🚀, reservas 🔒 y badges de
  homologación verificada repartidos como en un marketplace real.

## Detalles

- **Idempotente** en ambos modos: no duplica anuncios (compara título +
  vendedor de la semilla) ni fotos (uploads con `upsert`).
- Los vendedores (`semilla+<slug>@camperocasion.online`) se crean una sola
  vez con email confirmado y contraseña estable; si ya existen se reutilizan.
- Los DATOS viven en `src/lib/semilla-datos.js` (única fuente de verdad,
  compartida por el script local y el endpoint admin). Para editar o añadir
  anuncios, toca ese archivo y vuelve a ejecutar cualquiera de los dos modos.
- Las fotos proceden de búsquedas de imágenes reales (concesionarios,
  portales de ocasión, páginas de camperizadores). Úsalas **solo para la
  semilla de demostración**, nunca como contenido editorial del sitio.
