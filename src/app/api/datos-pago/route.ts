import { NextResponse } from 'next/server'

/**
 * Datos de pago para la compra de créditos (España).
 *
 * Los datos bancarios se configuran por variables de entorno para que nunca se
 * hardcodeen en el código.
 *
 * ⚠️ IMPORTANTE: antes, si una variable no existía, el endpoint devolvía un
 * valor de ejemplo *con aspecto de real* (`ES00 0000 …`, `600 000 000`,
 * `CaixaBank`). En producción eso significa que un vendedor que va a comprar
 * créditos ve un IBAN y un Bizum falsos: si paga, el dinero no llega a ninguna
 * parte, y la web queda como una estafa ante sus ojos.
 *
 * Ahora cada método viaja solo si está configurado, y el cliente oculta los que
 * no lo están (`configurado: false`). Si no hay ninguno, la página de créditos
 * muestra un aviso de "estamos terminando de configurar el pago" en lugar de
 * datos inventados.
 *
 * Variables (Vercel → Settings → Environment Variables):
 *   PAGO_RECEPTOR        → titular que aparece en las instrucciones
 *   PAGO_IBAN            → IBAN de la cuenta de cobro (transferencia)
 *   PAGO_BIZUM_TELEFONO  → teléfono de Bizum (sin espacios)
 *   PAGO_PAYPAL_EMAIL    → cuenta de PayPal
 * Opcionales:
 *   PAGO_BANCO           → nombre del banco (solo informativo)
 *   PAGO_INSTRUCCIONES   → nota extra para el comprador
 */
export const dynamic = 'force-dynamic'

type MetodoPago = {
  transferencia: { iban: string; banco?: string; receptor: string } | null
  bizum: { telefono: string; receptor: string } | null
  paypal: { email: string } | null
}

export async function GET() {
  const env = process.env
  const receptor = env.PAGO_RECEPTOR || 'CamperOcasión'

  const iban = (env.PAGO_IBAN || '').trim()
  const bizumTelefono = (env.PAGO_BIZUM_TELEFONO || '').replace(/\s+/g, '')
  const paypalEmail = (env.PAGO_PAYPAL_EMAIL || '').trim()

  const metodos: MetodoPago = {
    transferencia: iban
      ? { iban, banco: env.PAGO_BANCO || undefined, receptor }
      : null,
    bizum: bizumTelefono ? { telefono: bizumTelefono, receptor } : null,
    paypal: paypalEmail ? { email: paypalEmail } : null,
  }

  const configurado = {
    transferencia: metodos.transferencia !== null,
    bizum: metodos.bizum !== null,
    paypal: metodos.paypal !== null,
  }

  const nota = env.PAGO_INSTRUCCIONES || null

  return NextResponse.json({
    ...metodos,
    configurado,
    // true cuando al menos un método puede usarse de verdad
    algunoConfigurado: configurado.transferencia || configurado.bizum || configurado.paypal,
    nota,
  })
}
