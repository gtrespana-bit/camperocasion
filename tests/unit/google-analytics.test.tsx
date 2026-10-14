/**
 * Google Analytics solo puede medir con consentimiento y tiene que convivir con
 * la configuración por defecto de GA4 (medición mejorada): el componente no
 * envía `page_view` a mano, no carga gtag.js dos veces si el usuario acepta,
 * rechaza y vuelve a aceptar, y deja de medir al instante al retirar el
 * consentimiento o al entrar en /admin.
 */

import { render } from '@testing-library/react'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import {
  GA_COOKIE_EXPIRES_SECONDS,
  GA_ID_POR_DEFECTO,
  GA_SCRIPT_ID,
  claveDesactivar,
  idEntornoInvalido,
  medicionDesactivada,
  normalizarIdMedicion,
  resolverIdMedicion,
} from '@/lib/google-analytics'

let rutaActual = '/'
jest.mock('next/navigation', () => ({
  usePathname: () => rutaActual,
}))

const ID = 'G-TEST1234'

/** Órdenes encoladas en `dataLayer`, como arrays legibles. */
function ordenes(): unknown[][] {
  return (window.dataLayer || []).map((entrada) => Array.from(entrada as ArrayLike<unknown>))
}

function ordenesDe(tipo: string): unknown[][] {
  return ordenes().filter((orden) => orden[0] === tipo)
}

function scriptsGtag(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(`script#${GA_SCRIPT_ID}`))
}

beforeEach(() => {
  rutaActual = '/'
  document.head.innerHTML = ''
  delete window.dataLayer
  delete window.gtag
  delete (window as unknown as Record<string, unknown>)[claveDesactivar(ID)]
})

describe('normalizarIdMedicion', () => {
  it('acepta solo IDs de GA4 (G-…), con o sin espacios alrededor', () => {
    expect(normalizarIdMedicion('G-ABC123XYZ')).toBe('G-ABC123XYZ')
    expect(normalizarIdMedicion('  g-abc123xyz\n')).toBe('G-ABC123XYZ')
  })

  it('rechaza vacío, Universal Analytics y Tag Manager', () => {
    expect(normalizarIdMedicion(undefined)).toBeNull()
    expect(normalizarIdMedicion('')).toBeNull()
    expect(normalizarIdMedicion('UA-12345-1')).toBeNull()
    expect(normalizarIdMedicion('GTM-ABCD12')).toBeNull()
    expect(normalizarIdMedicion('G-')).toBeNull()
  })
})

describe('resolverIdMedicion', () => {
  it('la propiedad del proyecto es un ID de GA4 válido', () => {
    expect(normalizarIdMedicion(GA_ID_POR_DEFECTO)).toBe(GA_ID_POR_DEFECTO)
  })

  it('en producción, sin variable, mide con la propiedad del proyecto', () => {
    expect(resolverIdMedicion(undefined, true)).toBe(GA_ID_POR_DEFECTO)
    expect(resolverIdMedicion('', true)).toBe(GA_ID_POR_DEFECTO)
  })

  it('en desarrollo y tests, sin variable, no mide (no ensucia las estadísticas reales)', () => {
    expect(resolverIdMedicion(undefined, false)).toBeNull()
    expect(resolverIdMedicion('', false)).toBeNull()
  })

  it('la variable manda si trae un ID válido, en cualquier entorno', () => {
    expect(resolverIdMedicion('G-OTRA1234', true)).toBe('G-OTRA1234')
    expect(resolverIdMedicion(' g-otra1234 ', false)).toBe('G-OTRA1234')
  })

  it('"off" apaga la medición también en producción', () => {
    expect(resolverIdMedicion('off', true)).toBeNull()
    expect(resolverIdMedicion('OFF', true)).toBeNull()
    expect(idEntornoInvalido('off')).toBe(false)
  })

  it('un valor mal escrito (p. ej. el contenedor de Tag Manager) se ignora', () => {
    expect(resolverIdMedicion('GTM-K642HXJ3', true)).toBe(GA_ID_POR_DEFECTO)
    expect(resolverIdMedicion('GTM-K642HXJ3', false)).toBeNull()
    expect(idEntornoInvalido('GTM-K642HXJ3')).toBe(true)
    expect(idEntornoInvalido('')).toBe(false)
    expect(idEntornoInvalido('G-OTRA1234')).toBe(false)
  })
})

describe('GoogleAnalytics', () => {
  it('sin ID no carga nada ni toca dataLayer', () => {
    render(<GoogleAnalytics id={null} />)
    expect(scriptsGtag()).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
  })

  it('con consentimiento: declara consentimiento, configura sin publicidad y carga gtag.js', () => {
    render(<GoogleAnalytics id={ID} />)

    const [script] = scriptsGtag()
    expect(script).toBeDefined()
    expect(script.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(script.async).toBe(true)

    const [consentimiento] = ordenesDe('consent')
    expect(consentimiento).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ])

    const [config] = ordenesDe('config')
    expect(config[1]).toBe(ID)
    expect(config[2]).toEqual({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: GA_COOKIE_EXPIRES_SECONDS,
    })

    // La page_view inicial la manda `config`; la navegación SPA la registra la
    // medición mejorada de GA4. Enviar `page_view` a mano duplicaría datos.
    expect(ordenesDe('event')).toHaveLength(0)

    // El consentimiento tiene que ir ANTES de la configuración.
    const tipos = ordenes().map((orden) => orden[0])
    expect(tipos.indexOf('consent')).toBeLessThan(tipos.indexOf('config'))

    expect(medicionDesactivada(ID)).toBe(false)
  })

  it('encola objetos `arguments`, no arrays (gtag.js ignora los arrays)', () => {
    render(<GoogleAnalytics id={ID} />)
    for (const entrada of window.dataLayer || []) {
      expect(Object.prototype.toString.call(entrada)).toBe('[object Arguments]')
    }
  })

  it('no mide el panel admin, tampoco con prefijo de idioma', () => {
    rutaActual = '/en/admin/aprobacion'
    const { rerender } = render(<GoogleAnalytics id={ID} />)
    expect(medicionDesactivada(ID)).toBe(true)

    // Al salir del panel vuelve a medir sin recargar.
    rutaActual = '/catalogo'
    rerender(<GoogleAnalytics id={ID} />)
    expect(medicionDesactivada(ID)).toBe(false)

    rutaActual = '/admin'
    rerender(<GoogleAnalytics id={ID} />)
    expect(medicionDesactivada(ID)).toBe(true)
  })

  it('al retirar el consentimiento deja de medir, y al volver a aceptar no duplica nada', () => {
    const { unmount } = render(<GoogleAnalytics id={ID} />)
    expect(medicionDesactivada(ID)).toBe(false)

    // «Cambiar mi decisión» → RootClientEffects desmonta el componente.
    unmount()
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenesDe('consent').at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied' },
    ])

    // Vuelve a aceptar: se reactiva sin cargar gtag.js ni configurar otra vez
    // (una segunda `config` enviaría una page_view duplicada).
    render(<GoogleAnalytics id={ID} />)
    expect(scriptsGtag()).toHaveLength(1)
    expect(ordenesDe('config')).toHaveLength(1)
    expect(medicionDesactivada(ID)).toBe(false)
    expect(ordenesDe('consent').at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'granted' },
    ])
  })
})
