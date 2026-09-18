/**
 * El banner de cookies tiene que servir para algo.
 *
 * Antes guardaba la elección y nadie la leía: la analítica se cargaba también
 * para quien pulsaba «Rechazar». Estas pruebas fijan el contrato del módulo que
 * leen tanto el banner como `RootClientEffects`.
 */

import {
  CONSENT_KEY,
  alCambiarConsentimiento,
  guardarConsentimiento,
  leerConsentimiento,
} from '@/lib/cookie-consent'

beforeEach(() => {
  window.localStorage.clear()
})

describe('leerConsentimiento', () => {
  it('sin decisión previa devuelve null (el banner debe volver a preguntar)', () => {
    expect(leerConsentimiento()).toBeNull()
  })

  it('solo reconoce "accepted" y "rejected"', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    expect(leerConsentimiento()).toBe('accepted')

    window.localStorage.setItem(CONSENT_KEY, 'rejected')
    expect(leerConsentimiento()).toBe('rejected')

    // Valores antiguos o manipulados no valen como consentimiento.
    window.localStorage.setItem(CONSENT_KEY, 'true')
    expect(leerConsentimiento()).toBeNull()
  })
})

describe('guardarConsentimiento', () => {
  it('persiste la decisión', () => {
    guardarConsentimiento('rejected')
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('rejected')
    expect(leerConsentimiento()).toBe('rejected')
  })

  it('avisa del cambio para no tener que recargar', () => {
    const visto: string[] = []
    const dejarDeEscuchar = alCambiarConsentimiento((valor) => visto.push(valor))

    guardarConsentimiento('accepted')

    expect(visto).toEqual(['accepted'])
    dejarDeEscuchar()

    guardarConsentimiento('rejected')
    expect(visto).toEqual(['accepted'])
  })

  it('no revienta si el navegador bloquea el almacenamiento', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('modo privado')
    }

    expect(() => guardarConsentimiento('accepted')).not.toThrow()
    expect(leerConsentimiento()).toBeNull()

    Storage.prototype.setItem = original
  })
})
