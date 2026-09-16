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
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
