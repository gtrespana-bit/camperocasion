/**
 * Datos del titular que exige la Ley 34/2002 (LSSI, art. 10) en el aviso legal.
 *
 * No se escriben en el código a propósito: son datos fiscales que cambian (alta
 * como autónomo o constitución de sociedad) y que no deben quedar en el
 * historial de Git ni, menos aún, inventarse. Se leen del entorno para poder
 * rellenarlos en Vercel sin tocar el repositorio.
 *
 * Mientras no estén configurados, `hayDatosTitular()` es `false` y:
 *   · el enlace «Aviso legal» no aparece en el pie, y
 *   · la página sale con `robots: noindex`.
 * Así una web en producción nunca enseña un aviso legal a medias.
 */

export interface DatosTitular {
  /** Nombre y apellidos (autónomo) o denominación social (sociedad). */
  nombre: string
  /** NIF/DNI del titular o CIF de la sociedad. */
  nif: string
  /** Domicilio completo: calle, número, código postal, provincia. */
  domicilio: string
  /** Email de contacto legal. Obligatorio en la LSSI. */
  email: string
  /** Teléfono de atención (opcional, recomendable). */
  telefono: string
  /** Datos registrales, solo para sociedades («Inscrita en el Registro…»). */
  registro: string
}

const env = (valor: string | undefined) => (valor || '').trim()

export function datosTitular(): DatosTitular {
  return {
    nombre: env(process.env.NEXT_PUBLIC_TITULAR_NOMBRE),
    nif: env(process.env.NEXT_PUBLIC_TITULAR_NIF),
    domicilio: env(process.env.NEXT_PUBLIC_TITULAR_DOMICILIO),
    // El email es obligatorio en la LSSI; si no hay uno específico se usa el
    // buzón de privacidad, que ya existe y se anuncia en la web.
    email: env(process.env.NEXT_PUBLIC_TITULAR_EMAIL) || env(process.env.NEXT_PUBLIC_EMAIL_CONTACTO) || 'privacidad@camperocasion.online',
    telefono: env(process.env.NEXT_PUBLIC_TITULAR_TELEFONO) || env(process.env.NEXT_PUBLIC_TELEFONO_CONTACTO),
    registro: env(process.env.NEXT_PUBLIC_TITULAR_REGISTRO),
  }
}

/**
 * ¿Está la identidad del titular publicable? Sin nombre, NIF y domicilio, un
 * aviso legal incompleto es peor que no tenerlo: aparenta cumplir y no cumple.
 */
export function hayDatosTitular(): boolean {
  const { nombre, nif, domicilio } = datosTitular()
  return Boolean(nombre && nif && domicilio)
}
