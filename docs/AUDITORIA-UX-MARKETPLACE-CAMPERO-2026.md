# Auditoría UX y dirección de diseño · CamperOcasión

**Fecha:** 3 de noviembre de 2026. **Objeto:** marketplace español de vehículos camper de ocasión, con vendedores particulares y profesionales; compra/contacto, publicación, herramientas y suscripción. **No es** una tienda de bienes de consumo con carrito: sus compradores comparan vehículos caros, inspeccionan documentación y acuerdan con un tercero; la conversión principal es un contacto cualificado, no un clic en «comprar».

## Alcance y cautelas

Análisis de código, componentes, CSS, contenido y recorridos disponibles, apoyado por investigación publicada de NN/g, Baymard, W3C y Google. Las conclusiones específicas de CamperOcasión son **hipótesis de producto** hasta probarlas con visitantes y anuncios reales. No se ha hecho estudio con usuarios, comparativa de conversión A/B, validación visual automatizada ni pago real. El navegador de pruebas de este entorno no inicia por bibliotecas compartidas ausentes; el HTTP, los tests y el build no acreditan calidad visual ni usabilidad responsive.

No generalizar recomendaciones de ecommerce: en un vehículo usado importan historial, kilometraje, homologación, equipamiento, estado, fotos reales, ubicación y condiciones de inspección más que «variantes de color» o valoraciones de un SKU. Tampoco inventar reseñas, señales de verificación, urgencia ni garantías.

## Diagnóstico: por qué resultaba saturada

| Hallazgo comprobable en código antes de esta pasada | Efecto probable | Decisión |
| --- | --- | --- |
| `globals.css`: hero de portada hasta **9,5 rem**, múltiples secciones hasta **6 rem**, CTA hasta **9 rem**, titulares de interiores hasta **6,5 rem**. `BigMarquee.tsx`: dos filas de texto de hasta **22 rem**. | La escala deja de indicar prioridad: todo reclama atención, reduce legibilidad y desplaza el contenido útil. | Reservar fuerza tipográfica para el hero; H1 interior hasta 4,1 rem, H2 interior hasta 2,6 rem, secciones de portada hasta 3,8 rem; reemplazar la doble marquesina monumental. **Aplicado.** |
| `page.tsx`: primero hero, buscador, fabricantes, manifiesto y tres familias. `RoutePanels.tsx`: **tres paneles sticky de 100svh**; `Gallery.tsx`: galería horizontal fijada por scroll vertical. | Un comprador tarda varios desplazamientos en ver vehículos y el scroll deja de responder como espera. | Poner anuncios tras el buscador/fabricantes; tarjetas de familias comparables, cuadrícula de anuncios en desktop y carril nativo en móvil. Sin pantallas fijadas. **Aplicado.** |
| `Preloader.tsx`: cortina de ~1,7 s en primera visita; `SmoothScroll.tsx`: inercia del desplazamiento. `HeroGL.tsx`: textura y canvas animado incluso en puntero táctil. | Añade espera y carga al primer contacto antes de demostrar valor; animación no equivale a velocidad percibida. | Quitar cortina e inercia; fotografía real desde HTML; WebGL sólo con puntero fino y sin preferencia de movimiento reducido. Medir LCP/INP en producción antes de atribuir mejoras. **Aplicado.** |
| Texto todo en mayúsculas, condensado y delineado en varios niveles. | La identidad pierde contraste de roles: la forma compite con información y precio. | Caja natural y relleno legible para títulos informativos, con escala y espaciado consistentes; conservar tipografía característica en hero, cifras y acentos. **Aplicado.** |

**Dirección visual:** «editorial especializado + herramienta fiable», no landing promocional interminable ni plantilla genérica. Fotografía auténtica y grande donde aporta información; líneas finas y superficies claras para comparar; una sola acción dominante por contexto; color verde para acción y estados confirmados, naranja como acento excepcional, no como alarma decorativa. El título informa, la foto demuestra, el dato ayuda a decidir, la acción cierra el paso. Evitar tarjetas con más insignias que contenido.

### Sistema propuesto de jerarquía

- Primer pantallazo: categoría/valor en una frase, buscador con campos comprensibles, acción «ver vehículos» claramente superior a «publicar» para visitantes compradores. La segunda ruta de vendedor sigue visible.
- H1 de portada con carácter (máximo 7 rem desktop, hasta 4,25 rem móvil); H1 de interiores 2–4,1 rem; H2 de secciones 1,65–2,6 rem en interiores; texto corriente 16–18 px y lectura larga con ancho razonable. No agrandar títulos para compensar la ausencia de contenido real.
- Mayúsculas y tracking solo en etiquetas cortas; titulares corrientes en caja natural. Separación entre grupos, no grandes huecos repetidos dentro de un grupo. Leyenda y CTA junto a su contenido, no alejadas por efectos de scroll.
- Un titular expresivo por pantalla, no un «grito» nuevo en cada sección. Mantener contrastes y foco visibles; comprobar al 200 % de zoom, 320/360 px y traducciones EN más largas.

## Recorrido comprador: prioridades

| Prioridad | Diagnóstico del producto actual | Corrección / prueba de aceptación |
| --- | --- | --- |
| **Decisión de producto: diferida** | `page.tsx` incluye anuncios sembrados para dar densidad inicial; `ProductoPageClient.tsx` no ofrece teléfonos inventados ni pagos en ellos. | El propietario solicita **mantener por ahora ese efecto de catálogo con contenido**. No cambiar la selección, presentación ni cifras de los anuncios demo en esta fase. Revisar su tratamiento solo cuando se decida hacerlo, antes de afirmar que son inventario real verificado. |
| **P1 — búsqueda y resultado** | Buscador y filtros técnicos relevantes, pero antes el vacío de resultados proponía «publicar» a quien estaba comprando. | **Aplicado:** chips de condiciones activas (incluidos rangos), retirada individual sin perder otros filtros y limpieza general; vacío filtrado con acción para ampliar la búsqueda. Sin filtros, se conserva el CTA de publicar. Pendiente la prueba final con catálogo y personas reales. |
| **P1 — ficha móvil** | Antes, la descripción larga y ficha técnica aparecían visualmente antes del precio/contacto. | **Aplicado:** después de galería y título aparecen precio, vendedor y métodos configurados; descripción, extras y herramientas siguen disponibles sin duplicar controles. En desktop se conserva la columna lateral. Revisar en las pruebas finales el orden de lectura asistiva y los estados real, vendido, reservado, sin fotos y demo. |
| **P1 — comparación y prueba** | Ficha técnica, documentación/homologación y calculadora ITP ya existen; los datos pueden faltar o estar pendientes. | Un patrón uniforme para todos los anuncios: foto frontal/interior/detalle si existen, precio, lugar, km/año/plazas cuando consten, vendedor, documentación con estado real y pregunta/contacto. «No facilitado» debe ser distinto de «verificado». Nunca insinuar garantía por una simple etiqueta. |
| **P2 — confianza sostenida** | Existen perfiles, insignias y consejos, pero la confianza depende de la experiencia real. | Hacer encontrables identidad y contacto del equipo, qué significa cada insignia, cómo denunciar un anuncio, costes reales e información sobre inspección/contrato. Moderación y respuesta a incidencias, no solo elementos visuales. |

## Recorrido vendedor y profesionales

1. **Promesa comprobable:** visibilidad, límite gratuito de 1 anuncio/10 fotos, Profesional de 15 anuncios/20 fotos/5 destacados, precios y permanencia claros. Los números deben salir de `PLAN_GRATIS`/`PLANES_PRO`, no de un diseño que pueda quedar obsoleto.
2. **Publicar:** medir pasos, abandono por campo y error, tiempo hasta foto/publicación, carga móvil, vuelta tras inicio de sesión, edición y estados de moderación. Ayuda contextual junto a documentación e imágenes; no una landing larga antes del formulario.
3. **Después de publicar:** estado real («pendiente», «publicado», «vendido»), compartir, editar, responder mensajes y ver estadísticas interpretables. No prometer interacción o ventas.
4. **Plan y créditos:** separar identidad de vendedor, plan recurrente y créditos puntuales. Confirmar el pago solo con estado real del servidor/webhook, explicar renovación, cancelación y qué ocurre al bajar el cupo; validar Stripe sandbox y cuenta real antes de lanzar.

## Riesgos de SEO, accesibilidad y rendimiento

- **SEO y contenido:** páginas de ciudad/modelo/marca útiles si contienen inventario y datos únicos; evitar texto o metadatos inflados sin disponibilidad real. El inglés permanece `noindex` mientras falte localización y revisión. Google recomienda navegación enlazable de categorías a productos y contenido útil para personas; el buscador por sí solo no sustituye los enlaces rastreables. `page.tsx` asigna en su ItemList `seller: Organization CamperOcasión` a ofertas de terceros: revisar si representa fielmente al vendedor real; evitar dato estructurado que sugiera venta directa por la plataforma.
- **Accesibilidad:** WCAG 2.2 AA exige 4,5:1 para texto normal, 3:1 para texto grande, zoom de texto al 200 % sin pérdida de contenido y objetivos de puntero de 24×24 px salvo excepciones. Comprobar contrastes sobre cada fotografía/gradiente, teclado, foco, `prefers-reduced-motion` y menús móviles. Se elevó el contraste de las marcas en la cinta; falta auditoría visual y automática real.
- **Rendimiento:** hero usa imagen optimizada, pero también canvas WebGL, animación tipográfica y recursos de galería. Medir LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1 al percentil 75 por móvil/escritorio; son objetivos de Google, **no resultados observados del sitio**. `WebVitalsReporter.tsx` y Speed Insights existen, pero comprobar que el endpoint acepte/guarde las métricas y que INP/CLS se calculen con metodología comparable antes de informar cifras. Limitar JS e imágenes bajo el pliegue.

## Métricas que permitirán saber si mejora (sin inventar un «éxito»)

Instrumentar un embudo anónimo y compatible con consentimiento: visita → búsqueda → vista de lista → apertura de ficha real → contacto cualificado; para venta: inicio de publicación → fotos → envío → aprobación → primera respuesta; para planes: ver plan → checkout → confirmación real → cancelación. Separar móvil/escritorio, ES/EN, fuente y oferta real vs demo; sin registrar consultas sensibles ni datos personales en eventos. Medir resultados útiles (contactos respondidos, publicaciones completas, inventario real fresco, repetición/retención, incidencias y tiempos de respuesta), no solo clics o visitas. Baseline primero; cambio después; decidir con pruebas cualitativas y si hay tráfico suficiente, experimento A/B.

## Plan de validación en orden

1. **Diseño ahora:** ordenar tarjetas de familias a igual nivel, priorizar precio/contacto en móvil y permitir recuperar búsquedas vacías, manteniendo los anuncios de demostración según la decisión actual del propietario.
2. **Pruebas al final, como pide el propietario:** pruebas observadas con compradores y vendedores de perfiles distintos (por ejemplo 6–8 por grupo inicial; número orientativo, no sustituto de saturación): encontrar vehículo < presupuesto en una provincia, comparar homologación/ITP, preguntar al vendedor, publicar desde móvil y volver tras login, cancelar plan. Registrar éxito, tiempo, errores y frases del usuario; no dirigirles.
3. Matriz por viewport 360, 768 y 1440 px; zoom 200 %, teclado, lector de pantalla, movimiento reducido, red lenta; estados cargando/vacío/error/éxito; contenidos ES/EN y sesión autenticada. Capturas y revisión visual manual pendientes en este entorno.
4. Medición real en producción de Core Web Vitals, puntos de abandono y calidad de los contactos antes/después. No publicar nuevas promesas de confianza, garantía o fiscalidad sin respaldo operacional o legal.

## Referencias externas y transferencia al caso

- NN/g, **Visual Hierarchy in UX**: contraste y escala solo cuando distinguen prioridades: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- NN/g, **Why Does a Design Look Good?**: sistema tipográfico, alineación y ritmo consistentes: https://www.nngroup.com/articles/why-does-design-look-good/
- NN/g, **Concise, Scannable, and Objective**: usuarios escanean textos; priorizar lo sustantivo, no adornos: https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/
- Baymard, **Product List UX 2025**: encontrar y comparar resultados, filtros, atributos (adaptar al vehículo usado, no copiar atributos de retail): https://baymard.com/blog/current-state-product-list-and-filtering
- Baymard, **Product Listing Page UX**: precio/foto/atributos comparables y filtros aplicados: https://baymard.com/blog/product-listing-page-plp-ux
- Baymard, **High-consideration journeys**: detalles y variedad de imágenes importan en decisiones costosas; analogía, no estudio específico de campers: https://baymard.com/research-articles/furniture-and-home-decor-ux-research
- NN/g, **Communicating Trustworthiness**: transparencia sobre relación y contenido exacto, no solo apariencia: https://www.nngroup.com/articles/communicating-trustworthiness/
- W3C, **WCAG 2.2**: https://www.w3.org/TR/WCAG22/
- Google, **Web Vitals** y **estructura ecommerce**: https://web.dev/articles/vitals ; https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure

**Conclusión:** éxito = inventario real útil + compradores que encuentren y confíen + vendedores que reciban contactos cualificados. El nuevo diseño elimina ruido, pero esas condiciones requieren contenido, operaciones, medición y validación real; no se declaran logradas por reducir un titular.
