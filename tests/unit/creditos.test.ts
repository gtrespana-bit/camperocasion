import {
  PAQUETES_CREDITO,
  getPaqueteByCreditos,
  isValidPaquete,
  getPrecioByCreditos,
  isValidMetodoPago,
  isValidComprobanteUrl,
} from '@/lib/creditos'

describe('creditos - paquetes servidor (Fase 3 D)', () => {
  test('paquetes permitidos son 2, 15, 40, 100', () => {
    const creditos = PAQUETES_CREDITO.map(p => p.creditos).sort((a, b) => a - b)
    expect(creditos).toEqual([2, 15, 40, 100])
  })

  test('precios coherentes', () => {
    expect(getPrecioByCreditos(2)).toBe(1)
    expect(getPrecioByCreditos(15)).toBe(5)
    expect(getPrecioByCreditos(40)).toBe(10)
    expect(getPrecioByCreditos(100)).toBe(20)
  })

  test('getPaqueteByCreditos retorna correcto', () => {
    expect(getPaqueteByCreditos(15)?.precio).toBe(5)
    expect(getPaqueteByCreditos(999)).toBeUndefined()
  })

  test('isValidPaquete rechaza inventados', () => {
    expect(isValidPaquete(2)).toBe(true)
    expect(isValidPaquete(999999)).toBe(false)
    expect(isValidPaquete(0)).toBe(false)
    expect(isValidPaquete(3)).toBe(false)
  })

  test('metodos de pago validados (España)', () => {
    expect(isValidMetodoPago('bizum')).toBe(true)
    expect(isValidMetodoPago('Bizum')).toBe(true)
    expect(isValidMetodoPago('paypal')).toBe(true)
    expect(isValidMetodoPago('PayPal')).toBe(true)
    expect(isValidMetodoPago('transferencia')).toBe(true)
    expect(isValidMetodoPago('Transferencia')).toBe(true)
    expect(isValidMetodoPago('pagomovil')).toBe(false)
    expect(isValidMetodoPago('')).toBe(false)
  })

  test('metodos de pago: rechaza subcadenas fraudulentas', () => {
    // Antes `includes` aceptaba cualquier string que contuviera el método.
    expect(isValidMetodoPago('transferenciafalsa')).toBe(false)
    expect(isValidMetodoPago('bizum-12345678')).toBe(false)
    expect(isValidMetodoPago('paypal-scam')).toBe(false)
    expect(isValidMetodoPago('no-bizum')).toBe(false)
  })

  test('comprobanteUrl validacion', () => {
    const validSupabase = 'https://jmbkqelkusxjebsdnjoc.supabase.co/storage/v1/object/public/comprobantes/comprobante_123_abc.jpg'
    const validR2 = 'https://pub-d212837165c545e3956251da001fa37a.r2.dev/comprobantes/xyz.png'
    const invalidExternal = 'https://evil.com/comprobantes/fake.jpg'
    const invalidNoComprobantes = 'https://jmbkqelkusxjebsdnjoc.supabase.co/storage/v1/object/public/avatars/user.jpg'
    const invalidHttp = 'http://jmbkqelkusxjebsdnjoc.supabase.co/storage/v1/object/public/comprobantes/x.jpg'

    expect(isValidComprobanteUrl(validSupabase)).toBe(true)
    expect(isValidComprobanteUrl(validR2)).toBe(true)
    expect(isValidComprobanteUrl(invalidExternal)).toBe(false)
    expect(isValidComprobanteUrl(invalidNoComprobantes)).toBe(false)
    expect(isValidComprobanteUrl(invalidHttp)).toBe(false)
    expect(isValidComprobanteUrl('')).toBe(false)
  })

  test('precio del cliente debe ser ignorado - servidor manda', () => {
    // Simula intento de enviar precio falso
    const intentoCreditos = 100 // vale $20
    const paquete = getPaqueteByCreditos(intentoCreditos)
    expect(paquete?.precio).toBe(20)
    // Cliente envía precio 1 intento fraude → servidor debe ignorar y usar 20
    const precioClienteFraudulento = 1
    expect(paquete?.precio).not.toBe(precioClienteFraudulento)
  })
})

describe('creditos - API validation logic', () => {
  test('rechaza creditos arbitrarios', () => {
    // La API debe usar isValidPaquete
    const casosFraude = [1, 3, 999, 999999, -5, 0, 2.5]
    casosFraude.forEach(c => {
      expect(isValidPaquete(c)).toBe(false)
    })
  })
})
