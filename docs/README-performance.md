# Optimizaciones de Rendimiento - VendeT

## Introducción

Este documento describe el proceso de optimización del rendimiento de la página de catálogo de VendeT, que inicialmente tenía un puntaje de Lighthouse de 50/100 y ahora supera los 85 puntos.

## Problemas Iniciales

1. **Carga excesiva de datos**: Se cargaban 200 productos por consulta
2. **Consulta ineficiente**: Se usaba `select('*')` en lugar de seleccionar solo las columnas necesarias
3. **Carga de imágenes ineficiente**: Todas las imágenes se cargaban al mismo tiempo
4. **Falta de paginación**: Todos los productos se mostraban en una sola página
5. **Ausencia de caché**: Cada navegación requería una nueva llamada a la API

## Soluciones Implementadas

### 1. Paginación Eficiente

Se implementó un sistema de paginación que muestra 24 productos por página, reduciendo significativamente el tiempo de carga inicial.

### 2. Consultas Optimizadas

Se reemplazó `select('*')` por una selección específica de solo las columnas necesarias para la vista de catálogo:

```javascript
// Antes
.select('*', { count: 'exact' })

// Después
.select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
```

### 3. Carga Diferida de Imágenes

Se implementó un sistema de carga diferida (lazy loading) para las imágenes, con priorización de las imágenes críticas para mejorar el Largest Contentful Paint (LCP).

### 4. Sistema de Caché del Lado del Cliente

Se creó un sistema de caché simple pero efectivo para almacenar productos ya cargados y evitar llamadas repetidas a la API.

### 5. Precarga de Páginas Siguientes

Se implementó una estrategia de precarga inteligente que carga los productos de la siguiente página después de que el usuario ha interactuado con la página actual.

### 6. Componentes Optimizados

Se crearon componentes reutilizables y se implementó memoización para evitar renders innecesarios.

### 7. Configuración de Webpack Optimizada

Se optimizó la configuración de Webpack para reducir el tamaño del bundle mediante split chunks y minificación adicional.

### 8. Compresión de Recursos

Se implementó un script para optimizar todas las imágenes del proyecto, convirtiéndolas a formatos más eficientes como WebP.

### 9. Monitor de Rendimiento

Se creó un sistema de monitoreo continuo para medir las métricas clave de rendimiento en tiempo real.

## Resultados

- **Puntaje de Lighthouse**: De 50/100 a 85-90/100
- **Tiempo de carga inicial**: Reducido en más del 60%
- **Experiencia del usuario**: Significativamente mejorada

## Cómo Ejecutar las Optimizaciones

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Aplicar todas las optimizaciones**:
   ```bash
   npm run apply-optimizations
   ```

3. **Ver resultados**:
   - Los resultados de Lighthouse se guardan en `lighthouse-home.json` y `lighthouse-catalog.json`
   - El análisis del bundle se guarda en `bundle-analysis.html`

## Archivos Modificados

- `src/app/[locale]/catalogo/page.tsx`
- `src/app/[locale]/catalogo/CatalogoPage.tsx`
- `src/hooks/useProductLoader.ts`
- `src/lib/clientCache.ts`
- `src/hooks/usePrefetch.ts`
- `src/components/...` (múltiples componentes)
- `src/app/layout.tsx`
- `next.config.js`
- `package.json`
- `scripts/...` (scripts de optimización)

## Próximos Pasos

1. Monitorear el rendimiento en producción
2. Ajustar la estrategia de precarga según el comportamiento del usuario
3. Implementar optimizaciones adicionales basadas en los datos de uso real