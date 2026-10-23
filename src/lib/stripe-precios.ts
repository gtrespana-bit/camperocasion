/**
 * Productos y precios de los packs en Stripe.
 *
 * Antes el checkout creaba el precio al vuelo con `price_data`. Funciona para
 * un cobro suelto, pero deja un precio nuevo (y un producto nuevo) por cada
 * intento, impide cambiar de plan sin cancelar y ensucia las facturas.
 *
 * Aquí se usan precios con `lookup_key` estable:
 *   camperocasion_<plan>_<mensual|anual>
 * La primera vez se crean; después se reutilizan. Así el portal de cliente,
 * los cambios de plan y la contabilidad ven siempre el mismo producto.
 */
import type Stripe from 'stripe'
import { getPlanDef, precioPlan, type Periodicidad, type PlanPago } from '@/lib/planes-anuncios'

export function clavePrice(plan: PlanPago, periodicidad: Periodicidad): string {
  return `camperocasion_${plan}_${periodicidad}`
}

/** Devuelve el Price de Stripe del pack, creándolo si es la primera vez. */
export async function obtenerPrecioPlan(
  stripe: Stripe,
  plan: PlanPago,
  periodicidad: Periodicidad,
): Promise<Stripe.Price> {
  const lookup_key = clavePrice(plan, periodicidad)

  const existentes = await stripe.prices.list({
    lookup_keys: [lookup_key],
    active: true,
    limit: 1,
  })
  if (existentes.data[0]) {
    // Los precios creados antes de decidir el IVA quedaron como
    // `unspecified`. Los packs se venden con IVA incluido y Stripe permite
    // pasar de `unspecified` a `inclusive`, pero **no** de `exclusive` a
    // `inclusive`. Si no se puede actualizar, se crea un precio nuevo con el
    // mismo `lookup_key` (se transfiere) para no vender con IVA por encima.
    const precio = existentes.data[0]
    if (precio.tax_behavior === 'inclusive') return precio

    try {
      return await stripe.prices.update(precio.id, { tax_behavior: 'inclusive' })
    } catch {
      const productoId =
        typeof precio.product === 'string' ? precio.product : precio.product.id
      return stripe.prices.create({
        product: productoId,
        currency: precio.currency,
        unit_amount:
          precio.unit_amount ?? Math.round(precioPlan(plan, periodicidad) * 100),
        recurring: {
          interval: precio.recurring?.interval ?? (periodicidad === 'anual' ? 'year' : 'month'),
          interval_count: precio.recurring?.interval_count ?? 1,
        },
        lookup_key,
        transfer_lookup_key: true,
        tax_behavior: 'inclusive',
        metadata: { plan, periodicidad },
      })
    }
  }

  const def = getPlanDef(plan)
  if (!def) throw new Error(`Pack desconocido: ${plan}`)

  const producto = await stripe.products.create({
    name: `CamperOcasión ${def.nombre}`,
    description: `${def.eslogan}. ${def.paraQuien}.`,
    metadata: { plan, tipo: 'plan' },
  })

  const precio = await stripe.prices.create({
    product: producto.id,
    currency: 'eur',
    unit_amount: Math.round(precioPlan(plan, periodicidad) * 100),
    recurring: { interval: periodicidad === 'anual' ? 'year' : 'month' },
    lookup_key,
    // Precio final para el cliente: 19 € ya llevan IVA. Stripe lo
    // desglosa en la factura sin sumarlo por encima.
    tax_behavior: 'inclusive',
    metadata: { plan, periodicidad },
  })

  return precio
}
