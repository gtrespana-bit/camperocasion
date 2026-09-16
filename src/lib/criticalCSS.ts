// CSS crítico para homepage y catálogo - solo estilos esenciales para contenido visible sin scroll
export const criticalCSS = `
/* Reset básico y tipografía */
*, ::before, ::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f9fafb; }
html { font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif; }

/* Header crítico */
header { position: sticky; top: 0; z-index: 50; background: linear-gradient(to right, #1E293B, #0F172A, #0F172A); color: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.header-container { max-width: 80rem; margin-left: auto; margin-right: auto; padding-left: 1rem; padding-right: 1rem; }
.header-content { display: flex; align-items: center; justify-content: space-between; height: 3.5rem; }
.logo-link { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.logo-image { height: 2.75rem; width: auto; filter: drop-shadow(0 0 6px rgba(255,255,255,0.5)); background-color: rgba(255,255,255,0.1); padding: 0.125rem; border-radius: 0.5rem; }
.logo-text { display: none; }
@media (min-width: 640px) { .logo-text { display: block; } }
.logo-highlight { font-weight: 900; font-size: 1.25rem; letter-spacing: -0.025em; }
.logo-yellow { color: #fbbf24; }
.logo-white { color: white; }
.logo-badge { color: #fbbf24; font-weight: 700; font-size: 0.75rem; margin-left: 0.25rem; }

/* Navegación móvil */
.mobile-menu-btn { display: flex; padding: 0.25rem; border-radius: 0.5rem; transition: background-color 0.2s; }
@media (min-width: 768px) { .mobile-menu-btn { display: none; } }

/* Barra de búsqueda desktop */
.search-form { display: none; }
@media (min-width: 768px) { 
  .search-form { display: flex; flex: 1; max-width: 32rem; margin-left: 2rem; margin-right: 2rem; position: relative; }
  .search-input { width: 100%; padding: 0.5rem 1rem; padding-right: 3rem; border-radius: 0.5rem; color: #1f2937; background-color: white; outline: 2px solid transparent; outline-offset: 2px; }
  .search-button { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background-color: #ffd700; padding: 0.375rem; border-radius: 9999px; transition: background-color 0.2s; }
}

/* Acciones del header */
.header-actions { display: flex; align-items: center; gap: 0.5rem; }
.language-toggle { display: none; }
@media (min-width: 768px) { .language-toggle { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: background-color 0.2s; } }

/* Grid de productos */
.products-grid { display: grid; gap: 1rem; }
@media (min-width: 640px) { .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .products-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

/* Tarjeta de producto */
.product-card { background-color: white; border-radius: 0.75rem; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s; }
.product-image-container { position: relative; overflow: hidden; aspect-ratio: 1 / 1; background-color: #f3f4f6; }
.product-image { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.product-content { padding: 1rem; }
.product-title { font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-price { font-size: 1.25rem; font-weight: 900; color: #0F172A; margin-top: 0.25rem; }
.product-location { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }

/* Footer crítico */
.footer { background-color: white; border-top: 1px solid #e5e7eb; }
.footer-container { max-width: 80rem; margin-left: auto; margin-right: auto; padding: 2rem 1rem; }
.footer-content { display: grid; gap: 2rem; }
@media (min-width: 1024px) { .footer-content { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

/* Animaciones críticas */
.transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
.transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 300ms; }
.duration-200 { transition-duration: 200ms; }
.duration-300 { transition-duration: 300ms; }

/* Clases de utilidad críticas */
.hidden { display: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
.block { display: block; }
.flex { display: flex; }
.grid { display: grid; }
.absolute { position: absolute; }
.relative { position: relative; }
.sticky { position: sticky; }
.inset-0 { inset: 0; }
.top-0 { top: 0; }
.z-50 { z-index: 50; }
.col-span-2 { grid-column: span 2 / span 2; }
.m-4 { margin: 1rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.my-4 { margin-top: 1rem; margin-bottom: 1rem; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mr-2 { margin-right: 0.5rem; }
.ml-1 { margin-left: 0.25rem; }
.p-4 { padding: 1rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.pt-16 { padding-top: 4rem; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.leading-tight { line-height: 1.25; }
.tracking-tight { letter-spacing: -0.025em; }
.text-white { color: #ffffff; }
.text-gray-500 { color: #6b7280; }
.text-gray-800 { color: #1f2937; }
.text-gray-900 { color: #111827; }
.text-brand-primary { color: #0F172A; }
.text-yellow-400 { color: #fbbf24; }
.bg-white { background-color: #ffffff; }
.bg-gray-50 { background-color: #f9fafb; }
.bg-gray-100 { background-color: #f3f4f6; }
.bg-brand-primary { background-color: #0F172A; }
.bg-yellow-400 { background-color: #fbbf24; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.border { border-width: 1px; }
.border-gray-100 { border-color: #f3f4f6; }
.border-gray-200 { border-color: #e5e7eb; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
.w-full { width: 100%; }
.h-full { height: 100%; }
.max-w-7xl { max-width: 80rem; }
.aspect-square { aspect-ratio: 1 / 1; }
.object-cover { object-fit: cover; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;