/**
 * El banner de cookies es la ÚNICA puerta de entrada al consentimiento.
 *
 * En 2026-10 se detectó que `CookieConsent` existía pero no estaba montado en
 * ningún layout: nadie podía pulsar «Aceptar», `localStorage` nunca valía
 * 'accepted' y el Consent Mode de GA4 mantenía gtag.js descargado para siempre.
 * La web entera medía 0 visitas en Google Analytics (y en Vercel Analytics y
 * en AnaliticaVisitas). Estas pruebas fijan tanto el comportamiento del banner
 * como su montaje en el layout raíz, para que la regresión no vuelva a pasar
 * desapercibida: los tests del módulo `cookie-consent` pasaban mientras la web
 * no medía nada.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import CookieConsent from '@/components/CookieConsent'
import {
  CONSENT_KEY,
  CONSENT_REOPEN_EVENT,
  guardarConsentimiento,
  leerConsentimiento,
} from '@/lib/cookie-consent'

// next-intl/routing es ESM puro; defineRouting es la identidad sobre su config.
jest.mock('next-intl/routing', () => ({
  defineRouting: (config: unknown) => config,
}))

// Fuera de un router real, usePathname devuelve null y LocalLink revienta.
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

beforeEach(() => {
  window.localStorage.clear()
})

describe('banner de cookies', () => {
  it('sin decisión previa se muestra y ofrece aceptar y rechazar por igual', () => {
    render(<CookieConsent />)

    expect(screen.getByRole('dialog', { name: 'Cookies' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
  })

  it('con una decisión guardada no vuelve a estorbar', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    render(<CookieConsent />)

    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull()
  })

  it('«Aceptar» persiste el permiso y retira el aviso', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

    expect(leerConsentimiento()).toBe('accepted')
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('accepted')
    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull()
  })

  it('«Rechazar» persiste el rechazo y retira el aviso (rechazar es tan fácil como aceptar)', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(leerConsentimiento()).toBe('rejected')
    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull()
  })

  it('«Cambiar mi decisión» (evento de reapertura) vuelve a mostrar el aviso', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull()

    act(() => {
      window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))
    })

    expect(screen.getByRole('dialog', { name: 'Cookies' })).toBeInTheDocument()
    // Reabrir no debe decidir por el usuario.
    expect(leerConsentimiento()).toBe('accepted')
  })

  it('aceptar tras reabrir sobreescribe la decisión anterior', () => {
    guardarConsentimiento('rejected')
    render(<CookieConsent />)
    act(() => {
      window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

    expect(leerConsentimiento()).toBe('accepted')
  })
})

describe('montaje en el layout raíz', () => {
  /**
   * Guardián de cableado: sin este test, el banner puede dejar de montarse y
   * toda la suite sigue en verde (ya pasó). Se comprueba el código del layout
   * raíz porque renderizarlo entero arrastraría next/font y globals.css.
   */
  it('el layout raíz importa y renderiza CookieConsent', () => {
    const layout = readFileSync(join(__dirname, '../../src/app/layout.tsx'), 'utf8')

    expect(layout).toContain("import CookieConsent from '@/components/CookieConsent'")
    expect(layout).toContain('<CookieConsent />')
  })

  it('el aviso se sirve fuera del proveedor i18n (usa sus propios textos es/en)', () => {
    const banner = readFileSync(join(__dirname, '../../src/components/CookieConsent.tsx'), 'utf8')

    // Si alguien lo mueve dentro de [locale] y lo convierte a useTranslations,
    // este test recuerda que el componente se diseñó autocontenido.
    expect(banner).not.toMatch(/from ['"]next-intl/)
    expect(banner).not.toContain('useTranslations(')
    expect(banner).toContain("aceptar: 'Aceptar'")
    expect(banner).toContain("aceptar: 'Accept'")
  })
})
