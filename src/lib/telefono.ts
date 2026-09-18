/**
 * Utilidades de teléfono para CamperOcasión (España, +34).
 *
 * POR QUÉ EXISTE
 * ==============
 * El enlace de WhatsApp de la ficha del anuncio construía el número así:
 *
 *     const finalPhone = phoneNoZero.startsWith('58') ? phoneNoZero : '58' + phoneNoZero
 *
 * Es decir, anteponía SIEMPRE el prefijo de Venezuela: con un móvil español
 * `+34 612 345 678` el enlace quedaba `wa.me/5834612345678`, un número que no
 * existe. El botón de WhatsApp —la vía de contacto principal del sitio— no
 * funcionaba con ningún vendedor de España. Lo mismo en el perfil del vendedor,
 * donde el número se pasaba a `wa.me` sin limpiar espacios ni el `+`.
 *
 * Regla (España):
 *   · 9 dígitos empezando por 6/7/8/9  → número nacional → se le pone el 34.
 *   · ya viene con país (34…, 0034…, +34…) → se respeta.
 *   · otro país explícito (p. ej. +33…) → se respeta tal cual (vendedor
 *     extranjero anunciándose en España).
 */

/** Solo dígitos, sin `+`, sin `00` inicial y sin espacios ni guiones. */
export function soloDigitos(telefono: string): string {
  const limpio = (telefono || '').trim().replace(/[^\d+]/g, '')
  return limpio.replace(/^\+/, '').replace(/^00/, '')
}

/** ¿Es un número nacional español sin prefijo internacional? (612 34 56 78) */
export function esNumeroNacionalEspanol(digitos: string): boolean {
  return /^[6789]\d{8}$/.test(digitos)
}

/**
 * Número listo para `wa.me` / `tel:` (solo dígitos, con prefijo de país).
 * Devuelve cadena vacía si no hay número utilizable.
 */
export function telefonoInternacional(telefono: string, prefijoPorDefecto = '34'): string {
  const digitos = soloDigitos(telefono)
  if (!digitos) return ''
  if (esNumeroNacionalEspanol(digitos)) return `${prefijoPorDefecto}${digitos}`
  // Un número demasiado corto no es marcable: mejor no ofrecer el botón.
  return digitos.length >= 8 ? digitos : ''
}

/** Enlace de WhatsApp con el número normalizado y, opcionalmente, un texto. */
export function enlaceWhatsApp(telefono: string, texto?: string): string {
  const numero = telefonoInternacional(telefono)
  if (!numero) return ''
  const base = `https://wa.me/${numero}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}
