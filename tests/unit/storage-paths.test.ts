/**
 * Tests de validación de rutas de Storage.
 *
 * Esta función decide si una ruta recibida por la API puede convertirse en una
 * URL firmada. Un fallo aquí es una fuga de documentos privados (cédulas,
 * fichas técnicas), así que se prueba explícitamente el escape de carpeta.
 */
import { rutaStorageValida, rutaDocumentoVehiculoValida } from '@/lib/storage-paths'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

describe('rutaStorageValida', () => {
  test('acepta la ruta del propietario y normaliza el percent-encoding', () => {
    expect(rutaStorageValida(`${UUID_A}/foto.jpg`)).toBe(`${UUID_A}/foto.jpg`)
    expect(rutaStorageValida(`${UUID_A}/ficha%20tecnica.pdf`)).toBe(`${UUID_A}/ficha tecnica.pdf`)
  })

  test('rechaza rutas que intentan salir de la carpeta del propietario', () => {
    expect(rutaStorageValida(`${UUID_A}/../../otro/secreto.pdf`)).toBeNull()
    expect(rutaStorageValida(`../${UUID_A}/foto.jpg`)).toBeNull()
    expect(rutaStorageValida(`${UUID_A}//foto.jpg`)).toBeNull()
    expect(rutaStorageValida(`${UUID_A}/./foto.jpg`)).toBeNull()
    expect(rutaStorageValida(`${UUID_B}%2f..%2f${UUID_A}%2ffoto.jpg`)).toBeNull()
  })

  test('rechaza rutas sin carpeta de usuario o con carpeta que no es uuid', () => {
    expect(rutaStorageValida('foto.jpg')).toBeNull()
    expect(rutaStorageValida('usuario/foto.jpg')).toBeNull()
    expect(rutaStorageValida('')).toBeNull()
    expect(rutaStorageValida(null)).toBeNull()
    expect(rutaStorageValida(undefined)).toBeNull()
  })

  test('rechaza rutas largas o con bytes nulos', () => {
    expect(rutaStorageValida(`${UUID_A}/${'a'.repeat(1100)}.pdf`)).toBeNull()
    expect(rutaStorageValida(`${UUID_A}/foto\0.jpg`)).toBeNull()
  })

  test('respeta las opciones de número de segmentos', () => {
    const ruta = `${UUID_A}/${UUID_B}/itv.pdf`
    expect(rutaStorageValida(ruta, { minPartes: 3 })).toBe(ruta)
    expect(rutaStorageValida(ruta, { maxPartes: 2 })).toBeNull()
  })
})

describe('rutaDocumentoVehiculoValida', () => {
  test('exige <user_id>/<producto_id>/<archivo> con ambos uuid', () => {
    expect(rutaDocumentoVehiculoValida(`${UUID_A}/${UUID_B}/itv-2026.pdf`)).toBe(`${UUID_A}/${UUID_B}/itv-2026.pdf`)
    // Sin la carpeta del producto no se acepta: la política de Storage y el
    // expediente se apoyan en esa estructura.
    expect(rutaDocumentoVehiculoValida(`${UUID_A}/itv-2026.pdf`)).toBeNull()
    expect(rutaDocumentoVehiculoValida(`producto/${UUID_B}/itv.pdf`)).toBeNull()
  })

  test('no admite subcarpetas arbitrarias ni escapes', () => {
    expect(rutaDocumentoVehiculoValida(`${UUID_A}/${UUID_B}/sub/itv.pdf`)).toBe(`${UUID_A}/${UUID_B}/sub/itv.pdf`)
    expect(rutaDocumentoVehiculoValida(`${UUID_A}/${UUID_B}/sub/mas/itv.pdf`)).toBeNull()
    expect(rutaDocumentoVehiculoValida(`${UUID_A}/${UUID_B}/../../secreto.pdf`)).toBeNull()
  })
})
