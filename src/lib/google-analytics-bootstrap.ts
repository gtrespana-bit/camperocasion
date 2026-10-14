import {
  CONSENT_EVENT,
  CONSENT_KEY,
  CONSENT_REOPEN_EVENT,
} from '@/lib/cookie-consent'
import {
  GA_COOKIE_EXPIRES_SECONDS,
  GA_NAVIGATION_EVENT,
  GA_SCRIPT_ID,
  claveDesactivar,
  normalizarIdMedicion,
} from '@/lib/google-analytics'

/**
 * Snippet propio, incluido en el HTML inicial del <head>, no en un chunk lazy.
 * Así puede arrancar incluso antes de hidratar React si ya hay consentimiento.
 *
 * Consent Mode básico: SIN permiso no se descarga gtag.js, no se configura GA
 * ni se envían pings sin cookies. El snippet solo prepara la cola y escucha el
 * banner. No sustituirlo por un <script src> incondicional para pasar el test
 * automático de Google: ese comprobador puede no aceptar cookies.
 *
 * El código es JavaScript autocontenido, sin dependencias del bundle cliente.
 * Solo se interpolan constantes y un ID validado, serializados como JSON.
 */
export function crearScriptGoogleAnalytics(valor: string): string {
  const id = normalizarIdMedicion(valor)
  if (!id) return ''

  return `(function () {
  if (window.__camperocasionGA) return;
  window.__camperocasionGA = true;

  var disableKey = ${JSON.stringify(claveDesactivar(id))};
  var consentKey = ${JSON.stringify(CONSENT_KEY)};
  var scriptId = ${JSON.stringify(GA_SCRIPT_ID)};
  var accepted = false;
  var active = false;
  var configured = false;

  window[disableKey] = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var gtag = window.gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function readConsent() {
    try { return window.localStorage.getItem(consentKey) === 'accepted'; }
    catch (_) { return false; }
  }

  function sync() {
    // Mismas rutas que isAdminPath: /admin, /es/admin y /en/admin.
    var segments = window.location.pathname.split('/').filter(Boolean);
    var offset = segments[0] === 'en' || segments[0] === 'es' ? 1 : 0;
    var enabled = accepted && segments[offset] !== 'admin';
    window[disableKey] = !enabled;
    if (active === enabled) return;
    active = enabled;

    gtag('consent', 'update', {
      analytics_storage: enabled ? 'granted' : 'denied'
    });
    if (!enabled || configured) return;
    configured = true;

    gtag('js', new Date());
    gtag('config', ${JSON.stringify(id)}, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: ${GA_COOKIE_EXPIRES_SECONDS}
    });

    if (!document.getElementById(scriptId)) {
      var script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = ${JSON.stringify(`https://www.googletagmanager.com/gtag/js?id=${id}`)};
      document.head.appendChild(script);
    }
  }

  window.addEventListener(${JSON.stringify(CONSENT_EVENT)}, function (event) {
    accepted = event.detail === 'accepted';
    sync();
  });
  window.addEventListener(${JSON.stringify(CONSENT_REOPEN_EVENT)}, function () {
    accepted = false;
    sync();
  });
  window.addEventListener('storage', function (event) {
    if (event.key === consentKey || event.key === null) {
      accepted = readConsent();
      sync();
    }
  });
  window.addEventListener(${JSON.stringify(GA_NAVIGATION_EVENT)}, sync);

  accepted = readConsent();
  sync();
})();`
}
