/** @type {import('tailwindcss').Config} */
// Paleta CamperOcasión: grafito/pizarra + verde bosque + naranja camper.
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0F172A',   // Grafito / pizarra oscuro
          dark: '#1E293B',      // Pizarra (nav/header/footer)
          accent: '#16A34A',    // Verde bosque (acento camper)
          'accent-dark': '#15803D',
          'accent-light': '#4ADE80',
          orange: '#EA580C',    // Naranja cálido camper
          'orange-dark': '#C2410C',
          gray: '#F5F5F5',
          darkNav: '#0B1120',
        },
        // Colores de la marca (logo, emails y resto de la web): pizarra #0F172A,
        // verde #16A34A y naranja #EA580C. Estos alias los usan portada, header y footer.
        ink: { DEFAULT: '#0F172A', 900: '#0B1120', 800: '#0F172A', 700: '#1E293B', 600: '#334155' },
        forest: { DEFAULT: '#14532D', 700: '#166534', 500: '#16A34A', 300: '#86EFAC' },
        sand: { DEFAULT: '#F1F5F9', 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1' },
        night: { DEFAULT: '#0B1120', 800: '#0F172A', 700: '#1E293B', 600: '#334155' },
        bone: { DEFAULT: '#F5F7FA', 200: '#E2E8F0' },
        leaf: { DEFAULT: '#16A34A', 600: '#15803D', 300: '#4ADE80' },
        flare: { DEFAULT: '#EA580C', 600: '#C2410C', 300: '#FB923C' },
        ember: { DEFAULT: '#EA580C', 600: '#C2410C', 300: '#FB923C' },
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        grotesk: ['var(--font-grotesk)', 'var(--font-geist)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
