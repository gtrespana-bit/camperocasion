# Semilla de anuncios — scripts/semilla/

Rellena el marketplace con **20 anuncios completos y realistas** de campers y
autocaravanas de ocasión en España (gran volumen, mediana, mini, perfilada,
capuchina, integral y 4x4 overland), para que el sitio no se vea vacío en
desarrollo y demos.

Cada anuncio incluye:

- Ficha técnica completa (22-24 especificaciones, con las **mismas claves que
  usan el formulario `/publicar` y los filtros del catálogo** → los anuncios
  aparecen al filtrar por DGT, plazas, calefacción, MMA, etc.).
- **3-4 fotos reales** por anuncio, verificadas visualmente y coherentes con
  el vehículo. Se suben al bucket `productos-fotos` de Supabase Storage
  exactamente igual que las de un vendedor real (así `next/image` las sirve
  sin configuración extra en Vercel).
- Descripción larga y natural escrita a mano (1200-1500 caracteres, ninguna
  genérica), con motivo de venta, mantenimiento, equipamiento y pegas.
- Vendedor de demostración con perfil completo (14 perfiles repartidos por
  toda España; algunos verificados con ✅).
- Fechas, visitas, destacados ⭐, boosts 🚀, reservas 🔒 y badges de
  homologación verificada repartidos como en un marketplace real.

## Uso

```bash
# 1. Claves en .env.local (el mismo que usa npm run dev):
#    NEXT_PUBLIC_SUPABASE_URL=https://hbiywrddxrsidniwxuhe.supabase.co
#    SUPABASE_SERVICE_KEY=...   # Project Settings → API Keys → service_role / sb_secret_...

# 2. Ejecutar (desde la raíz del proyecto):
npm run semilla          # inserta lo que falte (no duplica: salta títulos existentes)
npm run semilla:reset    # borra los anuncios sembrados y los vuelve a insertar

# o directamente:
node scripts/semilla-anuncios.js --dry-run     # muestra el plan sin tocar nada
node scripts/semilla-anuncios.js --reset
```

## Detalles

- **Idempotente**: re-ejecutarlo no duplica anuncios (compara título +
  vendedor de la semilla) ni fotos (uploads con `upsert`).
- Los vendedores se crean una sola vez con email
  `semilla+<slug>@camperocasion.online` (confirmado, no reciben correo) y
  contraseña estable; si ya existen se reutilizan.
- Las fotos están versionadas en este directorio (`fotos/<categoria>/`) para
  que la semilla sea 100% reproducible y offline. Si regeneras la base de
  datos o despliegas en otro proyecto de Supabase, basta con volver a correr
  el script.
- Las fotos proceden de búsquedas de imágenes reales (concesionarios,
  portales de ocasión, páginas de camperizadores). Úsalas **solo para la
  semilla de demostración**, nunca como contenido editorial del sitio.
- ¿Quieres añadir un anuncio más? Edita el array `ANUNCIOS` de
  `scripts/semilla-anuncios.js`, mete las fotos en `fotos/` y vuelve a
  ejecutar `npm run semilla` (solo insertará el nuevo).
