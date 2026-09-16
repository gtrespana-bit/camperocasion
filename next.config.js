const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request-config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = withNextIntl({
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Habilitar optimizaciones de compilación
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['data-testid'] } : undefined,
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'date-fns',
    ],
    scrollRestoration: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jmbkqelkusxjebsdnjoc.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-d212837165c545e3956251da001fa37a.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 384, 440, 512, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 640, 750],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  compress: true,

  poweredByHeader: false,

  reactStrictMode: true,

  // Redirigir los dominios alternativos al dominio canónico conservando
  // la ruta y los parámetros de búsqueda. Ejemplo:
  // vendet.online/catalogo?q=ducato → camperocasion.es/catalogo?q=ducato
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'vendet.online' }],
        destination: 'https://camperocasion.es/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.vendet.online' }],
        destination: 'https://camperocasion.es/:path*',
        permanent: true,
      },
    ]
  },

  // ═══════════════════════════════════════════════════════
  // Fase 3 Bloque C — Cabeceras de seguridad
  // ═══════════════════════════════════════════════════════
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-XSS-Protection',
        value: '0', // Desactivar auditor XSS legacy (CSP es la protección moderna)
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        // CSP progresiva compatible con Supabase, R2, Vercel, Sentry, fonts, imágenes
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-analytics.com https://*.vercel-scripts.com https://va.vercel-scripts.com",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data: blob: https: ",
          "media-src 'self' blob: https://*.supabase.co https://*.r2.dev https://*.r2.cloudflarestorage.com",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.dev https://pub-d212837165c545e3956251da001fa37a.r2.dev https://*.r2.cloudflarestorage.com https://vercel.live https://*.vercel-analytics.com https://*.vercel-scripts.com https://va.vercel-scripts.com https://*.sentry.io https://*.ingest.sentry.io https://api.telegram.org",
          "frame-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
        ].join('; '),
      },
    ]

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // El sitio en inglés sigue disponible para usuarios, pero no debe
      // competir en Google con el contenido principal en español.
      {
        source: '/en/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, follow' },
        ],
      },
      // No cache para SW y manifest (siempre frescos)
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },

  // Salida standalone SOLO para self-hosting (Docker / `node server.js`).
  // ⚠️ En Vercel hay que dejarlo desactivado: el builder de Next.js ya genera
  // su propio artefacto y con `output: 'standalone'` activo la build revienta
  // con `ENOENT: .next/next-server.js.nft.json` (bug conocido con Next 16).
  // Para autoalojar: `NEXT_OUTPUT=standalone npm run build` (o `npm run build:standalone`).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

  // Optimizaciones de webpack
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Minificación adicional en producción.
    // ⚠️ IMPORTANTE: la config anterior creaba 7 cache groups forzados
    // (react-dom, react, nextjs, supabase, intl, lucide, vendors) con
    // `maxInitialRequests: 30`, lo que generaba ~15+ archivos JS iniciales por
    // página. En móvil (y en Lighthouse, que penaliza fuertemente el nº de
    // peticiones y el tamaño del bundle), tantos requests bloqueantes disparaban
    // el TTI. Lo reducimos a DOS grupos: `framework` (react/next, el más usado
    // y cacheable) + `vendors` (resto de node_modules).
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 15,
          cacheGroups: {
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              name: 'framework',
              priority: 40,
              chunks: 'all',
              enforce: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },
});

// Sentry deshabilitado por Lighthouse. Para reactivarlo, usa:
// const { withSentryConfig } = require('@sentry/nextjs');
// module.exports = withSentryConfig(nextConfig, { org: 'camperocasion', project: 'camperocasion', silent: true });

module.exports = nextConfig;
