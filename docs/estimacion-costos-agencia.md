# 💰 Estimación de costos: construir este marketplace con una agencia externa

**Proyecto analizado:** CamperOcasión (camperocasion.online) — marketplace vertical de furgonetas camper y autocaravanas de ocasión en España
**Fecha del análisis:** 31 de julio de 2026
**Moneda:** USD (con referencia en EUR para agencias españolas)

---

## 1. Resumen ejecutivo

Después de analizar el código completo del repositorio (≈21.300 líneas de TypeScript/React, 36 páginas, 40 API routes, 18 tablas de base de datos, 30+ migraciones SQL, chat en tiempo real, PWA, panel de administración, sistema de créditos y SEO masivo), el costo realista de **construir esta página desde cero con una agencia externa** es:

| Proveedor | Tarifa real de mercado | **Costo total estimado** |
|---|---|---|
| **Agencia low-cost offshore** (India, Pakistán, etc.) | $20–35/h | **$38.000 – $60.000** ⚠️ |
| **Agencia Latinoamérica** (Colombia, Argentina, México) | $35–60/h | **$60.000 – $100.000** ✅ mejor relación calidad/precio |
| **Agencia España** | €55–95/h | **€105.000 – €160.000** (≈ $115.000 – $175.000) |
| **Agencia EE.UU. / Reino Unido / Canadá** | $100–150/h | **$165.000 – $280.000** |

**Estimación central (recomendada): 1.500 – 2.000 horas de trabajo** de un equipo mixto (2 desarrolladores full-stack senior, 1 diseñador UX/UI, 1 QA, PM a tiempo parcial) → **4 a 7 meses de calendario** (realista: 6–9 meses con procesos de agencia, aprobaciones y feedback).

> ⚠️ **Ojo con ofertas sospechosamente baratas:** cualquier agencia que cotice esto por menos de ~$25.000–30.000 no lo está construyendo a medida con la calidad y el alcance que ya tiene este proyecto. Te venderá una plantilla genérica con plugins, que no escala y que tendrás que rehacer. (En España, por ejemplo, nadie serio saca una app tipo Wallapop completa por menos de ~€20.000 — ver fuentes en la sección 6.)

---

## 2. Análisis del proyecto (qué es exactamente lo que hay que construir)

### 2.1 Qué es
Un **marketplace de clasificados** estilo OLX/Wallapop para Venezuela: publicar anuncios gratis, contacto directo comprador–vendedor, monetización por **créditos para destacar/booster anuncios** (compra con comprobante + aprobación manual, NO pasarela de pago automática), con moderación de contenido, verificación de vendedores y sistema de reputación.

### 2.2 Alcance medido del código real (no estimado — contado)

| Métrica | Valor |
|---|---|
| Líneas de código TypeScript/TSX | **≈21.300** (198 archivos) |
| Páginas/rutas de la app | **36** (32 productivas + 4 de test) |
| API routes (backend) | **40** |
| Componentes React reutilizables | 34 + 6 hooks |
| Tablas en base de datos (Postgres) | **18** |
| Migraciones SQL | **30+** (≈2.200 líneas, ~50 políticas RLS, ~27 funciones/triggers) |
| Idiomas (i18n) | 2 (es/en, ≈2.100 líneas de diccionarios) |
| Categorías de productos | 7 (con subcategorías, marcas y campos dinámicos) |
| Geografía | 23 estados + D.C., municipios completos de Venezuela |
| Tests automatizados + CI | Jest + GitHub Actions |

### 2.3 Módulos funcionales (lo que cotiza una agencia)

1. **Autenticación y usuarios** — registro, login, confirmación por email, reset de contraseña, perfiles, foto, verificación de identidad (cédula), solicitar verificación, eliminar cuenta.
2. **Catálogo y búsqueda** — catálogo con filtros combinados (categoría, marca, modelo, estado, ubicación, precio), búsqueda full-text, paginación, ordenamiento, landing por ciudad × categoría.
3. **Publicación de anuncios** — wizard de 3–4 pasos con campos dinámicos por categoría (año, marca, specs), subida de fotos a Cloudflare R2 con URLs firmadas, moderación automática + manual, rate-limiting, edición, marcar vendido.
4. **Ficha de producto** — galería, specs, historial de precios, contador de visitas, favoritos, reportar, datos del vendedor, reseñas, SEO (Open Graph dinámico, structured data).
5. **Chat interno en tiempo real** — mensajería Supabase Realtime + polling, conversaciones, leídos, caché, reseña post-venta del comprador.
6. **Dashboard del vendedor** — 7 pestañas: resumen, mis productos, mensajes, créditos, favoritos, verificación, reputación.
7. **Panel de administración** — aprobación/moderación de anuncios, verificación de usuarios, gestión de productos/créditos, auditoría, métricas, **bot de Telegram para aprobar/rechazar**.
8. **Monetización por créditos** — compra con comprobante, aprobación manual, boost/destacado con expiración, transacciones, "Pack Emprendedor".
9. **PWA completa** — service worker con estrategias de caché (network-first, stale-while-revalidate), página offline, **notificaciones push**, banners de instalación.
10. **SEO masivo** — sitemap, robots, landings dinámicas por ciudad/categoría, blog, metadatos Open Graph generados por imagen.
11. **Emails transaccionales** — confirmación, reset, alertas, notificaciones (SMTP Zoho + plantillas).
12. **Integraciones** — Supabase (Auth/DB/Storage/Realtime), Cloudflare R2, tasa — en vivo, Sentry, Vercel Analytics, Telegram.
13. **Seguridad** — Row Level Security en Postgres, rate-limiting, auditoría, validaciones, roles service_role para admin.

### 2.4 Qué NO incluye (y por qué el precio no es más alto)

- **No hay carrito ni pasarela de pago automática** (los créditos se aprueban manualmente con comprobante → evita integración Stripe/Zelle/PayPal).
- **No hay apps nativas iOS/Android** (es PWA instalable). Si quisieras apps nativas, añade **+$20.000–40.000**.
- **No hay sistema de envíos/logística** (es contacto directo local).
- **No hay IA** (moderación automática por palabras, no ML).

---

## 3. Metodología de la estimación

La estimación es **bottom-up**: desglosé el proyecto en 17 paquetes de trabajo, asigné horas a cada uno según el código real existente (complejidad medida, no supuesta), y apliqué **tarifas por hora reales de mercado** de agencias en cada región. Luego crucé el resultado con benchmarks públicos de desarrollo de marketplaces (sección 6) para validar que el rango es coherente.

### 3.1 Desglose de horas por módulo

| # | Paquete de trabajo | Horas (baja) | Horas (alta) |
|---|---|---|---|
| 1 | Discovery, arquitectura, setup (repo, CI/CD, entornos, Supabase) | 40 | 60 |
| 2 | Diseño UX/UI (wireframes, design system, ~25–30 pantallas) | 150 | 220 |
| 3 | Base de datos (18 tablas, RLS, triggers, full-text, storage) | 130 | 180 |
| 4 | Autenticación, perfiles, verificación de identidad | 60 | 90 |
| 5 | Catálogo, búsqueda y filtros | 110 | 160 |
| 6 | Publicación de anuncios (wizard + fotos R2 + moderación) | 100 | 150 |
| 7 | Ficha de producto, favoritos, reportes, SEO on-page | 80 | 120 |
| 8 | Chat en tiempo real + reseñas post-venta | 110 | 160 |
| 9 | Dashboard de usuario (7 pestañas) | 100 | 150 |
| 10 | Panel de administración + bot Telegram + auditoría | 110 | 160 |
| 11 | Sistema de créditos / boost / comprobantes | 60 | 90 |
| 12 | PWA (service worker, offline, notificaciones push) | 60 | 90 |
| 13 | Internacionalización es/en | 30 | 50 |
| 14 | Landings SEO (ciudades × categorías, blog, sitemaps, OG) | 60 | 90 |
| 15 | Emails transaccionales + integraciones (—, Sentry, etc.) | 40 | 60 |
| 16 | QA, testing, performance, compatibilidad | 120 | 180 |
| 17 | Gestión de proyecto + documentación | 80 | 130 |
| | **TOTAL** | **≈1.440** | **≈2.140** |

**Rango redondeado: 1.500 – 2.000 horas** (el punto medio ~1.700 h es la mejor estimación para una agencia seria).

**Sanity check con el código:** ~21.300 líneas a una productividad realista de 100–150 líneas/día de calidad con tests y revisión ≈ 1.100–1.400 h solo de programación + diseño (≈200 h) + QA (≈150 h) + PM (≈100 h). El rango coincide.

### 3.2 Tarifas reales de agencias por región (2025–2026)

| Región | Tarifa/hora (fuentes) |
|---|---|
| **Latinoamérica** | Mid-level $35–70/h; senior $65–100/h (index.dev, hireinsouth); México $25–65, Colombia $22–60, Argentina $18–55 (sciodev, SODI). **Tarifa agencia mixta usada: $40–55/h** |
| **España** | Agencia (precio cliente): €55–80/h otras ciudades, €65–95/h Madrid/Barcelona (10Code/desarrollosoftware.es); senior freelance €50–80/h (tarifaautonomo); media mercado €45/h (Zaask). **Tarifa agencia mixta usada: €70–85/h** |
| **EE.UU./UK** | Mid $80–130, senior $130–200+ (hireinsouth). **Usada: $110–140/h** |
| **India/offshore** | $20–50/h (hireinsouth, softkingo). **Usada: $25–30/h** |

### 3.3 Cálculo por escenario

| Escenario | Horas × tarifa | Resultado |
|---|---|---|
| Offshore low-cost | 1.500h × $25 → 2.000h × $30 | **$37.500 – $60.000** |
| Agencia LatAm | 1.500h × $40 → 2.000h × $50 | **$60.000 – $100.000** |
| Agencia España | 1.500h × €70 → 2.000h × €80 | **€105.000 – €160.000** |
| Agencia EE.UU./UK | 1.500h × $110 → 2.000h × $140 | **$165.000 – $280.000** |

---

## 4. Costos recurrentes (después de lanzar)

No es solo construirlo: hay que mantenerlo funcionando.

### 4.1 Infraestructura mensual (con la arquitectura actual)

| Servicio | Uso actual del proyecto | Costo estimado/mes |
|---|---|---|
| Vercel (hosting Next.js) | Pro plan | ~$20 |
| Supabase (DB + Auth + Storage + Realtime) | Plan Pro (RLS, realtime) | ~$25 |
| Cloudflare R2 (fotos de productos) | Pago por uso | $1–10 |
| Dominio + email | camperocasion.online | ~$2 |
| SMTP/emails (Zoho o Resend) | Transaccionales | $0–20 |
| Sentry + Analytics | Gratis/Pro | $0–30 |
| **Total inicial** | | **≈ $50 – $110/mes** |

Con tráfico real (miles de usuarios, chat realtime, almacenamiento de fotos) esto puede crecer a **$200–500/mes** sin optimización. Es lo normal en plataformas de este tipo.

### 4.2 Mantenimiento y evolución

- **Regla de mercado: 15–20% del costo de desarrollo por año** (fuente: SODI, software a medida en Argentina 2026) → **$9.000–20.000/año** con agencia LatAm; **€16.000–30.000/año** en España.
- Equivalente en contrato mensual de soporte: **$500–1.500/mes** (LatAm) o **€1.000–2.500/mes** (España) por horas de mantenimiento, corrección de bugs, actualizaciones de dependencias y seguridad.
- El proyecto actual ya usa Next.js 16 + dependencias que se actualizan ~cada 6 meses: **hay que presupuestar el mantenimiento sí o sí**, o el sitio se queda obsoleto/inseguro.

### 4.3 Otros costos que se olvidan

| Concepto | Rango real |
|---|---|
| Términos y condiciones + política de privacidad + aviso legal (redacción legal) | $500 – $3.000 (según país; en Venezuela un abogado local cuesta menos, en España/UE incluye RGPD) |
| Lanzamiento + SEO técnico inicial + contenido de landings | $2.000 – $10.000 |
| Configuración de emails transaccionales (deliverability, SPF/DKIM) | $200 – $500 |
| Backup/recuperación ante desastres (si no lo cubre la agencia) | $0 – 500 |

---

## 5. Plazos realistas

| Escenario | Duración |
|---|---|
| Offshore low-cost | 5–8 meses |
| Agencia LatAm | 4–7 meses (con feedback ágil del cliente) |
| Agencia España | 4–8 meses |
| Agencia EE.UU./UK | 3–6 meses |

Los plazos de agencia casi siempre se alargan 30–50% por aprobaciones de diseño, cambios de alcance y QA. **Presupuesta 6–9 meses** si quieres un número seguro. (Fuente: SODI — "sumá un 30–50% adicional al plazo que te prometan para tener una estimación realista".)

---

## 6. Benchmarks de mercado que validan estos números

Estos son datos públicos de 2024–2026 de empresas que cotizan marketplaces:

1. **Codica** (2026): marketplace web completo ≈ **$55.700** (1.114 h × $50/h) — y su alcance es **menor** que este proyecto: no incluye chat en tiempo real, PWA, moderación por Telegram, i18n, landings SEO por ciudad, verificación de identidad ni sistema de créditos. → Nuestro rango LatAm de $60–100k es coherente. *[codica.com/blog/how-much-does-it-cost-to-build-marketplace-website]*
2. **CartCoders** (2025, "How to Build a Website Like Wallapop"): diseño €3–5k + frontend €8–12k + backend €10–18k + QA €3–6k = **€24.000–41.000 solo web** (sin chat avanzado ni PWA completa); con apps móviles €36–61k. *[cartcoders.com/blog/ecommerce/how-to-build-website-like-wallapop]*
3. **Excellent WebWorld** (2025): marketplace moderadamente complejo **$25–35k+**; high-end **$35–60k+**; desarrollo a medida desde **$50k**. *[excellentwebworld.com/cost-of-building-a-marketplace-website]*
4. **Jabitsoft** (2024): marketplace básico $10–50k; **mid-range $50–150k**; enterprise $150–500k+. *[jabitsoft.com/how-much-does-it-cost-to-build-a-marketplace-website-in-2025]*
5. **Softkingo** (2025): stack React+Node+Postgres (el mismo de este proyecto) **$30–60k**; marketplace mid-level **$40–100k** (6–9 meses); LatAm **$35–100k** típico. *[softkingo.com/blog/cost-to-build-a-marketplace-app]*
6. **Cink.es** (España, 2024): app tipo Wallapop desde **€6.000** (muy básica) hasta **€20.000–30.000** con funcionalidades. *[cink.es/blog/crear-app-estilo-wallapop-para-vender-cosas-usadas-y-nuevas]*
7. **ForoCoches** (2021, experiencia real de emprendedores españoles): "por menos de **€20.000** no la sacas" para una app completa tipo Wallapop hecha por empresa externa. *[forocoches.com/foro/showthread.php?t=3841373]*
8. **SODI Argentina** (2026): proyecto complejo a medida = **24–40 semanas**; mantenimiento **15–20% anual**; tarifa $20–60 USD/h. *[sodi.com.ar/blog/cuanto-cuesta-software-a-medida-argentina]*
9. **Tarifas España 2026**: agencia precio cliente **€55–95/h**; senior **€50–80/h**; media mercado **€45/h**. *[desarrollosoftware.es/salarios-desarrolladores-espana-2026], [tarifaautonomo.com/blog/tarifa-hora-desarrollador-web-espana], [zaask.es/cuanto-cuesta/programador-web]*
10. **Tarifas LatAm 2025–2026**: mid **$35–70/h**, senior **$65–100/h**; Colombia $22–60; México $25–65; Argentina $18–55. *[index.dev/blog/latam-developer-hourly-rates], [hireinsouth.com/post/software-development-pricing], [sciodev.com/blog/cost-of-software-development-in-latin-america]*

**Conclusión del cruce:** para un marketplace de este alcance (que está por encima del "MVP lean" de $25–40k pero por debajo del "enterprise" de $150k+), el rango de **$60.000–100.000 con una agencia latinoamericana seria** es el precio realista de mercado. Las agencias europeas/estadounidenses cobran 1.5–2.5× más por el mismo trabajo.

---

## 7. Advertencias para negociar con agencias

1. **Pide el desglose por módulos** (como la tabla de la sección 3.1). Si te dan "todo incluido" sin detalle, es una plantilla.
2. **Desconfía de precios < $25.000** para este alcance: significa plantilla + plugins, código sin tests, sin RLS bien configurado, sin PWA real.
3. **Asegúrate de que el contrato incluya:** entregables por fase, el código fuente completo, las migraciones de base de datos, documentación, y **la propiedad de las credenciales** (Supabase, Vercel, dominio).
4. **Negocia el mantenimiento por adelantado** (mes 1–6 gratis suele ser negociable; luego 15–20% anual o contrato mensual).
5. **Pide referencias de marketplaces lanzados**, no de webs corporativas. Un chat en tiempo real y un panel de moderación no se cotizan como una landing.
6. **Ojo con el alcance "móvil":** si te ofrecen "app incluida" por el mismo precio, es un webview de tu PWA. Si de verdad necesitas apps nativas, son +$20–40k.
7. **Usa este repositorio como especificación:** el código existente (21.300 líneas) documenta EXACTAMENTE lo que quieres. Entregárselo a la agencia como referencia de alcance elimina ambigüedades y te protege de "eso no estaba incluido".

---

## 8. Contexto importante: el proyecto YA existe

Este repositorio no es una idea: es un producto **completo y funcional** (≈21.300 líneas, desplegado en camperocasion.online, con SEO, PWA, chat, admin y monetización implementados). Antes de gastar $60.000–100.000 en reconstruirlo, considera:

| Opción | Costo | Cuándo conviene |
|---|---|---|
| **Continuar sobre este código** (mantenimiento + mejoras con dev freelance/agencia pequeña) | $500–2.000/mes | Si el código funciona y solo necesita evolución |
| **Reconstruir con agencia usando este repo como spec** | $60.000–100.000 (LatAm) | Si el código actual es inmantenible o quieres rehacerlo con garantías profesionales |
| **Agencia solo para auditoría técnica** (revisar seguridad, deuda técnica, RLS) | $3.000–8.000 | Antes de decidir: saber exactamente qué tan sano está el código |
| **App nativa iOS/Android** (adicional a lo que ya hay) | +$20.000–40.000 | Si necesitas presencia en tiendas de apps (hoy es PWA) |

---

## 9. Resumen final en una frase

> **Construir esta página desde cero con una agencia externa seria cuesta entre $60.000 y $100.000 USD** (≈€105.000–160.000 en España) si lo hace una agencia latinoamericana, tarda **5–8 meses**, y exige **$10.000–20.000/año** adicionales de mantenimiento e infraestructura. Ofertas por debajo de ~$25.000–30.000 no están construyendo esto a medida; presupuestos por encima de $150.000 corresponden a agencias de EE.UU./Europa con el mismo alcance.
