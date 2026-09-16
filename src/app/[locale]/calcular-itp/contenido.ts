/**
 * Contenido editorial de la calculadora de ITP.
 *
 * Vive separado del componente para poder revisarlo sin tocar la lógica y para
 * reutilizarlo en las landings por comunidad. Todo lo que hay aquí es
 * explicación: los números salen siempre de `src/lib/itp.ts`.
 */

import { CCAA_CON_CUOTA_FIJA, TIPOS_ITP } from '@/lib/itp'

export interface SeccionCalculadora {
  titulo: string
  parrafos: string[]
  puntos?: string[]
}

export const SECCIONES_CALCULADORA: SeccionCalculadora[] = [
  {
    titulo: 'Cómo se calcula (y por qué no es el precio que pactas)',
    parrafos: [
      'El ITP se calcula sobre la base imponible, que es el MAYOR de dos cantidades: el precio que figura en el contrato y el valor fiscal del vehículo según las tablas oficiales de Hacienda, una vez aplicado el coeficiente de depreciación por antigüedad (del 100 % para un vehículo de menos de un año al 10 % a partir de los 12).',
      'Es el error más caro de la compraventa entre particulares: si compras una camper por 18.000 € y el valor de tablas depreciado es 24.000 €, Hacienda liquidará sobre 24.000 €.',
    ],
  },
  {
    titulo: 'Cuota fija: las comunidades que perdonan (casi) el impuesto a los antiguos',
    parrafos: [
      `En varias comunidades los vehículos con más de 10 o 12 años no pagan un porcentaje, sino una cuota fija por tramos de cilindrada: ${CCAA_CON_CUOTA_FIJA.slice(0, -1).join(', ')} y ${CCAA_CON_CUOTA_FIJA.slice(-1)}.`,
      'En el mejor de los casos la cuota es de 0 € y ni siquiera hay que presentar autoliquidación. Navarra y Cataluña van más lejos y eximen a los vehículos de más de 10 años (con límites de valor).',
      'Ojo con el matiz camper: esas cuotas suelen estar redactadas para "turismos y todoterrenos". En un vehículo vivienda conviene confirmar el encuadre con la hacienda autonómica.',
    ],
  },
  {
    titulo: 'Qué más cuesta poner la camper a tu nombre',
    parrafos: [
      'Además del ITP hay que contar con la tasa de cambio de titularidad de la DGT (55,70 €) y, si se hace por gestoría, su honorario.',
      'Y si compras a un profesional (concesionario o compraventa), el ITP no se paga: la operación tributa por IVA o por el régimen especial de bienes usados (REBU), que se repercute en factura.',
    ],
  },
]

export interface FaqCalculadora {
  pregunta: string
  respuesta: string
}

export const CALCULADORA_FAQ: FaqCalculadora[] = [
  {
    pregunta: '¿Quién paga el ITP al comprar una camper de segunda mano?',
    respuesta:
      'El comprador. El impuesto se autoliquida en la comunidad autónoma donde reside el comprador (no donde vive el vendedor ni donde se firma), y sin el justificante la DGT no cambia la titularidad. Se paga con el modelo 620 (o 621 en algunas comunidades como Andalucía).',
  },
  {
    pregunta: '¿Se paga ITP al comprar una camper a un concesionario o a un profesional?',
    respuesta:
      'No. Si el vendedor es un profesional que emite factura, la operación tributa por IVA (21 %) o por el régimen especial de bienes usados (REBU), que se aplica solo al margen de beneficio y suele salir bastante mejor. El ITP es exclusivo de las compraventas entre particulares.',
  },
  {
    pregunta: '¿Cuánto se paga de ITP por una autocaravana o camper?',
    respuesta:
      'Depende de la comunidad y del valor del vehículo. El tipo general va del 3 % de Galicia al 6 % de Cantabria, Castilla-La Mancha, Comunitat Valenciana y Extremadura, y varias comunidades lo suben al 8 % para vehículos de más de 15 CV fiscales o más de 2.000 cc, un umbral que muchas autocaravanas superan. Además, hay cuotas fijas muy reducidas para vehículos antiguos.',
  },
  {
    pregunta: '¿El vehículo vivienda (2448/3148) tiene un ITP distinto?',
    respuesta:
      'La homologación no cambia el tipo del ITP (se tributa como vehículo), pero sí puede cambiar el encuadre en las comunidades que aplican cuotas fijas por tramos de cilindrada a "turismos y todoterrenos": conviene confirmarlo con la hacienda autonómica. Lo que sí importa es que la ficha técnica declare lo que el anuncio promete: un furgón sin homologar no se puede usar ni vender como vivienda.',
  },
  {
    pregunta: '¿Puedo pagar menos declarando un precio inferior?',
    respuesta:
      'No sirve de nada: si el precio declarado es inferior al valor de las tablas de Hacienda depreciado por antigüedad, la administración liquidará sobre el valor de tablas. Declarar menos solo añade el riesgo de una liquidación con recargos.',
  },
  {
    pregunta: '¿Cuánto tiempo tengo para pagar el ITP?',
    respuesta:
      'El plazo varía por comunidad: un mes en la mayoría, dos meses en Andalucía y Navarra, y 30 días hábiles en Madrid, Asturias, Cantabria, Castilla y León, La Rioja, Murcia y País Vasco. Pasado el plazo se paga un recargo por presentación tardía.',
  },
  {
    pregunta: '¿Hace falta el ITP para cambiar el nombre en la DGT?',
    respuesta:
      'Sí. El cambio de titularidad no se tramita sin el justificante de autoliquidación del ITP. En las comunidades donde el vehículo antiguo está exento o con cuota cero, hay que presentar la declaración de no sujeción o el justificante correspondiente.',
  },
]

/** Preguntas específicas de cada comunidad, generadas con los datos del registro. */
export function faqComunidad(slug: string): FaqCalculadora[] {
  const c = TIPOS_ITP.find(x => x.slug === slug)
  if (!c) return CALCULADORA_FAQ.slice(0, 3)

  const preguntas: FaqCalculadora[] = [
    {
      pregunta: `¿Cuánto es el ITP de un vehículo de segunda mano en ${c.nombre}?`,
      respuesta: c.tipoIncrementado
        ? `El tipo general es del ${c.tipo} % y sube al ${c.tipoIncrementado.tipo} % para ${c.tipoIncrementado.aplica}. Se aplica sobre la mayor de estas dos cantidades: el precio del contrato o el valor de tablas de Hacienda depreciado por antigüedad.`
        : `El tipo general es del ${c.tipo} %, y se aplica sobre la mayor de estas dos cantidades: el precio del contrato o el valor de tablas de Hacienda depreciado por antigüedad.`,
    },
  ]

  if (c.cuotaFija) {
    preguntas.push({
      pregunta: `¿Cuánto paga un vehículo de más de ${c.cuotaFija.minAnios} años en ${c.nombre}?`,
      respuesta: `En lugar del porcentaje se aplica una cuota fija según cilindrada (${c.cuotaFija.tramos
        .filter(t => t.cuota > 0 || t.sinAutoliquidar)
        .map(t => `${t.cuota} €${t.sinAutoliquidar ? ' (sin autoliquidar)' : ''}${t.hastaCc === Infinity ? ' o más' : ` hasta ${t.hastaCc} cc`}`)
        .join(', ')}). Se refiere a ${c.cuotaFija.aplicaA}${c.cuotaFija.valorMaximo ? ` y a valores por debajo de ${c.cuotaFija.valorMaximo} €` : ''}.`,
    })
  }

  if (c.exencionPorAntiguedad) {
    preguntas.push({
      pregunta: `¿Hay que pagar ITP por un vehículo de más de ${c.exencionPorAntiguedad.minAnios} años en ${c.nombre}?`,
      respuesta: `No: ${c.exencionPorAntiguedad.aplicaA} con ${c.exencionPorAntiguedad.minAnios} años o más no autoliquidan el ITP${c.exencionPorAntiguedad.valorMaximo ? `, siempre que su valor quede por debajo de ${c.exencionPorAntiguedad.valorMaximo} €` : ''}. Aun así conviene guardar el contrato, porque la DGT pide justificante para el cambio de nombre.`,
    })
  }

  preguntas.push({
    pregunta: `¿Qué modelo y plazo hay en ${c.nombre}?`,
    respuesta: `Se presenta el modelo ${c.modelo} en el plazo de ${c.plazoDias} ${c.plazoDiasHabiles ? 'días hábiles' : 'días'} desde la firma del contrato. La autoliquidación se hace ante ${c.fuente ? 'la sede tributaria de la comunidad' : 'la hacienda autonómica'} (enlace en esta página).`,
  })

  if (c.tipoCeroEmisiones != null) {
    preguntas.push({
      pregunta: `¿Hay bonificación para vehículos eléctricos en ${c.nombre}?`,
      respuesta: c.tipoCeroEmisiones === 0
        ? `Sí: los vehículos con distintivo ambiental cero emisiones tributan al 0 %.${c.tipoEco != null ? ` Los de distintivo ECO pagan el ${c.tipoEco} %.` : ''}`
        : `Sí: los vehículos con distintivo cero emisiones tributan al ${c.tipoCeroEmisiones} % en lugar del ${c.tipo} % general, presentando el distintivo de la DGT.`,
    })
  }

  return preguntas
}
