// Lista de administradores para la UI (ocultar/mostrar panel).
//
// ⚠️ Esto es SOLO una compuerta visual del cliente. La seguridad real la aplica
// el servidor en src/lib/require-auth.ts usando la variable de entorno
// ADMIN_EMAILS (separada por comas). Mantén ambas en sintonía.
export const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'gtrespana@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)
