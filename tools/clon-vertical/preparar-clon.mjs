#!/usr/bin/env node
/**
 * preparar-clon.mjs — genera un repositorio nuevo (otra vertical) a partir del
 * código de CamperOcasión.
 *
 * Qué hace (Fase 1 del plan, ver docs/PLAN-NUEVA-WEB-MAQUINARIA.md):
 *   · Copia SOLO los ficheros versionados (respeta .gitignore: sin node_modules,
 *     sin .next, sin .env).
 *   · Renombra la marca y el dominio en todo el código, ficheros y carpetas.
 *   · Centraliza la identidad en `src/lib/marca.ts` (única fuente de verdad).
 *   · Reescribe next.config.js (301 de dominio), .env.example, manifest PWA,
 *     package.json, metadata raíz, README y PROJECT.md.
 *   · Sustituye logo e iconos por un placeholder neutro.
 *   · Elimina los recursos que solo tienen sentido en camper (fotos semilla,
 *     fotos de hero, assetlinks de la TWA).
 *
 * Qué NO hace (a propósito): borrar las páginas de dominio camper. Eso es la
 * Fase 2 y va acompañado de editar header, footer, home y sitemap; hacerlo aquí
 * dejaría el proyecto sin compilar. El checklist está en docs/ESTADO-CLON.md.
 *
 * Uso:
 *   node tools/clon-vertical/preparar-clon.mjs [--destino <ruta>] [--config <ruta>] [--forzar]
 *
 * Sin dependencias externas: solo Node (>= 20).
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ_ORIGEN = path.resolve(AQUI, '..', '..')

// ── Argumentos ───────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const opt = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto
}
const CONFIG_PATH = path.resolve(RAIZ_ORIGEN, opt('config', 'tools/clon-vertical/marca.json'))
const DESTINO = path.resolve(RAIZ_ORIGEN, '..', opt('destino', 'maquinaria-ocasion'))
const FORZAR = args.includes('--forzar')

// ── Utilidades de consola ────────────────────────────────────────────────
const c = { gris: '\x1b[90m', verde: '\x1b[32m', ambar: '\x1b[33m', rojo: '\x1b[31m', azul: '\x1b[36m', reset: '\x1b[0m' }
const log = (...m) => console.log(...m)
const paso = (n, t) => log(`\n${c.azul}${n}${c.reset} ${t}`)
const ok = (t) => log(`  ${c.verde}✓${c.reset} ${t}`)
const aviso = (t) => log(`  ${c.ambar}!${c.reset} ${t}`)
const err = (t) => log(`  ${c.rojo}✗${c.reset} ${t}`)

// ── Configuración de la vertical ─────────────────────────────────────────
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))

for (const campo of ['nombre', 'token', 'slug', 'paquete', 'dominio', 'url', 'logo']) {
  if (!cfg[campo]) {
    err(`Falta "${campo}" en ${path.relative(RAIZ_ORIGEN, CONFIG_PATH)}`)
    process.exit(1)
  }
}
if (!cfg.partes?.base || !cfg.partes?.acento) {
  err('Faltan "partes.base" / "partes.acento" (el logo se pinta en dos colores).')
  process.exit(1)
}

// ── Plan de copia ────────────────────────────────────────────────────────
/** Carpetas y ficheros que NO viajan al clon (no tienen sentido en la nueva vertical). */
const EXCLUIR = [
  'google search/',                     // exportaciones de Search Console de camperocasion
  'public/semilla-fotos/',              // fotos de campers usadas por el seeder
  'public/.well-known/assetlinks.json', // TWA de Android registrada a nombre de la app camper
  'public/logo-camperocasion.png',      // se sustituye por el placeholder de la nueva marca
  'public/pwa-tagline.webp',            // imagen de marca camper
  'docs/PLAN-NUEVA-WEB-MAQUINARIA.md',  // el plan de la duplicación no aplica dentro del clon
]

/** Ficheros que se renombran (la marca no aparece en el nombre). */
const RENOMBRAR = {
  'public/hero-camper.jpg': 'public/hero.jpg',
}

const BINARIOS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff2', '.woff', '.pdf', '.zip'])

const excluido = (rel) =>
  EXCLUIR.some((e) => rel === e || rel.startsWith(e.endsWith('/') ? e : `${e}/`) || rel === e)

// ── Reemplazos de marca ──────────────────────────────────────────────────
/**
 * Sustituye la identidad camper por la nueva, conservando el casing de cada
 * variante. El orden importa: primero las formas con acento ("CamperOcasión")
 * para que el token en minúsculas no las haya partido antes.
 */
function marca(texto) {
  return texto
    .replaceAll('CamperOcasión', cfg.nombre)
    .replaceAll('CamperOcasion', cfg.nombreSinAcento)
    .replaceAll('camperocasion', cfg.token)
    .replaceAll('CAMPEROCASION', cfg.token.toUpperCase())
}

/** Igual que `marca` pero para nombres de fichero/carpeta. */
const marcaRuta = (rel) => marca(rel)

// ── Transformaciones quirúrgicas por fichero ─────────────────────────────
const transformaciones = {
  'package.json'(src) {
    const pkg = JSON.parse(src)
    pkg.name = cfg.paquete
    return `${JSON.stringify(pkg, null, 2)}\n`
  },

  'next.config.js'(src) {
    // 1) 301 de dominios: solo los propios de la nueva marca.
    const inicio = src.indexOf('  async redirects() {')
    const marcaFin = '  // ═══════════════════════════════════════════════════════\n  // Fase 3 Bloque C'
    const fin = src.indexOf(marcaFin, inicio)
    if (inicio === -1 || fin === -1) {
      throw new Error('no se pudo localizar el bloque redirects() en next.config.js')
    }
    const nuevo = [
      '  // Redirigir los hosts alternativos al dominio canónico conservando ruta',
      '  // y parámetros. Añade aquí los dominios antiguos cuando los tengas.',
      '  async redirects() {',
      '    return [',
      ...cfg.dominiosRedirigidos.flatMap((host) => [
        '      {',
        "        source: '/:path*',",
        `        has: [{ type: 'host', value: '${host}' }],`,
        `        destination: '${cfg.url}/:path*',`,
        '        permanent: true,',
        '      },',
      ]),
      '    ]',
      '  },',
      '',
    ].join('\n')
    let salida = src.slice(0, inicio) + nuevo + src.slice(fin)

    // 2) Host de Supabase: fuera la reserva del proyecto de camper.
    salida = salida.replace(
      /const fallback = 'hbiywrddxrsidniwxuhe\.supabase\.co'/,
      "const fallback = 'proyecto-supabase-a-configurar.supabase.co'",
    )
    return salida
  },

  'src/app/layout.tsx'(src) {
    let salida = src.replace(
      "process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbiywrddxrsidniwxuhe.supabase.co'",
      "process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto-supabase-a-configurar.supabase.co'",
    )
    const inicio = salida.indexOf('export const metadata: Metadata = {')
    const finToken = "  category: 'marketplace',\n}"
    const fin = salida.indexOf(finToken, inicio)
    if (inicio === -1 || fin === -1) {
      aviso('no se pudo reescribir la metadata raíz de layout.tsx (revisar a mano)')
      return salida
    }
    const finReal = fin + finToken.length
    return salida.slice(0, inicio) + metadataRaiz() + salida.slice(finReal)
  },

  'src/lib/seo.ts'(src) {
    let salida = src
      .replace(/export const SITE_URL = '[^']*'/, 'export const SITE_URL = MARCA.url')
      .replace(/export const NOMBRE_SITIO = '[^']*'/, 'export const NOMBRE_SITIO = MARCA.nombre')
    if (!salida.includes("from './marca'")) {
      salida = salida.replace(
        'export const SITE_URL = MARCA.url',
        "import { MARCA } from './marca'\n\nexport const SITE_URL = MARCA.url",
      )
    }
    return salida
  },

  'src/components/BrandLogo.tsx'(src) {
    let salida = src
    if (!salida.includes("from '@/lib/marca'")) {
      salida = salida.replace(
        "import LocalLink from '@/components/LocalLink'",
        "import LocalLink from '@/components/LocalLink'\nimport { MARCA } from '@/lib/marca'",
      )
    }
    // El logo parte el nombre en dos spans para pintar la segunda mitad en color
    // de acento; con el nombre nuevo eso ya no se puede escribir a mano.
    salida = salida.replace(
      /Camper<span className=\{isLight \? 'text-brand-accent-light' : 'text-brand-accent'\}>Ocasión<\/span>/,
      "{MARCA.partes.base}<span className={isLight ? 'text-brand-accent-light' : 'text-brand-accent'}>{MARCA.partes.acento}</span>",
    )
    return salida
  },

  'tailwind.config.js'(src) {
    const mapa = {
      '#0F172A': cfg.colores.primary,
      '#1E293B': cfg.colores.dark,
      '#16A34A': cfg.colores.accent,
      '#15803D': cfg.colores.accentDark,
      '#4ADE80': cfg.colores.accentLight,
      '#EA580C': cfg.colores.orange,
      '#C2410C': cfg.colores.orangeDark,
      '#F5F5F5': cfg.colores.gray,
      '#0B1120': cfg.colores.darkNav,
    }
    let salida = src
    for (const [viejo, nuevo] of Object.entries(mapa)) salida = salida.replaceAll(viejo, nuevo)
    // Los comentarios de la paleta seguían hablando de camper.
    return salida
      .replace(
        /^\/\/ Paleta .*$/m,
        `// Paleta ${cfg.nombre}: grafito/pizarra + ámbar + naranja de avisos.`,
      )
      .replace("// Verde bosque (acento camper)", '// Ámbar (acento de la marca)')
      .replace('// Naranja cálido camper', '// Naranja cálido (avisos y destacados)')
  },

  'public/sw.js'(src) {
    // CACHE_NAME se renombró con la marca, y con él la lista de cachés
    // retiradas, que acababa conteniendo su propio prefijo: `activate` habría
    // borrado la caché que el worker acababa de crear. En un dominio nuevo no
    // hay cachés heredadas (están aisladas por origen), así que la lista nace
    // vacía; al mudar de dominio, se añade el prefijo antiguo aquí.
    return src.replace(
      /\/\/ Cachés que dejaron versiones anteriores[\s\S]*?const PREFIJOS_CACHE_RETIRADOS = \[[^\]]*\]/,
      [
        '// Cachés heredadas de etapas anteriores del proyecto. Las cachés de un',
        '// service worker están aisladas por origen: al estrenar dominio no hay',
        '// ninguna, así que la lista arranca vacía. Si la web se muda de dominio,',
        '// añade aquí el prefijo de las cachés antiguas para que `activate` las',
        '// borre (nunca el de CACHE_NAME, o el worker se borra a sí mismo).',
        'const PREFIJOS_CACHE_RETIRADOS = []',
      ].join('\n'),
    )
  },

  'public/manifest.json'(src) {
    const m = JSON.parse(src)
    m.name = `${cfg.nombre} — ${cfg.vertical.etiqueta} en España`
    m.short_name = cfg.nombre
    m.description = cfg.seo.descripcion
    m.background_color = cfg.colores.primary
    m.theme_color = cfg.colores.primary
    m.categories = ['shopping', 'business', 'productivity']
    return `${JSON.stringify(m, null, 2)}\n`
  },

  'README.md'(src) {
    const cabecera = [
      `# ${cfg.nombre} 🚜`,
      '',
      `**${cfg.vertical.etiqueta} en España.**`,
      '',
      '> ⚠️ **Clon en preparación (Fase 1).** Este repositorio parte del motor de',
      '> CamperOcasión. La marca, el dominio y la configuración ya son propios, pero',
      '> la taxonomía, los textos y las páginas de dominio siguen siendo los de',
      '> camper. El checklist de lo que queda está en',
      '> [`docs/ESTADO-CLON.md`](./docs/ESTADO-CLON.md).',
      '',
      '---',
      '',
      '',
    ].join('\n')
    // Se descarta la cabecera vieja (título + tagline + primer párrafo) y se
    // conserva el resto del README, que es documentación del motor.
    const corte = src.indexOf('## Runtime y seguridad')
    return corte === -1 ? cabecera + src : cabecera + src.slice(corte)
  },

  'PROJECT.md'() {
    return [
      `# ${cfg.nombre} — Proyecto`,
      '',
      '> Clon de CamperOcasión para la vertical de maquinaria. Documentación del',
      '> motor en [`README.md`](./README.md); estado de la migración en',
      '> [`docs/ESTADO-CLON.md`](./docs/ESTADO-CLON.md).',
      '',
      '## General',
      `- **Producto:** ${cfg.vertical.etiqueta} en España`,
      `- **Dominio canónico:** ${cfg.url}`,
      '- **Idiomas:** `es` (canónico, indexado) y `en` (disponible, noindex)',
      '- **Moneda:** Euro (€) — formato `X.XXX €`',
      '',
      '## Heredado de CamperOcasión',
      'Todo el motor de marketplace (auth, chat, panel admin, Stripe, planes,',
      'cupones, push, moderación, SEO programático, PWA) es el mismo. Lo que cambia',
      'es la capa de dominio: categorías, marcas, fichas técnicas y textos.',
      '',
      `La identidad vive en un único fichero: \`src/lib/marca.ts\`. Si cambias el`,
      'nombre, el dominio o la paleta, hazlo ahí y en',
      '`tools/clon-vertical/marca.json`, no a mano por el código.',
      '',
    ].join('\n')
  },

  '.env.example'() {
    return plantillaEnv()
  },

  'src/app/[locale]/page.tsx'(src) {
    let s = src.replaceAll('/hero-camper.jpg', '/hero.jpg')
    if (!s.includes("from '@/lib/marca'")) {
      s = s.replace(
        "import { alternatesSeo } from '@/lib/seo'",
        "import { alternatesSeo } from '@/lib/seo'\nimport { MARCA } from '@/lib/marca'",
      )
    }
    // Descripción del JSON-LD ItemList.
    s = s.replace(
      "description: 'Furgonetas camper y autocaravanas de ocasión en España — MaquinariaOcasión',",
      'description: `${MARCA.etiquetaVertical} en España — ${MARCA.nombre}`,',
    )
    // Bloque generateMetadata de la portada: es lo que sale en la pestaña, en
    // Google y en las tarjetas al compartir. El resto del copy visible (hero,
    // navegación, secciones) sigue siendo camper hasta la fase de contenido.
    const ini = s.indexOf("  return {\n    title: 'Furgonetas camper")
    const fin = s.indexOf('// La home lista anuncios', ini)
    if (ini !== -1 && fin !== -1) {
      s = s.slice(0, ini) + metadataHome() + s.slice(fin)
    }
    return s
  },
}

// ── Generadores de contenido ─────────────────────────────────────────────
function metadataRaiz() {
  const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`
  const keywords = cfg.seo.keywords.map((k) => `    ${q(k)},`).join('\n')
  return `export const metadata: Metadata = {
  metadataBase: new URL(${q(cfg.url)}),
  title: {
    default: ${q(cfg.seo.titulo)},
    template: ${q(cfg.seo.plantilla)},
  },
  description:
    ${q(cfg.seo.descripcion)},
  keywords: [
${keywords}
  ],
  authors: [{ name: ${q(cfg.nombre)} }],
  creator: ${q(cfg.nombre)},
  publisher: ${q(cfg.nombre)},
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: ${q(cfg.url)},
    siteName: ${q(cfg.nombre)},
    title: ${q(cfg.seo.titulo)},
    description: ${q(cfg.seo.descripcionCorta)},
    images: [
      {
        url: '/og-image.webp',
        width: 1200,
        height: 630,
        alt: ${q(cfg.seo.ogAlt)},
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: ${q(cfg.seo.tituloCorto)},
    description: ${q(cfg.seo.descripcionCorta)},
    images: ['/og-image.webp'],
    creator: ${q(cfg.seo.twitter)},
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  category: 'marketplace',
}`
}

function metadataHome() {
  const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`
  return `  return {
    title: MARCA.etiquetaVertical,
    description: MARCA.seo.descripcionCorta,
    keywords: [...MARCA.seo.keywords],
    authors: [{ name: MARCA.nombre }],
    creator: MARCA.nombre,
    publisher: MARCA.nombre,
    alternates: alternatesSeo('/'),
    openGraph: {
      title: MARCA.etiquetaVertical,
      description: MARCA.seo.descripcionCorta,
      url: MARCA.url,
      siteName: MARCA.nombre,
      images: [
        {
          url: \`\${MARCA.url}/og-image.webp\`,
          width: 1200,
          height: 630,
          alt: ${q(cfg.seo.ogAlt)},
        },
      ],
      locale: locale === 'en' ? 'en_US' : 'es_ES',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: MARCA.etiquetaVertical,
      description: MARCA.seo.descripcionCorta,
      images: [\`\${MARCA.url}/og-image.webp\`],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

`
}

function plantillaEnv() {
  return `# ─────────────────────────────────────────────────────────────
# ${cfg.nombre} — plantilla de variables de entorno
# Copiar a \`.env\` para desarrollo local (\`cp .env.example .env\`).
# En producción se definen en Vercel → Project → Settings →
# Environment Variables. NUNCA subir a Git un \`.env\` con claves reales.
#
# Generado por tools/clon-vertical/preparar-clon.mjs. No editar a mano:
# cambia la configuración y vuelve a generarlo.
# ─────────────────────────────────────────────────────────────

# ── OBLIGATORIAS ─────────────────────────────────────────────
# Sin estas dos el build pasa, pero el sitio sale vacío (las páginas públicas
# se renderizan sin datos por diseño). URL y clave DEBEN ser del MISMO proyecto
# de Supabase: mezclarlas devuelve \`401 Invalid API key\` en todo el sitio.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ── PRODUCCIÓN / SERVIDOR (no exponer al cliente) ────────────
# service_role: sortea RLS. Solo server-side.
SUPABASE_SERVICE_ROLE_KEY=

# Dominio canónico: enlaces de emails, OG, sitemaps, redirects.
NEXT_PUBLIC_URL=${cfg.url}

# Protege las rutas de /api/cron/* (Vercel envía Authorization: Bearer).
CRON_SECRET=cambia-esto-por-un-string-aleatorio-largo

# ── IDENTIDAD LEGAL (obligatorio para publicar el aviso legal) ─
# Sin estos datos, el enlace «Aviso legal» no aparece y la página sale con
# noindex. Son datos fiscales: no se escriben en el código a propósito.
NEXT_PUBLIC_TITULAR_NOMBRE=
NEXT_PUBLIC_TITULAR_NIF=
NEXT_PUBLIC_TITULAR_DOMICILIO=
NEXT_PUBLIC_TITULAR_EMAIL=
NEXT_PUBLIC_TITULAR_REGISTRO=

# ── ADMIN ────────────────────────────────────────────────────
# Emails separados por comas con acceso al panel /admin.
ADMIN_EMAILS=
NEXT_PUBLIC_ADMIN_EMAILS=

# ── SUPABASE STORAGE / CLOUDFLARE R2 ─────────────────────────
# Solo si se usa almacenamiento externo para fotos de anuncios.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

# ── PAGOS (Stripe) ───────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ── EMAIL ────────────────────────────────────────────────────
# Resend o SMTP. EMAIL_FROM debe pertenecer a un dominio verificado.
RESEND_API_KEY=
EMAIL_FROM="${cfg.nombre} <noreply@${cfg.dominio}>"
CONTACTO_EMAIL=${cfg.emailSoporte}
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# ── NOTIFICACIONES PUSH (Web Push) ───────────────────────────
# Generar con: npm run generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ── TELEGRAM (avisos internos, opcional) ─────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ADMIN_USER_ID=
TELEGRAM_WEBHOOK_SECRET=

# ── ANALÍTICA ────────────────────────────────────────────────
NEXT_PUBLIC_GA_MEASUREMENT_ID=
GOOGLE_SITE_VERIFICATION=

# ── COBROS MANUALES (transferencia / Bizum / PayPal) ─────────
PAGO_RECEPTOR=
PAGO_IBAN=
PAGO_BANCO=
PAGO_BIZUM_TELEFONO=
PAGO_PAYPAL_EMAIL=
PAGO_INSTRUCCIONES=
`
}

function fichasMarcaTS() {
  const col = cfg.colores
  return `/**
 * Identidad de ${cfg.nombre} en UN SOLO sitio.
 *
 * Heredado del clon de CamperOcasión: allí la marca estaba escrita a mano en
 * 125 ficheros y cambiarla costaba una semana. Aquí nombre, dominio, correos y
 * paleta viven juntos, y \`src/lib/seo.ts\` reexporta \`SITE_URL\` y
 * \`NOMBRE_SITIO\` desde este módulo para no tocar las páginas que ya los usan.
 *
 * Si algún día se extrae esto a un paquete compartido entre verticales, este
 * es el fichero que hay que mover.
 */

export const MARCA = {
  nombre: '${cfg.nombre}',
  nombreSinAcento: '${cfg.nombreSinAcento}',
  /** El logo pinta el nombre en dos colores: base + acento. */
  partes: { base: '${cfg.partes.base}', acento: '${cfg.partes.acento}' },
  /** Identificador en minúsculas y sin acentos: dominios, caches, slugs. */
  token: '${cfg.token}',
  slug: '${cfg.slug}',
  dominio: '${cfg.dominio}',
  url: '${cfg.url}',
  emailSoporte: '${cfg.emailSoporte}',
  emailPrivacidad: '${cfg.emailPrivacidad}',
  logo: '/${cfg.logo}',
  vertical: '${cfg.vertical.clave}',
  etiquetaVertical: '${cfg.vertical.etiqueta}',
  /** Copy de SEO básico de la portada (el resto de textos, en los diccionarios). */
  seo: {
    descripcion:
      ${JSON.stringify(cfg.seo.descripcion)},
    descripcionCorta: ${JSON.stringify(cfg.seo.descripcionCorta)},
    keywords: [
${cfg.seo.keywords.map((k) => `      ${JSON.stringify(k)},`).join('\n')}
    ],
  },
  colores: {
    primary: '${col.primary}',
    dark: '${col.dark}',
    accent: '${col.accent}',
    accentDark: '${col.accentDark}',
    accentLight: '${col.accentLight}',
    orange: '${col.orange}',
    orangeDark: '${col.orangeDark}',
    gray: '${col.gray}',
    darkNav: '${col.darkNav}',
  },
} as const

/** ¿El correo pertenece al dominio de la marca? Útil para filtrar avisos internos. */
export function esEmailDeLaMarca(email: string): boolean {
  return email.trim().toLowerCase().endsWith(\`@\${MARCA.dominio}\`)
}
`
}

function estadoClon() {
  return `# Estado del clon — ${cfg.nombre}

> Generado por \`tools/clon-vertical/preparar-clon.mjs\` el ${new Date().toISOString().slice(0, 10)}.
> Este documento es el checklist de migración: tacha lo que vayas cerrando.

## Fase 1 — Esqueleto (hecho por el generador)

- [x] Copia del árbol versionado sin \`.git\`, \`node_modules\` ni \`.env\`
- [x] Marca renombrada en código, ficheros y carpetas (${cfg.nombre} / ${cfg.dominio})
- [x] \`src/lib/marca.ts\` como fuente única de identidad
- [x] \`next.config.js\`: fuera los 301 de camperocasion, dentro los de ${cfg.dominio}
- [x] \`.env.example\` reescrito (sin la URL ni la clave del Supabase de camper)
- [x] \`package.json\`, manifest PWA, metadata raíz, README y PROJECT.md
- [x] Paleta de la nueva marca en \`tailwind.config.js\`
- [x] Logo e iconos placeholder (sustituir en Fase 4)
- [x] Fuera: fotos semilla de campers, hero camper, assetlinks de la TWA

## Fase 2 — Limpieza del dominio camper (PENDIENTE)

Borrar código que solo tiene sentido en camper. **Hacerlo en un solo PR y
compilando al final**, porque header, footer, home y sitemap enlazan a estas
rutas:

- [ ] Páginas: \`calcular-itp\`, \`compra-segura-camper\`, \`cuanto-vale-mi-camper\`,
      \`gestoria-cambio-nombre\`, \`contrato-compraventa\`, \`comprar-a-camperizadores\`
- [ ] Librerías: \`itp.ts\`, \`contrato.ts\`, \`gestoria.ts\`, \`inspecciones.ts\`,
      \`verificacion-homologacion.ts\`, \`valoracion.ts\`, \`precios-mercado.ts\`
- [ ] API: \`documentos-vehiculo\`, \`gestoria\`, \`inspecciones\`
- [ ] Panel admin: pestañas *Homologación*, *Gestoría*, *Inspecciones*
- [ ] Seeder de anuncios (\`scripts/semilla-*\`, \`api/admin/semilla\`)
- [ ] Buscar y eliminar los restos de vocabulario camper:
      \`grep -rniE "camper|autocaravana|homologaci|dgt"\` (adecuar, no borrar a ciegas)

## Fase 3 — Taxonomía y filtros (PENDIENTE — el núcleo)

- [ ] \`src/lib/categorias.ts\`: familias → categorías → subcategorías propias
      (agrícola, obra, herramientas)
- [ ] \`src/lib/filtros-tecnicos.ts\`: pasar de lista plana a **campos por
      categoría** (\`camposPorCategoria\`). Es el cambio estructural del plan:
      con la lista plana, un taladro pediría "plazas para dormir"
- [ ] \`src/lib/marcas.ts\`: catálogo de fabricantes de maquinaria
- [ ] \`/publicar\`: formulario dinámico según categoría
- [ ] Ficha de producto: bloques técnico / estado / documentación / logística
- [ ] \`CatalogFilters\`, \`useProductLoader\` y \`usePrefetch\` deben seguir leyendo
      del mismo registro (es lo que evita el bug de páginas que "comen" filas)

## Fase 4 — Marca, textos y SEO (PENDIENTE)

- [ ] Logo e iconos definitivos (sustituir los placeholder)
- [ ] \`og-image.webp\`, \`pwa-tagline.webp\` e imágenes de home
- [ ] Diccionarios \`src/i18n/dictionaries/{es,en}.json\`
- [ ] \`textos-legales.ts\`: revisión legal de la actividad
- [ ] \`categorias-seo.ts\` y \`ubicaciones-seo.ts\`: copy de la nueva vertical
- [ ] Search Console + sitemaps del dominio nuevo
- [ ] **No reutilizar copy de camperocasion** (contenido duplicado entre
      dominios propios penaliza a los dos)

## Fase 5 — Contenido y lanzamiento (PENDIENTE)

- [ ] 30-50 anuncios reales antes de abrir
- [ ] Fotos optimizadas con \`npm run optimize-images\`
- [ ] Landings por marca y provincia

## Servicios externos que hay que crear (nada compartido con camper)

| Servicio | Variable | Nota |
|---|---|---|
| Supabase | \`NEXT_PUBLIC_SUPABASE_URL\` | Proyecto nuevo + \`setup-${cfg.token}.sql\` |
| Cloudflare R2 | \`R2_*\` | Bucket nuevo para fotos |
| Stripe | \`STRIPE_*\` | Cuenta o precios propios |
| Resend / SMTP | \`RESEND_API_KEY\` | Dominio verificado |
| Web Push | \`VAPID_*\` | \`npm run generate-vapid-keys\` |
| Telegram | \`TELEGRAM_*\` | Avisos internos |
| Google Analytics | \`NEXT_PUBLIC_GA_MEASUREMENT_ID\` | Propiedad nueva |
`
}

// ── Ejecución ────────────────────────────────────────────────────────────
paso('1/6', 'Comprobando origen y destino')
if (!fs.existsSync(path.join(RAIZ_ORIGEN, '.git'))) {
  err(`El origen no parece un repo git: ${RAIZ_ORIGEN}`)
  process.exit(1)
}
if (fs.existsSync(DESTINO)) {
  if (!FORZAR) {
    err(`El destino ya existe: ${DESTINO}`)
    log(`  Usa --forzar para sobrescribirlo, o --destino <otra-ruta>.`)
    process.exit(1)
  }
  fs.rmSync(DESTINO, { recursive: true, force: true })
  aviso('destino existente eliminado (--forzar)')
}
fs.mkdirSync(DESTINO, { recursive: true })
ok(path.relative(process.cwd(), DESTINO) || DESTINO)

paso('2/6', 'Listando ficheros versionados')
const lista = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ_ORIGEN, encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
ok(`${lista.length} ficheros en el índice`)

paso('3/6', 'Copiando y renombrando')
let copiados = 0
let excluidos = 0
let transformados = 0
const pendientesDeTransformar = new Set(Object.keys(transformaciones))

for (const rel of lista) {
  if (excluido(rel)) {
    excluidos++
    continue
  }
  const origen = path.join(RAIZ_ORIGEN, rel)
  if (!fs.existsSync(origen)) continue // borrado en el árbol de trabajo

  const relNuevo = marcaRuta(RENOMBRAR[rel] ?? rel)
  const destino = path.join(DESTINO, relNuevo)
  fs.mkdirSync(path.dirname(destino), { recursive: true })

  const ext = path.extname(rel).toLowerCase()
  if (BINARIOS.has(ext)) {
    fs.copyFileSync(origen, destino)
  } else {
    let texto = marca(fs.readFileSync(origen, 'utf8'))
    const t = transformaciones[relNuevo] ?? transformaciones[rel]
    if (t) {
      texto = t(texto)
      transformados++
      pendientesDeTransformar.delete(relNuevo)
      pendientesDeTransformar.delete(rel)
    }
    fs.writeFileSync(destino, texto)
  }
  copiados++
}
ok(`${copiados} copiados · ${excluidos} excluidos · ${transformados} reescritos`)

paso('4/6', 'Escribiendo identidad, plantilla de entorno y estado')
fs.writeFileSync(path.join(DESTINO, 'src/lib/marca.ts'), fichasMarcaTS())
fs.mkdirSync(path.join(DESTINO, 'docs'), { recursive: true })
fs.writeFileSync(path.join(DESTINO, 'docs/ESTADO-CLON.md'), estadoClon())
ok('src/lib/marca.ts')
ok('docs/ESTADO-CLON.md')

paso('5/6', 'Sustituyendo logo, iconos e imágenes de marca')
const plantillas = path.join(AQUI, 'plantillas')
const copiar = (origen, destinoRel) => {
  const destino = path.join(DESTINO, destinoRel)
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.copyFileSync(path.join(plantillas, origen), destino)
  return destinoRel
}

const puestos = []
if (fs.existsSync(path.join(plantillas, 'logo.png'))) {
  puestos.push(copiar('logo.png', `public/${cfg.logo}`))
} else {
  aviso('no hay plantillas/logo.png: se conserva el logo del clon anterior')
}
for (const [origen, destino] of [
  ['iconos/', 'iconos (favicon, PWA, apple-touch)'],
  ['og-image.webp', 'imagen Open Graph'],
  ['hero.jpg', 'imagen del hero de portada'],
  ['placeholder-product.webp', 'placeholder de anuncios sin foto'],
]) {
  const p = path.join(plantillas, origen)
  if (origen.endsWith('/')) {
    if (!fs.existsSync(p)) {
      aviso(`no hay plantillas/${origen}: se conservan los iconos del clon anterior`)
      continue
    }
    for (const f of fs.readdirSync(p)) copiar(path.join(origen, f), `public/${f}`)
    puestos.push(destino)
  } else if (fs.existsSync(p)) {
    copiar(origen, `public/${origen}`)
    puestos.push(destino)
  } else {
    aviso(`falta plantillas/${origen}: se conserva el del clon anterior`)
  }
}
for (const p of puestos) ok(p)

paso('6/6', 'Verificando')
// 1) No debe quedar rastro de la marca anterior en configuración ni en código.
const objetivos = ['src', 'public', 'next.config.js', 'package.json', '.env.example']
let restos = 0
const ejemplos = []
const recorrer = (p) => {
  const stats = fs.statSync(p)
  if (stats.isDirectory()) {
    for (const hijo of fs.readdirSync(p)) recorrer(path.join(p, hijo))
    return
  }
  if (BINARIOS.has(path.extname(p).toLowerCase())) return
  const texto = fs.readFileSync(p, 'utf8')
  if (/camperocasion/i.test(texto)) {
    restos++
    if (ejemplos.length < 5) ejemplos.push(path.relative(DESTINO, p))
  }
}
for (const o of objetivos) {
  const p = path.join(DESTINO, o)
  if (fs.existsSync(p)) recorrer(p)
}
if (restos === 0) {
  ok('0 referencias a camperocasion en código y configuración')
} else {
  aviso(`${restos} ficheros aún mencionan camperocasion: ${ejemplos.join(', ')}…`)
}

// 2) Los ficheros que debían reescribirse, reescritos.
if (pendientesDeTransformar.size) {
  aviso(`no se aplicó la transformación de: ${[...pendientesDeTransformar].join(', ')}`)
} else {
  ok('todas las transformaciones previstas aplicadas')
}

// 3) Ficheros clave presentes.
const clave = ['src/lib/marca.ts', 'src/lib/seo.ts', '.env.example', 'package.json', `public/${cfg.logo}`]
const faltan = clave.filter((f) => !fs.existsSync(path.join(DESTINO, f)))
if (faltan.length) aviso(`faltan ficheros clave: ${faltan.join(', ')}`)

log(`\n${c.verde}Listo.${c.reset} Clon en ${c.azul}${DESTINO}${c.reset}\n`)
log('Siguientes pasos:')
log(`  cd ${path.relative(process.cwd(), DESTINO) || DESTINO}`)
log('  npm ci')
log('  cp .env.example .env   # rellenar Supabase')
log('  npm run build')
log('  git init -b main && git add . && git commit -m "Esqueleto de la nueva vertical"')
log(`\nChecklist completo de la migración: ${path.join(path.relative(process.cwd(), DESTINO), 'docs/ESTADO-CLON.md')}\n`)
