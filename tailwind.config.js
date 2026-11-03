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
        ink: { DEFAULT: '#0A0D0C', 900: '#0A0D0C', 800: '#111614', 700: '#181F1C', 600: '#242D29' },
        forest: { DEFAULT: '#12372A', 700: '#184A39', 500: '#2F6B52', 300: '#8FB5A1' },
        sand: { DEFAULT: '#ECE9E1', 50: '#F5F3EE', 100: '#ECE9E1', 200: '#DEDACF', 300: '#C9C4B6' },
        night: { DEFAULT: '#0A0B0A', 800: '#111312', 700: '#181B19', 600: '#222623' },
        bone: { DEFAULT: '#E8E5DD', 200: '#DAD6CC' },
        flare: { DEFAULT: '#FF5A1F', 600: '#E64A12' },
        ember: { DEFAULT: '#E8590C', 600: '#CF4B05', 300: '#FF9A5C' },
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
