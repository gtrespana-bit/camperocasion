/**
 * Tests del expediente de homologación.
 *
 * Lo que se protege:
 *  1. Qué documentos son exigibles según lo que declara el anuncio (un furgón no
 *     necesita proyecto de homologación; un "Vehículo Vivienda 2448/3148" sí).
 *  2. El aviso al comprador cuando se declara vivienda sin proyecto: es el caso
 *     que el sello existe para evitar.
 *  3. Que el checklist sea el mismo cálculo para vendedor, comprador y admin.
 *  4. Estados: normalización de lo que llega de la base y nombres de archivo
 *     seguros para Storage.
 */
import {
  ESTADOS_VERIFICACION_HOMOLOGACION,
  esEstadoVerificacion,
  esHomologacionVivienda,
  esTipoDocumentoValido,
  estaEnColaDeRevision,
  etiquetaTipoDocumento,
  nombreArchivoSeguro,
  normalizarEstadoVerificacion,
  resumenExpediente,
  tiposExigidos,
  TIPOS_DOCUMENTO_VEHICULO,
} from '@/lib/verificacion-homologacion'

const VIVIENDA = { 'Homologación': 'Vehículo Vivienda (2448 / 3148)' }
const FURGON = { 'Homologación': 'Furgón (2400)' }

describe('tipos de documento', () => {
  test('reconoce los tipos válidos y rechaza el resto', () => {
    expect(esTipoDocumentoValido('ficha_tecnica')).toBe(true)
    expect(esTipoDocumentoValido('proyecto_homologacion')).toBe(true)
    expect(esTipoDocumentoValido('pasaporte')).toBe(false)
    expect(esTipoDocumentoValido(null)).toBe(false)
    expect(TIPOS_DOCUMENTO_VEHICULO).toHaveLength(6)
  })

  test('etiquetaTipoDocumento cae al identificador si el tipo es desconocido', () => {
    expect(etiquetaTipoDocumento('itv')).toBe('Última ITV en vigor')
    expect(etiquetaTipoDocumento('desconocido')).toBe('desconocido')
  })
})

describe('documentos exigidos según lo que declara el anuncio', () => {
  test('un vehículo vivienda exige ficha técnica, ITV y proyecto de homologación', () => {
    expect(tiposExigidos(VIVIENDA)).toEqual(['ficha_tecnica', 'proyecto_homologacion', 'itv'])
  })

  test('un furgón no exige el proyecto de homologación', () => {
    const exigidos = tiposExigidos(FURGON)
    expect(exigidos).toContain('ficha_tecnica')
    expect(exigidos).toContain('itv')
    expect(exigidos).not.toContain('proyecto_homologacion')
  })

  test('sin ficha técnica declarada solo se exige lo mínimo', () => {
    expect(tiposExigidos({})).toEqual(['ficha_tecnica', 'itv'])
    expect(tiposExigidos(null)).toEqual(['ficha_tecnica', 'itv'])
  })

  test('detecta la homologación de vivienda sin depender de tildes ni mayúsculas', () => {
    expect(esHomologacionVivienda(VIVIENDA)).toBe(true)
    expect(esHomologacionVivienda({ 'Homologación': 'VEHICULO VIVIENDA 2448/3148' })).toBe(true)
    expect(esHomologacionVivienda(FURGON)).toBe(false)
    expect(esHomologacionVivienda({})).toBe(false)
  })
})

describe('resumenExpediente', () => {
  test('expediente vacío: nada presente y aviso de lo que falta', () => {
    const resumen = resumenExpediente(VIVIENDA, [], 'sin_verificar')

    expect(resumen.completo).toBe(false)
    expect(resumen.verificado).toBe(false)
    // El orden es el del checklist, no alfabético: primero lo que siempre se
    // exige (ficha técnica), después el proyecto de homologación según la
    // homologación declarada y por último la ITV.
    expect(resumen.faltantes).toEqual(['ficha_tecnica', 'proyecto_homologacion', 'itv'])
    expect(resumen.avisos.join(' ')).toMatch(/proyecto de homologación/i)
    expect(resumen.items.every(i => !i.presente)).toBe(true)
  })

  test('declarar vivienda sin proyecto de homologación genera el aviso del comprador', () => {
    const resumen = resumenExpediente(
      VIVIENDA,
      [{ tipo: 'ficha_tecnica', estado: 'pendiente' }, { tipo: 'itv', estado: 'pendiente' }],
      'pendiente',
    )

    expect(resumen.completo).toBe(false)
    expect(resumen.faltantes).toEqual(['proyecto_homologacion'])
    expect(resumen.avisos.some(a => /Vehículo Vivienda/.test(a))).toBe(true)
  })

  test('expediente completo: nada que avisar y listo para revisar', () => {
    const resumen = resumenExpediente(
      VIVIENDA,
      [
        { tipo: 'ficha_tecnica', estado: 'verificado' },
        { tipo: 'itv', estado: 'verificado' },
        { tipo: 'proyecto_homologacion', estado: 'verificado' },
      ],
      'verificada',
    )

    expect(resumen.completo).toBe(true)
    expect(resumen.verificado).toBe(true)
    expect(resumen.faltantes).toEqual([])
    expect(resumen.avisos).toEqual([])
  })

  test('los documentos opcionales no bloquean el expediente', () => {
    const resumen = resumenExpediente(
      FURGON,
      [{ tipo: 'ficha_tecnica' }, { tipo: 'itv' }],
      'pendiente',
    )

    expect(resumen.completo).toBe(true)
    expect(resumen.faltantes).toEqual([])
    expect(resumen.items.find(i => i.tipo === 'certificado_kilometraje')?.exigido).toBe(false)
  })

  test('marca cada item con su estado y nombre de archivo para la UI', () => {
    const resumen = resumenExpediente(
      FURGON,
      [{ tipo: 'itv', estado: 'rechazado', nombre_archivo: 'itv-2026.pdf' }],
      null,
    )
    const itv = resumen.items.find(i => i.tipo === 'itv')

    expect(itv).toMatchObject({
      presente: true,
      estado: 'rechazado',
      nombre_archivo: 'itv-2026.pdf',
      label: 'Última ITV en vigor',
      exigido: true,
    })
  })

  test('una verificación previa no se da por buena si el estado no lo dice', () => {
    expect(resumenExpediente(VIVIENDA, [{ tipo: 'ficha_tecnica' }], 'pendiente').verificado).toBe(false)
    expect(resumenExpediente(VIVIENDA, [{ tipo: 'ficha_tecnica' }], 'verificada').verificado).toBe(true)
    expect(resumenExpediente(VIVIENDA, [{ tipo: 'ficha_tecnica' }], undefined).verificado).toBe(false)
  })
})

describe('estados', () => {
  test('normaliza lo que llega de la base', () => {
    expect(ESTADOS_VERIFICACION_HOMOLOGACION).toHaveLength(4)
    expect(normalizarEstadoVerificacion('verificada')).toBe('verificada')
    expect(normalizarEstadoVerificacion('pendiente')).toBe('pendiente')
    expect(normalizarEstadoVerificacion('inventado')).toBe('sin_verificar')
    expect(normalizarEstadoVerificacion(undefined)).toBe('sin_verificar')
    expect(normalizarEstadoVerificacion(null)).toBe('sin_verificar')
  })

  test('esEstadoVerificacion valida sin normalizar', () => {
    expect(esEstadoVerificacion('rechazada')).toBe(true)
    expect(esEstadoVerificacion('RECHAZADA')).toBe(false)
    expect(esEstadoVerificacion(3)).toBe(false)
  })

  test('solo los expedientes pendientes entran en la cola de revisión', () => {
    expect(estaEnColaDeRevision('pendiente')).toBe(true)
    expect(estaEnColaDeRevision('verificada')).toBe(false)
    expect(estaEnColaDeRevision('sin_verificar')).toBe(false)
    expect(estaEnColaDeRevision(undefined)).toBe(false)
  })
})

describe('nombreArchivoSeguro', () => {
  test('quita acentos, rutas y caracteres raros', () => {
    expect(nombreArchivoSeguro('Ficha técnica 2026.pdf')).toBe('Ficha-tecnica-2026.pdf')
    expect(nombreArchivoSeguro('../../etc/passwd')).toBe('etc-passwd')
    expect(nombreArchivoSeguro('ITV (2026) nº3.pdf')).toBe('ITV-2026-n-3.pdf')
    expect(nombreArchivoSeguro('proyecto homologación/2026')).toBe('proyecto-homologacion-2026')
  })

  test('nunca devuelve vacío y acota la longitud', () => {
    expect(nombreArchivoSeguro('')).toBe('documento')
    expect(nombreArchivoSeguro(null)).toBe('documento')
    expect(nombreArchivoSeguro('...')).toBe('documento')
    expect(nombreArchivoSeguro('a'.repeat(500)).length).toBeLessThanOrEqual(120)
  })
})
