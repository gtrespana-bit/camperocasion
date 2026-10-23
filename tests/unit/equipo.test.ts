import {
  ETIQUETA_ROL,
  MIEMBROS_MAX,
  ROLES_EQUIPO,
  emailValido,
  normalizarEmail,
  ocupaAsiento,
  puedeInvitar,
} from '@/lib/equipo-reglas'

describe('equipo - emails', () => {
  test('normaliza espacios y mayúsculas', () => {
    expect(normalizarEmail('  Comercial@Taller.ES ')).toBe('comercial@taller.es')
    expect(normalizarEmail(null)).toBe('')
  })

  test('acepta emails normales', () => {
    expect(emailValido('ana@taller.es')).toBe(true)
    expect(emailValido('ana.gomez+ventas@sub.taller.es')).toBe(true)
    expect(emailValido('a@b.co')).toBe(true)
  })

  test('rechaza lo que no es un email', () => {
    expect(emailValido('')).toBe(false)
    expect(emailValido('ana')).toBe(false)
    expect(emailValido('ana@')).toBe(false)
    expect(emailValido('@taller.es')).toBe(false)
    expect(emailValido('ana@taller')).toBe(false)
    expect(emailValido('ana@@taller.es')).toBe(false)
    expect(emailValido('ana gomez@taller.es')).toBe(false)
    expect(emailValido('ana@taller..es')).toBe(false)
    expect(emailValido('ana@taller.es.')).toBe(false)
  })
})

describe('equipo - quién ocupa asiento', () => {
  test('invitados y activos ocupan; revocados no', () => {
    expect(ocupaAsiento('invitado')).toBe(true)
    expect(ocupaAsiento('activo')).toBe(true)
    expect(ocupaAsiento('revocado')).toBe(false)
    expect(ocupaAsiento(null)).toBe(false)
  })
})

describe('equipo - puede invitar', () => {
  const base = { plan: 'unlimited', ocupados: 0, email: 'ana@taller.es' } as const

  test('Flota con sitio puede invitar', () => {
    expect(puedeInvitar({ ...base }).ok).toBe(true)
  })

  test('solo Flota tiene equipo', () => {
    for (const plan of ['gratis', 'starter', 'plus', null, undefined]) {
      const r = puedeInvitar({ ...base, plan })
      expect(r.ok).toBe(false)
      expect(r.codigo).toBe('PLAN')
    }
  })

  test('el email tiene que ser válido', () => {
    const r = puedeInvitar({ ...base, email: 'ana' })
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('EMAIL')
  })

  test('el titular no se invita a sí mismo', () => {
    const r = puedeInvitar({ ...base, emailTitular: 'Atencion@Taller.es', email: 'atencion@taller.es' })
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('PROPIO')
  })

  test('no se repite un email ya invitado', () => {
    const r = puedeInvitar({ ...base, emailsExistentes: ['ANA@taller.es'] })
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('DUPLICADO')
  })

  test('el tope de asientos se respeta', () => {
    expect(puedeInvitar({ ...base, ocupados: MIEMBROS_MAX - 1 }).ok).toBe(true)
    const r = puedeInvitar({ ...base, ocupados: MIEMBROS_MAX })
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('LIMITE')
    expect(r.motivo).toContain(String(MIEMBROS_MAX))
  })

  test('tres comerciales además del titular', () => {
    expect(MIEMBROS_MAX).toBe(3)
    expect(ROLES_EQUIPO).toEqual(['admin', 'comercial'])
    expect(ETIQUETA_ROL.admin).toBe('Administrador')
    expect(ETIQUETA_ROL.comercial).toBe('Comercial')
  })
})
