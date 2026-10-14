/**
 * Ejecuta el snippet que recibe el navegador, sin hidratar React ni esperar a
 * load/idle. La instalación debe ser temprana, pero Consent Mode sigue siendo
 * básico: ningún script de Google ni config hasta un consentimiento válido.
 */

import { render } from '@testing-library/react'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import GoogleAnalyticsScript from '@/components/GoogleAnalyticsScript'
import { crearScriptGoogleAnalytics } from '@/lib/google-analytics-bootstrap'
import {
  GA_COOKIE_EXPIRES_SECONDS,
  GA_ID_POR_DEFECTO,
  GA_NAVIGATION_EVENT,
  GA_SCRIPT_ID,
  claveDesactivar,
  idEntornoInvalido,
  medicionDesactivada,
  normalizarIdMedicion,
  resolverIdMedicion,
} from '@/lib/google-analytics'
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  guardarConsentimiento,
  reiniciarConsentimiento,
} from '@/lib/cookie-consent'
import { isAdminPath } from '@/lib/admin-path'

let rutaActual = '/'
jest.mock('next/navigation', () => ({
  usePathname: () => rutaActual,
}))

const ID = 'G-TEST1234'
let listeners: jest.SpyInstance

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

function arrancar() {
  // Mismo JavaScript que se entrega inline en el HTML, no una copia del runtime.
  window.eval(crearScriptGoogleAnalytics(ID))
}

function cambiarRuta(ruta: string) {
  rutaActual = ruta
  window.history.replaceState({}, '', ruta)
}

beforeEach(() => {
  cambiarRuta('/')
  window.localStorage.clear()
  document.head.innerHTML = ''
  delete window.dataLayer
  delete window.gtag
  delete (window as unknown as Record<string, unknown>).__camperocasionGA
  delete (window as unknown as Record<string, unknown>)[claveDesactivar(ID)]
  listeners = jest.spyOn(window, 'addEventListener')
})

afterEach(() => {
  // El snippet vive lo que dura el documento. Cada test simula un documento
  // nuevo, sin dejar listeners de consentimiento de la ejecución anterior.
  for (const [evento, handler, opciones] of listeners.mock.calls) {
    window.removeEventListener(evento, handler, opciones)
  }
  jest.restoreAllMocks()
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

describe('snippet del head (Consent Mode básico)', () => {
  it('sin ID o con un ID inválido no instala nada', () => {
    const { rerender } = render(<GoogleAnalyticsScript id={null} />)
    expect(document.querySelectorAll('script')).toHaveLength(0)
    rerender(<GoogleAnalyticsScript id="GTM-INVALID" />)
    expect(document.querySelectorAll('script')).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
    expect(crearScriptGoogleAnalytics('</script><script>alert(1)</script>')).toBe('')
  })

  it.each([null, 'rejected', 'true', 'invalid'])('sin permiso válido (%s) no descarga ni configura Google', (valor) => {
    if (valor) window.localStorage.setItem(CONSENT_KEY, valor)
    arrancar()

    expect(scriptsGtag()).toHaveLength(0)
    expect(ordenesDe('config')).toHaveLength(0)
    expect(ordenesDe('event')).toHaveLength(0)
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenes()).toEqual([[
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]])
  })

  it('con consentimiento guardado carga gtag inmediatamente, sin montar React ni esperar a load/idle', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    arrancar()

    const [script] = scriptsGtag()
    expect(script).toBeDefined()
    expect(script.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(script.async).toBe(true)
    expect(medicionDesactivada(ID)).toBe(false)
    expect(ordenesDe('consent').at(-1)).toEqual([
      'consent', 'update', { analytics_storage: 'granted' },
    ])
    expect(ordenesDe('config')).toEqual([[
      'config', ID, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_expires: GA_COOKIE_EXPIRES_SECONDS,
      },
    ]])
    // Denegado por defecto → permiso explícito → arranque → config, en ese orden.
    expect(ordenes().map((orden) => orden[0])).toEqual(['consent', 'consent', 'js', 'config'])
    // La page_view inicial sale de config; la SPA la mide GA4, sin duplicados.
    expect(ordenesDe('event')).toHaveLength(0)
  })

  it('aceptar en el banner activa la etiqueta sin esperas adicionales', () => {
    arrancar()
    expect(scriptsGtag()).toHaveLength(0)
    guardarConsentimiento('accepted')
    expect(scriptsGtag()).toHaveLength(1)
    expect(ordenesDe('config')).toHaveLength(1)
    expect(medicionDesactivada(ID)).toBe(false)
  })

  it('encola objetos arguments, no arrays (como exige gtag.js)', () => {
    arrancar()
    guardarConsentimiento('accepted')
    for (const entrada of window.dataLayer || []) {
      expect(Object.prototype.toString.call(entrada)).toBe('[object Arguments]')
    }
  })

  it('rechazar o reabrir las preferencias detiene GA de forma síncrona; reaceptar no duplica nada', () => {
    arrancar()
    guardarConsentimiento('accepted')
    guardarConsentimiento('rejected')
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenesDe('consent').at(-1)).toEqual([
      'consent', 'update', { analytics_storage: 'denied' },
    ])

    guardarConsentimiento('accepted')
    expect(medicionDesactivada(ID)).toBe(false)
    reiniciarConsentimiento()
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenesDe('consent').at(-1)).toEqual([
      'consent', 'update', { analytics_storage: 'denied' },
    ])

    guardarConsentimiento('accepted')
    guardarConsentimiento('accepted')
    expect(scriptsGtag()).toHaveLength(1)
    expect(ordenesDe('config')).toHaveLength(1)
    expect(medicionDesactivada(ID)).toBe(false)
  })

  it('si se retira el permiso mientras se descarga gtag, la cola y el interruptor quedan denegados', () => {
    arrancar()
    guardarConsentimiento('accepted')
    reiniciarConsentimiento()
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenes().at(-1)).toEqual([
      'consent', 'update', { analytics_storage: 'denied' },
    ])
  })

  it('sin almacenamiento funciona con permiso en memoria y falla cerrado antes de decidir', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(arrancar).not.toThrow()
    expect(scriptsGtag()).toHaveLength(0)
    guardarConsentimiento('accepted')
    expect(scriptsGtag()).toHaveLength(1)
    // La sincronización de rutas no pierde el permiso en memoria.
    window.dispatchEvent(new Event(GA_NAVIGATION_EVENT))
    expect(medicionDesactivada(ID)).toBe(false)
    reiniciarConsentimiento()
    expect(medicionDesactivada(ID)).toBe(true)
  })

  it('respeta cambios y borrados del consentimiento en otra pestaña', () => {
    arrancar()
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }))
    expect(scriptsGtag()).toHaveLength(1)
    expect(medicionDesactivada(ID)).toBe(false)

    window.localStorage.setItem(CONSENT_KEY, 'rejected')
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }))
    expect(medicionDesactivada(ID)).toBe(true)

    guardarConsentimiento('accepted')
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(medicionDesactivada(ID)).toBe(true)
    expect(ordenesDe('config')).toHaveLength(1)
  })

  it('un evento de consentimiento inválido nunca concede permiso', () => {
    arrancar()
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'true' }))
    expect(scriptsGtag()).toHaveLength(0)
    expect(medicionDesactivada(ID)).toBe(true)
  })

  it('repetir el snippet no crea listeners, scripts ni configuraciones duplicadas', () => {
    arrancar()
    guardarConsentimiento('accepted')
    const registrados = listeners.mock.calls.length
    const cantidadOrdenes = ordenes().length
    arrancar()
    expect(listeners.mock.calls).toHaveLength(registrados)
    expect(ordenes()).toHaveLength(cantidadOrdenes)
    expect(scriptsGtag()).toHaveLength(1)
    expect(ordenesDe('config')).toHaveLength(1)
  })
})

describe('navegación y exclusión del panel', () => {
  it.each(['/admin', '/admin/aprobacion', '/en/admin', '/es/admin/usuarios'])('no descarga Google inicialmente en %s aunque ya se haya aceptado', (ruta) => {
    cambiarRuta(ruta)
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    arrancar()
    expect(scriptsGtag()).toHaveLength(0)
    expect(ordenesDe('config')).toHaveLength(0)
    expect(medicionDesactivada(ID)).toBe(true)
  })

  it('aceptar desde admin tampoco carga Google; salir al sitio público sí', () => {
    cambiarRuta('/en/admin')
    arrancar()
    guardarConsentimiento('accepted')
    expect(scriptsGtag()).toHaveLength(0)

    const { rerender } = render(<GoogleAnalytics />)
    cambiarRuta('/catalogo')
    rerender(<GoogleAnalytics />)
    expect(scriptsGtag()).toHaveLength(1)
    expect(medicionDesactivada(ID)).toBe(false)

    cambiarRuta('/admin/aprobacion')
    rerender(<GoogleAnalytics />)
    expect(medicionDesactivada(ID)).toBe(true)
    cambiarRuta('/en/catalogo')
    rerender(<GoogleAnalytics />)
    expect(medicionDesactivada(ID)).toBe(false)
    expect(ordenesDe('config')).toHaveLength(1)
    expect(ordenesDe('event')).toHaveLength(0)
  })

  it.each(['/', '/catalogo', '/administracion', '/en/catalogo', '/es/admin/', '/en//admin/usuarios'])('la exclusión de %s coincide con isAdminPath', (ruta) => {
    cambiarRuta(ruta)
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    arrancar()
    expect(medicionDesactivada(ID)).toBe(isAdminPath(ruta))
  })

  it('navegar sin consentimiento nunca activa ni carga GA', () => {
    arrancar()
    const { rerender } = render(<GoogleAnalytics />)
    cambiarRuta('/catalogo')
    rerender(<GoogleAnalytics />)
    expect(scriptsGtag()).toHaveLength(0)
    expect(medicionDesactivada(ID)).toBe(true)
  })
})
