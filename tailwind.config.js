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
        // Paleta editorial de la portada: tinta verdosa, bosque profundo,
        // arena cálida y brasa (naranja camper).
        ink: { DEFAULT: '#0B1410', 900: '#0B1410', 800: '#111D17', 700: '#18281F', 600: '#233529' },
        forest: { DEFAULT: '#12372A', 700: '#184A39', 500: '#2F6B52', 300: '#8FB5A1' },
        sand: { DEFAULT: '#F4EFE6', 50: '#FAF7F1', 100: '#F4EFE6', 200: '#E9E1D2', 300: '#D8CDB8' },
        ember: { DEFAULT: '#E8590C', 600: '#CF4B05', 300: '#FF9A5C' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
