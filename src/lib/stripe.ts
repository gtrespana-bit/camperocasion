/**
 * Cliente de Stripe (solo servidor).
 *
 * NUNCA importar desde un componente cliente: `STRIPE_SECRET_KEY` es secreta.
 *
 * Variables (Vercel → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY      sk_live_… / sk_test_…  (secreta)
 *   STRIPE_WEBHOOK_SECRET  whsec_…               (secreta, la da el endpoint del webhook)
 *
 * Si no están configuradas, `getStripe()` devuelve null y la web sigue
 * funcionando con el circuito manual (Bizum/transferencia/PayPal). Así el
 * despliegue nunca se rompe por una variable que falte.
 */
import Stripe from 'stripe'

let cached: Stripe | null = null

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe | null {
  if (!stripeConfigurado()) return null
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      // Sin fijar apiVersion: usamos la versión de la cuenta, que es la que
      // el dashboard muestra y la que Stripe mantiene al día.
      typescript: true,
      appInfo: { name: 'CamperOcasion', url: 'https://camperocasion.online' },
    })
  }
  return cached
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

/** URL pública del sitio, para construir success_url / cancel_url. */
export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://camperocasion.online'
  return url.replace(/\/$/, '')
}
