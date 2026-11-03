# Sistema visual: portada y páginas interiores

## Principios

- Paleta de la portada: noche `#0B1120`, pizarra `#0F172A`, verde `#16A34A`, naranja `#EA580C`, fondo claro `#F5F7FA`.
- Titulares: Archivo (variable); texto y controles: Geist. Hero de interior: máximo 6,5 rem, secciones: máximo 3,25 rem. Nunca heredar tamaños monumentales de la portada en columnas estrechas.
- Contenedores: hasta 1360 px, padding horizontal 20–32 px. Fondo claro para lectura y formularios, oscuro para introducción y llamadas a la acción. Etiquetas con contraste suficiente; botones y enlaces con estados de teclado y móviles.
- La portada usa composiciones inmersivas; las pantallas de trabajo (catálogo, producto, publicación, cuenta) conservan navegación, formularios y datos visibles antes que animaciones.
- Componentes: `PublicHero` para introducciones de páginas públicas; `WorkHeader` para encabezados compactos de búsqueda, créditos, panel, edición y páginas de cuenta; `public-shell`, `public-section-title`, `public-card` y `account-card` para ritmo y superficies compartidos. `SiteChrome` distingue portada, interiores y administración sin alterar las herramientas.

## Avance

- [x] Portada y cabecera/pie globales (incluido buscador separado del carrusel).
- [x] Catálogo, ficha de producto (tipografía y superficies), publicación, familias/categorías, landings provinciales, marcas, tiendas.
- [x] Blog (índice y artículos), sobre nosotros, cómo funciona, FAQ, contacto, instalación de app, profesionales.
- [x] Compra segura, ITP, contrato, gestoría, valoración; las 4 páginas legales comparten `DocumentoLegal`.
- [x] Adaptar las páginas de modelo, tienda y vendedor al sistema editorial, conservando sus datos y acciones.
- [x] Adaptar los tres listados por tipo de vendedor mediante su plantilla compartida.
- [x] Encabezados compactos y superficies de trabajo en búsqueda, créditos, dashboard, edición, login, registro, confirmación, recuperación, chat y eliminación de cuenta; shell de administración adaptado sin cambiar sus flujos. La antigua redirección de `/mi-perfil` apunta ahora a la pestaña real `cuenta`.
- [x] Primer pase de traducciones ES/EN en títulos, mensajes de cuenta, búsqueda, navegación/estado de plan en dashboard, estados principales del chat y compra de créditos; formularios de acceso y registro con etiquetas asociadas y recuperación separada del formulario de acceso. Dashboard y página de créditos comparten ahora el mismo modal de pago (incluido Stripe): declara su rol, gestiona foco/Escape, mantiene el idioma tras el checkout y da errores en línea en lugar de alertas. Nunca ofrece un método manual sin datos bancarios reales.
- [x] En móvil el panel de filtros del buscador es desplegable (sin tapar los resultados) y conserva sus controles; las etiquetas principales y metadata de búsqueda se traducen.
- [x] Landings de ciudad y ciudad/tipo, y páginas de modelo: estadísticas y preguntas con datos reales en español; contenido legible en inglés sin mezclar párrafos SEO españoles. Navegación global de familias traducida sin alterar los filtros de URL; páginas inglesas dinámicas con metadata localizada y noindex conforme a la configuración del sitio.
- [x] Estados 404, error general, error de ficha y ficha sin producto alineados con el sistema visual; los errores inesperados no enseñan mensajes internos del servidor.
- [ ] Revisar todas las combinaciones de filtros del buscador avanzado y estados excepcionales de fichas con contenido real.
- [x] Calculadora de ITP y landings autonómicas con interfaz, explicaciones de cálculo, FAQ visibles y estructuradas, checklists y metadata inglesa localizadas. El motor de cifras queda intacto: las advertencias EN se derivan de sus reglas y se comprueba la paridad en una matriz de combinaciones; los apuntes regulatorios originales de cada comunidad siguen disponibles en español bajo un desplegable claramente rotulado. Plazo de dos meses expresado como meses (no como 60 días naturales) en Andalucía y Navarra.
- [x] Página para profesionales y flujo cliente de contratación: contenido ES/EN, comparación y FAQ/JSON-LD localizados, checkout y portal de Stripe con retorno al idioma del usuario, y confirmación pendiente hasta que el plan esté activo de verdad. Corregidas promesas inconsistentes de fotos y del efecto de bajar el cupo.
- [x] Directorio de tiendas y marcas/modelos con interfaz, FAQ visibles/estructuradas y metadata localizada. Los slugs y filtros de catálogo conservan sus valores originales; las descripciones editoriales de modelos que solo existen en español no se muestran erróneamente como texto traducido.
- [ ] Completar los demás textos todavía escritos directamente en español en rutas inglesas (algunas pestañas del panel, administración y otros recorridos autenticados); revisar también metadata de páginas dinámicas. La portada, compra de créditos, landings de ciudad/categoría, modelos, ITP, planes profesionales, tiendas y marcas ya tienen metadata inglesa y `noindex` mientras se completa el contenido y la revisión SEO. Antes de tomar decisiones tributarias hay que contrastar cada regla con la fuente oficial.
- [ ] Validar visualmente página por página en viewport móvil/tablet/escritorio con contenido real y con sesión autenticada, incluyendo estados vacío, error, carga y éxito; la comprobación HTTP no equivale a esta prueba.

## Verificaciones automáticas

- Última comprobación (Node 24): TypeScript, ESLint de archivos TS/TSX modificados sin avisos, `git diff --check`, 79 suites / 820 tests, diccionarios ES/EN con 1475 claves iguales y build Next de 384 páginas correctos. Smoke HTTP ES/EN de portada, créditos, modelos, ciudad/categoría, ITP, profesionales, tiendas y marcas: 200; producto inexistente: 404. La vista previa de Next necesitó limpiar `.next/dev` tras el build para recuperar las rutas dinámicas (caché de desarrollo, no código de aplicación).
- Smoke HTTP ES/EN en rutas de cuenta, búsqueda, créditos y landings de ciudad/categoría e ITP; semántica HTML revisada en rutas accesibles sin autenticación.
- La comprobación visual automatizada con Chromium queda bloqueada en este entorno por bibliotecas de sistema ausentes (`libnspr4.so`, `libnss3.so`, `libnssutil3.so`). No marcar la revisión responsive como hecha.

**Criterio de cierre:** una página no se marca como terminada solo por compartir colores; hay que revisar su jerarquía, densidad, estados y acciones en móvil y escritorio.
