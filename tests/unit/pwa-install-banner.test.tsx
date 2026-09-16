/**
 * Regression tests para PWAInstallBanner.
 *
 * Antes, el handler de beforeinstallprompt llamaba preventDefault() SIEMPRE,
 * incluso cuando el banner no se iba a mostrar (usuario ya instaló o está en
 * cooldown tras un dismiss). Eso provocaba en la consola de Chrome:
 *   "Banner not shown: beforeinstallpromptevent.preventDefault() called.
 *    The page must call beforeinstallpromptevent.prompt() to show the banner."
 *
 * Regla: solo interceptar (preventDefault) si realmente vamos a mostrar
 * nuestro banner y llamar prompt() cuando el usuario pulse "Instalar".
 */
import { render, act, fireEvent, screen } from '@testing-library/react'
import PWAInstallBanner from '@/components/PWAInstallBanner'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as any
}

function dispatchBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  mockMatchMedia(false) // no está en modo standalone
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

test('intercepta el evento y muestra el banner cuando no hay cooldown', () => {
  render(<PWAInstallBanner />)
  let event: Event = new Event('beforeinstallprompt')
  act(() => {
    event = dispatchBeforeInstallPrompt()
  })
  expect(event.defaultPrevented).toBe(true)
  expect(screen.getByText('pwa.installButton')).toBeInTheDocument()
})

test('NO intercepta el evento durante el cooldown tras un dismiss', () => {
  localStorage.setItem('pwa_install_dismissed', Date.now().toString())
  render(<PWAInstallBanner />)
  let event: Event = new Event('beforeinstallprompt')
  act(() => {
    event = dispatchBeforeInstallPrompt()
  })
  expect(event.defaultPrevented).toBe(false)
  expect(screen.queryByText('pwa.installButton')).not.toBeInTheDocument()
})

test('NO intercepta el evento si el usuario ya instaló (flag "installed")', () => {
  localStorage.setItem('pwa_install_dismissed', 'installed')
  render(<PWAInstallBanner />)
  let event: Event = new Event('beforeinstallprompt')
  act(() => {
    event = dispatchBeforeInstallPrompt()
  })
  expect(event.defaultPrevented).toBe(false)
  expect(screen.queryByText('pwa.installButton')).not.toBeInTheDocument()
})

test('migra el flag legacy "1" (instalación aceptada) a "installed"', () => {
  localStorage.setItem('pwa_install_dismissed', '1')
  render(<PWAInstallBanner />)
  expect(localStorage.getItem('pwa_install_dismissed')).toBe('installed')
})

test('tras un dismiss, el siguiente beforeinstallprompt no se intercepta', () => {
  render(<PWAInstallBanner />)
  act(() => {
    dispatchBeforeInstallPrompt()
  })
  fireEvent.click(screen.getByLabelText('pwa.closeBanner'))

  let event: Event = new Event('beforeinstallprompt')
  act(() => {
    event = dispatchBeforeInstallPrompt()
  })
  expect(event.defaultPrevented).toBe(false)
  expect(screen.queryByText('pwa.installButton')).not.toBeInTheDocument()
})

test('no hace nada en modo standalone (display-mode: standalone)', () => {
  mockMatchMedia(true)
  render(<PWAInstallBanner />)
  let event: Event = new Event('beforeinstallprompt')
  act(() => {
    event = dispatchBeforeInstallPrompt()
  })
  expect(event.defaultPrevented).toBe(false)
  expect(screen.queryByText('pwa.installButton')).not.toBeInTheDocument()
})

test('al aceptar la instalación marca "installed" y no vuelve a preguntar', async () => {
  render(<PWAInstallBanner />)

  // Simular beforeinstallprompt con prompt()/userChoice mockeados
  const promptSpy = jest.fn().mockResolvedValue(undefined)
  const evt = new Event('beforeinstallprompt', { cancelable: true })
  ;(evt as any).prompt = promptSpy
  ;(evt as any).userChoice = Promise.resolve({ outcome: 'accepted' })
  act(() => {
    window.dispatchEvent(evt)
  })

  expect(evt.defaultPrevented).toBe(true)
  fireEvent.click(screen.getByText('pwa.installButton'))
  await act(async () => {
    await Promise.resolve() // resolver userChoice
  })

  expect(promptSpy).toHaveBeenCalled()
  expect(localStorage.getItem('pwa_install_dismissed')).toBe('installed')
  expect(screen.queryByText('pwa.installButton')).not.toBeInTheDocument()
})
