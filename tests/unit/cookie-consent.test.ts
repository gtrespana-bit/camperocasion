/**
 * El banner de cookies tiene que servir para algo.
 *
 * Antes guardaba la elección y nadie la leía: la analítica se cargaba también
 * para quien pulsaba «Rechazar». Estas pruebas fijan el contrato del módulo que
 * leen tanto el banner como `RootClientEffects`.
 */

import {
  CONSENT_EVENT,
  CONSENT_KEY,
  CONSENT_REOPEN_EVENT,
  alCambiarConsentimiento,
  guardarConsentimiento,
  leerConsentimiento,
  reiniciarConsentimiento,
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
    const visto: Array<string | null> = []
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

describe('retirada y sincronización del consentimiento', () => {
  it('Cambiar mi decisión avisa a todos los consumidores antes de volver a aceptar', () => {
    guardarConsentimiento('accepted')
    const cambios = jest.fn()
    const reabrir = jest.fn()
    const dejarDeEscuchar = alCambiarConsentimiento(cambios)
    window.addEventListener(CONSENT_REOPEN_EVENT, reabrir)

    reiniciarConsentimiento()

    expect(leerConsentimiento()).toBeNull()
    expect(cambios).toHaveBeenCalledWith(null)
    expect(reabrir).toHaveBeenCalledTimes(1)
    dejarDeEscuchar()
    window.removeEventListener(CONSENT_REOPEN_EVENT, reabrir)
  })

  it('notifica cambios y borrados en otra pestaña, pero ignora otras claves', () => {
    const cambios = jest.fn()
    const dejarDeEscuchar = alCambiarConsentimiento(cambios)

    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }))
    expect(cambios).toHaveBeenLastCalledWith('accepted')

    window.localStorage.setItem(CONSENT_KEY, 'rejected')
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }))
    expect(cambios).toHaveBeenLastCalledWith('rejected')

    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(cambios).toHaveBeenLastCalledWith(null)

    window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }))
    expect(cambios).toHaveBeenCalledTimes(3)
    dejarDeEscuchar()
  })

  it('un evento inválido se trata como falta de consentimiento', () => {
    const cambios = jest.fn()
    const dejarDeEscuchar = alCambiarConsentimiento(cambios)
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'true' }))
    expect(cambios).toHaveBeenCalledWith(null)
    dejarDeEscuchar()
  })

  it('al desuscribirse elimina todos los listeners', () => {
    const cambios = jest.fn()
    const dejarDeEscuchar = alCambiarConsentimiento(cambios)
    dejarDeEscuchar()

    guardarConsentimiento('accepted')
    reiniciarConsentimiento()
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }))
    expect(cambios).not.toHaveBeenCalled()
  })
})
