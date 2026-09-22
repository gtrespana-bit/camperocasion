import {
  agruparAvisos,
  esAvisable,
  extracto,
  MINUTOS_DE_GRACIA,
  HORAS_MAXIMO_AVISO,
  type MensajePendiente,
} from '@/lib/avisos-mensajes'

const AHORA = new Date('2026-09-22T12:00:00Z')
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60000).toISOString()

function msg(over: Partial<MensajePendiente> = {}): MensajePendiente {
  return {
    id: 'm1',
    conversacion_id: 'c1',
    remitente_id: 'comprador',
    destinatario_id: 'vendedor',
    contenido: '¿Sigue disponible?',
    creado_en: haceMin(30),
    leido: false,
    aviso_email_en: null,
    ...over,
  }
}

describe('esAvisable — cuándo un mensaje merece un email', () => {
  it('avisa de un mensaje sin leer pasado el tiempo de gracia', () => {
    expect(esAvisable(msg(), AHORA)).toBe(true)
  })

  it('NO avisa si el usuario ya lo ha leído (se enteró por la web)', () => {
    expect(esAvisable(msg({ leido: true }), AHORA)).toBe(false)
  })

  it('NO avisa dos veces del mismo mensaje', () => {
    expect(esAvisable(msg({ aviso_email_en: haceMin(5) }), AHORA)).toBe(false)
  })

  it('NO avisa antes del tiempo de gracia: puede estar leyéndolo ahora mismo', () => {
    expect(esAvisable(msg({ creado_en: haceMin(MINUTOS_DE_GRACIA - 1) }), AHORA)).toBe(false)
  })

  it('avisa justo al cumplirse el tiempo de gracia', () => {
    expect(esAvisable(msg({ creado_en: haceMin(MINUTOS_DE_GRACIA) }), AHORA)).toBe(true)
  })

  it('NO avisa de mensajes demasiado viejos: evita avalanchas tras una caída', () => {
    expect(esAvisable(msg({ creado_en: haceMin(HORAS_MAXIMO_AVISO * 60 + 1) }), AHORA)).toBe(false)
  })

  it('ignora fechas corruptas en vez de reventar', () => {
    expect(esAvisable(msg({ creado_en: 'no-es-una-fecha' }), AHORA)).toBe(false)
  })
})

describe('agruparAvisos — un email por conversación', () => {
  it('agrupa varios mensajes de la misma conversación en un solo aviso', () => {
    const avisos = agruparAvisos(
      [
        msg({ id: 'a', contenido: 'Hola', creado_en: haceMin(40) }),
        msg({ id: 'b', contenido: '¿Me lo reservas?', creado_en: haceMin(35) }),
        msg({ id: 'c', contenido: 'Puedo ir el sábado', creado_en: haceMin(30) }),
      ],
      AHORA
    )
    expect(avisos).toHaveLength(1)
    expect(avisos[0].total).toBe(3)
    expect(avisos[0].mensajeIds.sort()).toEqual(['a', 'b', 'c'])
  })

  it('enseña el texto del mensaje MÁS RECIENTE', () => {
    const avisos = agruparAvisos(
      [
        msg({ id: 'a', contenido: 'Primero', creado_en: haceMin(40) }),
        msg({ id: 'b', contenido: 'Último', creado_en: haceMin(20) }),
      ],
      AHORA
    )
    expect(avisos[0].preview).toBe('Último')
  })

  it('separa conversaciones distintas en avisos distintos', () => {
    const avisos = agruparAvisos(
      [
        msg({ id: 'a', conversacion_id: 'c1' }),
        msg({ id: 'b', conversacion_id: 'c2' }),
      ],
      AHORA
    )
    expect(avisos).toHaveLength(2)
  })

  it('separa por destinatario aunque compartan conversación', () => {
    const avisos = agruparAvisos(
      [
        msg({ id: 'a', destinatario_id: 'u1', remitente_id: 'u2' }),
        msg({ id: 'b', destinatario_id: 'u2', remitente_id: 'u1' }),
      ],
      AHORA
    )
    expect(avisos).toHaveLength(2)
  })

  it('nunca avisa a alguien de su propio mensaje', () => {
    const avisos = agruparAvisos(
      [msg({ remitente_id: 'yo', destinatario_id: 'yo' })],
      AHORA
    )
    expect(avisos).toHaveLength(0)
  })

  it('excluye los leídos y deja el resto', () => {
    const avisos = agruparAvisos(
      [
        msg({ id: 'a', contenido: 'Leído', leido: true }),
        msg({ id: 'b', contenido: 'Sin leer' }),
      ],
      AHORA
    )
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensajeIds).toEqual(['b'])
  })

  it('con todo leído no manda nada', () => {
    expect(agruparAvisos([msg({ leido: true }), msg({ id: 'b', leido: true })], AHORA)).toHaveLength(0)
  })

  it('lista vacía no rompe', () => {
    expect(agruparAvisos([], AHORA)).toEqual([])
  })
})

describe('extracto — el texto que se ve en el email', () => {
  it('deja intactos los mensajes cortos', () => {
    expect(extracto('¿Sigue disponible?')).toBe('¿Sigue disponible?')
  })

  it('colapsa saltos de línea y espacios sobrantes', () => {
    expect(extracto('Hola\n\n  buenas   tardes')).toBe('Hola buenas tardes')
  })

  it('recorta sin partir palabras por la mitad', () => {
    const largo = 'palabra '.repeat(40)
    const r = extracto(largo)
    expect(r.length).toBeLessThanOrEqual(141)
    expect(r.endsWith('…')).toBe(true)
    expect(r).not.toMatch(/pala…$/)
  })

  it('tolera contenido vacío', () => {
    expect(extracto('')).toBe('')
  })
})
