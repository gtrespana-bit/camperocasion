import {
  PLAN_PRUEBA,
  cupoMaximo,
  destacadosIncluidosMes,
  fotosMaximas,
  mensajeCupoLleno,
  planEfectivo,
  puedePublicarMas,
  resumenCupo,
  trialVigente,
} from '@/lib/planes-anuncios'
import { codigoValido, cuponAplicable, generarCodigo, normalizarCodigo } from '@/lib/cupones'

const REGISTRO = new Date('2026-09-28T10:00:00+02:00')
const DIA_10 = new Date('2026-10-08T10:00:00+02:00')
const DIA_40 = new Date('2026-11-10T10:00:00+01:00')

describe('planes profesionales', () => {
  test('particular siempre 1 anuncio, aunque pague', () => {
    expect(cupoMaximo('unlimited', 'particular')).toBe(1)
    expect(fotosMaximas('plus', 'particular')).toBe(10)
    expect(destacadosIncluidosMes('starter', 'particular')).toBe(0)
  })

  test('packs: 5 / 15 / ilimitado', () => {
    expect(cupoMaximo('starter', 'profesional')).toBe(5)
    expect(cupoMaximo('plus', 'profesional')).toBe(15)
    expect(cupoMaximo('unlimited', 'profesional')).toBeNull()
    expect(puedePublicarMas(80, null)).toBe(true)
    expect(destacadosIncluidosMes('starter', 'profesional')).toBe(3)
    expect(destacadosIncluidosMes('plus', 'profesional')).toBe(5)
    expect(destacadosIncluidosMes('unlimited', 'profesional')).toBe(15)
    expect(fotosMaximas('plus', 'camperizador')).toBe(20)
    expect(fotosMaximas('unlimited', 'profesional')).toBe(30)
  })

  test('mes gratis: 30 días desde el alta, solo si el admin lo deja activo', () => {
    expect(
      trialVigente({
        tipo: 'profesional',
        creadoEn: REGISTRO,
        mesGratisActivo: true,
        ahora: DIA_10,
      }),
    ).toBe(true)
    expect(
      trialVigente({
        tipo: 'profesional',
        creadoEn: REGISTRO,
        mesGratisActivo: true,
        ahora: DIA_40,
      }),
    ).toBe(false)
    expect(
      trialVigente({
        tipo: 'profesional',
        creadoEn: REGISTRO,
        mesGratisActivo: false,
        ahora: DIA_10,
      }),
    ).toBe(false)
    expect(
      trialVigente({
        tipo: 'particular',
        creadoEn: REGISTRO,
        mesGratisActivo: true,
        ahora: DIA_10,
      }),
    ).toBe(false)
  })

  test('en prueba el plan efectivo es Plus; si hay suscripción, gana el pack pagado', () => {
    expect(
      planEfectivo({
        tipo: 'profesional',
        plan: 'gratis',
        creadoEn: REGISTRO,
        mesGratisActivo: true,
        ahora: DIA_10,
      }),
    ).toBe(PLAN_PRUEBA)
    expect(
      planEfectivo({
        tipo: 'profesional',
        plan: 'unlimited',
        planHasta: '2027-01-01',
        creadoEn: REGISTRO,
        mesGratisActivo: true,
        ahora: DIA_10,
      }),
    ).toBe('unlimited')
  })

  test('pro sin prueba ni pack queda en 1 anuncio', () => {
    const r = resumenCupo({
      tipo: 'profesional',
      plan: 'gratis',
      usados: 1,
      mesGratisActivo: false,
      ahora: DIA_10,
      creadoEn: REGISTRO,
    })
    expect(r.max).toBe(1)
    expect(r.puedePublicar).toBe(false)
    expect(mensajeCupoLleno(r)).toMatch(/pack/i)
  })
})

describe('cupones', () => {
  test('normaliza y valida códigos', () => {
    expect(normalizarCodigo('  mayo-20 ')).toBe('MAYO-20')
    expect(codigoValido('MAYO-20')).toBe(true)
    expect(codigoValido('ab')).toBe(false)
    expect(generarCodigo().startsWith('CAMPER-')).toBe(true)
  })

  test('rechaza caducado, agotado o inactivo', () => {
    const base = {
      codigo: 'X',
      tipo: 'descuento' as const,
      activo: true,
      max_usos: 10,
      usos: 0,
      valido_desde: null,
      valido_hasta: null,
      porcentaje: 20,
      meses_descuento: 3,
    }
    expect(cuponAplicable({ ...base, activo: false }).ok).toBe(false)
    expect(cuponAplicable({ ...base, usos: 10, max_usos: 10 }).ok).toBe(false)
    expect(
      cuponAplicable({ ...base, valido_hasta: '2020-01-01' }, new Date('2026-09-28')).ok,
    ).toBe(false)
    expect(cuponAplicable(base, new Date('2026-09-28')).ok).toBe(true)
  })
})
