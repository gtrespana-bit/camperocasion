const { withSentryConfig } = require('@sentry/nextjs');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request-config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = withNextIntl({
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Habilitar optimizaciones de compilación
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['data-testid'] } : false,
    relay: false,
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'date-fns',
    ],
    scrollRestoration: true,
    
    // Habilitar compresión Brotli
    turbo: {
      resolveAlias: {
        // Optimizaciones de alias para reducir el tamaño del bundle
      }
    }
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

  // Configuración de salida optimizada
  output: 'standalone',

  // Optimizaciones de webpack
  webpack: (config, { isServer, dev }) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Minificación adicional en producción
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },
});

// Configuración de Sentry
module.exports = withSentryConfig(nextConfig, {
  org: 'vendet-venezuela',
  project: 'vendet-venezuela',
  silent: true,
  hideSourceMaps: true,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  tunnelRoute: '/monitoring',
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});