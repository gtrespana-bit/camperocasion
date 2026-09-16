import { NextResponse } from 'next/server'

/**
 * Datos de pago para la compra de créditos (España).
 *
 * Los datos bancarios se configuran por variables de entorno para que nunca
 * se hardcodeen en el cliente. Si una variable no existe se devuelven valores
 * de ejemplo claramente marcados (el admin debe configurarlas).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const env = process.env

  const transferencia = {
    iban: env.PAGO_IBAN || 'ES00 0000 0000 0000 0000 0000 00',
    banco: env.PAGO_BANCO || 'CaixaBank',
    receptor: env.PAGO_RECEPTOR || 'CamperOcasión SL',
  }

  const bizum = {
    telefono: env.PAGO_BIZUM_TELEFONO || '600 000 000',
    receptor: env.PAGO_RECEPTOR || 'CamperOcasión SL',
  }

  const paypal = {
    email: env.PAGO_PAYPAL_EMAIL || 'pagos@camperocasion.online',
  }

  return NextResponse.json({
    transferencia,
    bizum,
    paypal,
    // Compatibilidad con clientes antiguos
    pagoMovil: bizum,
  })
}
