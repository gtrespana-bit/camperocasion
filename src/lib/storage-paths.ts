/**
 * Validación de rutas de objetos en Supabase Storage.
 *
 * Los documentos privados (cédulas de vendedores, expediente del vehículo) se
 * guardan como RUTA dentro de un bucket privado, nunca como URL pública. El
 * servidor las convierte en URL firmada de vida corta cuando el admin (o el
 * propietario) quiere abrirlas.
 *
 * Antes de firmar hay que validar la ruta: una ruta construida por el usuario
 * podría salirse de su carpeta (`../`) o apuntar a una clave inesperada. Esta
 * validación vive aquí para que la usen todos los endpoints de firma y se
 * pruebe una sola vez.
 */

/** Carpeta con el uuid del propietario. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface OpcionesRuta {
  /** Número mínimo de segmentos (carpeta + archivo). Por defecto 2. */
  minPartes?: number
  /** Número máximo de segmentos. Por defecto sin límite. */
  maxPartes?: number
  /**
   * Cuántos segmentos iniciales deben ser un uuid. Por defecto 1: la carpeta
   * del propietario. Con 2 se exige también el uuid del producto
   * (`<user_id>/<producto_id>/<archivo>`).
   */
  carpetasUuid?: number
}

/**
 * Devuelve la ruta normalizada o `null` si no es una ruta aceptable.
 *
 * Rechaza rutas vacías, demasiado largas, con bytes nulos, con segmentos
 * vacíos o de navegación (`..`) y con carpetas que no sean uuid cuando
 * corresponda.
 */
export function rutaStorageValida(value: string | null | undefined, opciones: OpcionesRuta = {}): string | null {
  if (!value || value.length > 1_024 || value.includes('\0')) return null

  const { minPartes = 2, maxPartes = Infinity, carpetasUuid = 1 } = opciones

  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  const partes = decoded.split('/')
  if (partes.length < minPartes || partes.length > maxPartes) return null
  if (partes.some(parte => !parte || parte === '.' || parte === '..')) return null
  if (carpetasUuid > 0) {
    for (let i = 0; i < carpetasUuid && i < partes.length; i++) {
      if (!UUID.test(partes[i])) return null
    }
  }

  return partes.join('/')
}

/**
 * Ruta del expediente del vehículo: `<user_id>/<producto_id>/<archivo>`.
 * Las dos primeras carpetas son uuid porque la política de Storage comprueba
 * que la primera sea la del usuario que sube.
 */
export function rutaDocumentoVehiculoValida(value: string | null | undefined): string | null {
  return rutaStorageValida(value, { minPartes: 3, maxPartes: 4, carpetasUuid: 2 })
}
