import {
  DIAS_GRACIA_TRIAL,
  avisosPlanPendientes,
  calcularTrial,
  estadoTrial,
  mensajeAvisoPlan,
  trialDisponible,
} from '@/lib/planes-prueba'
import { planEfectivo } from '@/lib/planes-anuncios'

const AHORA = new Date('2026-10-22T10:00:00Z')
const INICIO = '2026-10-02T10:00:00Z'
const FIN = '2026-11-01T10:00:00Z'

const PERFIL = {
  tipo: 'profesional',
  trialIniciadoEn: INICIO,
  trialHasta: FIN,
}

describe('prueba con fechas reales', () => {
  test('usa las fechas guardadas y no depende del interruptor global', () => {
    const estado = estadoTrial({
      ...PERFIL,
      // El admin apagó la prueba global: quien ya estaba dentro la conserva.
      mesGratisActivo: false,
      ahora: AHORA,
    })
    expect(estado.enPrueba).toBe(true)
    expect(estado.iniciado).toBe(true)
    expect(estado.hasta?.toISOString()).toBe('2026-11-01T10:00:00.000Z')
    expect(estado.diasRestantes).toBe(10)
    expect(estado.enGracia).toBe(false)
  })

  test('los perfiles antiguos siguen calculando desde el alta', () => {
    const estado = estadoTrial({
      tipo: 'camperizador',
      creadoEn: '2026-10-02T10:00:00Z',
      mesGratisActivo: true,
      diasGratis: 30,
      ahora: AHORA,
    })
    expect(estado.enPrueba).toBe(true)
    expect(estado.diasRestantes).toBe(10)

    const apagada = estadoTrial({
      tipo: 'camperizador',
      creadoEn: '2026-10-02T10:00:00Z',
      mesGratisActivo: false,
      ahora: AHORA,
    })
    expect(apagada.enPrueba).toBe(false)
    expect(apagada.hasta).toBeNull()
  })

  test('un particular no está en prueba aunque conserve fechas', () => {
    const estado = estadoTrial({ ...PERFIL, tipo: 'particular', ahora: AHORA })
    expect(estado.enPrueba).toBe(false)
    expect(estado.enGracia).toBe(false)
    expect(estado.iniciado).toBe(true)
  })

  test('gracia: 7 días exactos después del fin', () => {
    const enGracia = estadoTrial({
      ...PERFIL,
      ahora: new Date('2026-11-04T10:00:00Z'),
    })
    expect(enGracia.enPrueba).toBe(false)
    expect(enGracia.enGracia).toBe(true)
    expect(enGracia.graciaHasta?.toISOString()).toBe('2026-11-08T10:00:00.000Z')
    expect(enGracia.diasGraciaRestantes).toBe(4)
    expect(DIAS_GRACIA_TRIAL).toBe(7)

    const ultimoDia = estadoTrial({
      ...PERFIL,
      ahora: new Date('2026-11-08T09:00:00Z'),
    })
    expect(ultimoDia.enGracia).toBe(true)
    expect(ultimoDia.diasGraciaRestantes).toBe(1)

    const terminada = estadoTrial({
      ...PERFIL,
      ahora: new Date('2026-11-08T10:00:01Z'),
    })
    expect(terminada.enGracia).toBe(false)
  })

  test('el pack de pago manda sobre la prueba', () => {
    const estado = estadoTrial({ ...PERFIL, planPagoVigente: true, ahora: AHORA })
    expect(estado.enPrueba).toBe(false)
    expect(estado.enGracia).toBe(false)
  })

  test('el plan efectivo incluye la gracia', () => {
    const plan = planEfectivo({
      ...PERFIL,
      mesGratisActivo: true,
      diasGratis: 30,
      ahora: new Date('2026-11-04T10:00:00Z'),
    })
    expect(plan).toBe('plus')

    const despues = planEfectivo({
      ...PERFIL,
      mesGratisActivo: true,
      diasGratis: 30,
      ahora: new Date('2026-11-09T10:00:00Z'),
    })
    expect(despues).toBe('gratis')
  })

  test('disponibilidad: una sola prueba por cuenta', () => {
    expect(
      trialDisponible({
        tipo: 'particular',
        creadoEn: '2020-01-01T00:00:00Z',
        mesGratisActivo: true,
        ahora: AHORA,
      }),
    ).toBe(true)

    expect(
      trialDisponible({
        ...PERFIL,
        mesGratisActivo: true,
        ahora: AHORA,
      }),
    ).toBe(false)

    expect(
      trialDisponible({
        tipo: 'profesional',
        creadoEn: '2020-01-01T00:00:00Z',
        mesGratisActivo: true,
        diasGratis: 30,
        ahora: AHORA,
      }),
    ).toBe(false)

    expect(
      trialDisponible({
        tipo: 'particular',
        mesGratisActivo: false,
        ahora: AHORA,
      }),
    ).toBe(false)

    expect(
      trialDisponible({
        tipo: 'particular',
        mesGratisActivo: true,
        planPagoVigente: true,
        ahora: AHORA,
      }),
    ).toBe(false)
  })

  test('calcularTrial devuelve fechas consecuentes', () => {
    const trial = calcularTrial({ ahora: AHORA, dias: 30 })
    expect(trial.inicio.toISOString()).toBe(AHORA.toISOString())
    expect(trial.hasta.toISOString()).toBe('2026-11-21T10:00:00.000Z')
    expect(trial.plan).toBe('plus')
  })
})

describe('avisos de prueba y dunning', () => {
  const trial = (ahora: Date, extra: Record<string, unknown> = {}) =>
    estadoTrial({ ...PERFIL, ahora, ...extra })

  test('10 días, 3 días y último día', () => {
    const a10 = avisosPlanPendientes({ ahora: AHORA, trial: trial(AHORA) })
    expect(a10.map((a) => a.tipo)).toEqual(['trial_10d'])
    expect(a10[0].clave).toBe('trial_10d:2026-11-01')

    const a3 = avisosPlanPendientes({
      ahora: new Date('2026-10-29T10:00:00Z'),
      trial: trial(new Date('2026-10-29T10:00:00Z')),
    })
    expect(a3.map((a) => a.tipo)).toEqual(['trial_3d'])

    const ultimo = avisosPlanPendientes({
      ahora: new Date('2026-10-31T10:00:00Z'),
      trial: trial(new Date('2026-10-31T10:00:00Z')),
    })
    expect(ultimo.map((a) => a.tipo)).toEqual(['trial_ultimo_dia'])
  })

  test('no repite el mismo aviso', () => {
    const avisos = avisosPlanPendientes({
      ahora: AHORA,
      trial: trial(AHORA),
      avisados: ['trial_10d:2026-11-01'],
    })
    expect(avisos).toEqual([])
  })

  test('gracia y último día de gracia', () => {
    const gracia = avisosPlanPendientes({
      ahora: new Date('2026-11-02T10:00:00Z'),
      trial: trial(new Date('2026-11-02T10:00:00Z')),
    })
    expect(gracia.map((a) => a.tipo)).toEqual(['trial_gracia'])

    const ultima = avisosPlanPendientes({
      ahora: new Date('2026-11-07T10:00:00Z'),
      trial: trial(new Date('2026-11-07T10:00:00Z')),
    })
    expect(ultima.map((a) => a.tipo)).toEqual(['gracia_ultimo_dia'])
  })

  test('dunning a 1, 3 y 7 días del primer fallo', () => {
    const desde = '2026-10-22T08:00:00Z'
    const dia1 = avisosPlanPendientes({
      ahora: new Date('2026-10-22T10:00:00Z'),
      pagoPendienteDesde: desde,
    })
    expect(dia1.map((a) => a.tipo)).toEqual(['pago_fallido_1d'])
    expect(dia1[0].clave).toBe('pago_fallido_1d:2026-10-22')

    const dia3 = avisosPlanPendientes({
      ahora: new Date('2026-10-25T10:00:00Z'),
      pagoPendienteDesde: desde,
    })
    expect(dia3.map((a) => a.tipo)).toEqual(['pago_fallido_3d'])

    const dia7 = avisosPlanPendientes({
      ahora: new Date('2026-10-29T10:00:00Z'),
      pagoPendienteDesde: desde,
    })
    expect(dia7.map((a) => a.tipo)).toEqual(['pago_fallido_7d'])
  })

  test('un impago no se avisa dos veces el mismo día', () => {
    const avisos = avisosPlanPendientes({
      ahora: AHORA,
      pagoPendienteDesde: '2026-10-22T08:00:00Z',
      avisados: ['pago_fallido_1d:2026-10-22'],
    })
    expect(avisos).toEqual([])
  })

  test('mensajes de push con la acción correcta', () => {
    expect(mensajeAvisoPlan('trial_3d', { dias: 3 }).url).toBe('/dashboard?tab=plan')
    expect(mensajeAvisoPlan('pago_fallido_1d').titulo).toContain('cobrar')
    expect(mensajeAvisoPlan('gracia_ultimo_dia').titulo).toContain('Mañana')
  })
})

describe('win-back', () => {
  // Fin de prueba 2026-11-01 → gracia hasta 2026-11-08 → aviso el 11-15.
  const FIN_PRUEBA = new Date('2026-11-01T10:00:00Z')
  const FIN_GRACIA = new Date(FIN_PRUEBA.getTime() + 7 * 86400000)

  test('se envía una semana después de perder el cupo', () => {
    const avisos = avisosPlanPendientes({
      ahora: new Date('2026-11-15T10:00:00Z'),
      winbackDesde: FIN_GRACIA,
    })
    expect(avisos.map((a) => a.tipo)).toEqual(['winback'])
    expect(avisos[0].clave).toBe('winback:2026-11-08')
  })

  test('no se envía antes de la semana', () => {
    const avisos = avisosPlanPendientes({
      ahora: new Date('2026-11-14T10:00:00Z'),
      winbackDesde: FIN_GRACIA,
    })
    expect(avisos).toEqual([])
  })

  test('no se envía a quien tiene pack pagado, prueba o gracia', () => {
    const ahora = new Date('2026-11-15T10:00:00Z')
    expect(
      avisosPlanPendientes({ ahora, winbackDesde: FIN_GRACIA, planPagoVigente: true }),
    ).toEqual([])

    const enGracia = estadoTrial({
      ...PERFIL,
      ahora: new Date('2026-11-05T10:00:00Z'),
      mesGratisActivo: true,
    })
    expect(enGracia.enGracia).toBe(true)
    const duranteGracia = avisosPlanPendientes({
      ahora: new Date('2026-11-05T10:00:00Z'),
      trial: enGracia,
      winbackDesde: FIN_GRACIA,
    })
    // Puede tocar el aviso de gracia, pero nunca el de win-back.
    expect(duranteGracia.map((a) => a.tipo)).not.toContain('winback')
  })

  test('no se avisa dos veces de la misma baja', () => {
    const avisos = avisosPlanPendientes({
      ahora: new Date('2026-11-15T10:00:00Z'),
      winbackDesde: FIN_GRACIA,
      avisados: ['winback:2026-11-08'],
    })
    expect(avisos).toEqual([])
  })

  test('la ventana evita correos masivos tras un despliegue', () => {
    // Una prueba perdida hace meses no genera aviso.
    const avisos = avisosPlanPendientes({
      ahora: new Date('2027-02-01T10:00:00Z'),
      winbackDesde: FIN_GRACIA,
    })
    expect(avisos).toEqual([])
  })

  test('el push lleva a la página de packs', () => {
    const mensaje = mensajeAvisoPlan('winback')
    expect(mensaje.url).toBe('/para-profesionales')
    expect(mensaje.titulo).toContain('pack')
  })
})
