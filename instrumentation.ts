// Solo en los logs del servidor: permite comprobar el runtime efectivo de las
// funciones desplegadas, que puede diferir del utilizado durante el build.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.info(`[runtime] Node.js ${process.versions.node}`);
  }
}

// Sentry permanece deshabilitado.
export const onRequestError = undefined;
