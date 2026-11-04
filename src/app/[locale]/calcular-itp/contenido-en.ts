import type { FaqCalculadora, SeccionCalculadora } from './contenido'

// English editorial explanations of the same Spanish tax rules. The amounts,
// regions, thresholds and dates continue to come from src/lib/itp.ts.
export const SECCIONES_CALCULADORA_EN: SeccionCalculadora[] = [
  {
    titulo: 'How the tax is calculated (and why it may not be your agreed price)',
    parrafos: [
      'The taxable base is the HIGHER of the contract price and the official reference value for the vehicle after applying the age-based depreciation coefficient. The coefficient ranges from 100% for vehicles under one year old to 10% after 12 years.',
      'For example, if you pay €18,000 for a camper but its depreciated official reference value is €24,000, the taxable base will be €24,000.',
    ],
  },
  {
    titulo: 'Older vehicles: flat fees and exemptions',
    parrafos: [
      'Some autonomous communities use an engine-size-based flat fee rather than a percentage for vehicles over 10 or 12 years old. Others exempt qualifying older vehicles, sometimes subject to value limits.',
      'These rules often refer specifically to passenger cars and off-road vehicles. For a camper registered as a dwelling vehicle, confirm its classification with the relevant regional tax authority before relying on a flat fee or exemption.',
    ],
  },
  {
    titulo: 'Other costs when transferring ownership',
    parrafos: [
      'In addition to ITP, budget for the DGT vehicle transfer fee (€55.70 in the tax year shown here) and any administrative service fees.',
      'If you buy from a professional seller who issues an invoice, ITP generally does not apply. The sale is instead subject to VAT or the special scheme for used goods (REBU).',
    ],
  },
]

export const CALCULADORA_FAQ_EN: FaqCalculadora[] = [
  {
    pregunta: 'Who pays ITP when buying a used camper?',
    respuesta: 'The buyer pays and files the tax in the autonomous community where they live, not where the seller lives. Proof of filing is normally needed before the DGT can transfer the vehicle. The applicable tax form is usually Modelo 620, or Modelo 621 in some regions.',
  },
  {
    pregunta: 'Is ITP due when buying from a dealer or professional?',
    respuesta: 'No ITP is due on a sale invoiced by a professional seller. VAT or the special VAT scheme for used goods (REBU) applies instead. ITP generally covers sales between private individuals.',
  },
  {
    pregunta: 'How much ITP is payable on a campervan or motorhome?',
    respuesta: 'It depends on the buyer’s region, the vehicle value and any applicable special rules. Some regions have higher rates above a fiscal-horsepower or engine-size threshold, while others use flat fees for qualifying older vehicles. Enter the details in the calculator and verify the result with the regional tax authority.',
  },
  {
    pregunta: 'Does a dwelling-vehicle classification (2448/3148) change the tax?',
    respuesta: 'The classification does not automatically change the general ITP rate. It may, however, affect eligibility for flat-fee rules that explicitly cover passenger cars and off-road vehicles. Confirm the vehicle’s classification and the regional rule with the tax authority.',
  },
  {
    pregunta: 'Can I pay less by declaring a lower purchase price?',
    respuesta: 'Declaring a lower price does not reduce the taxable base when the depreciated official reference value is higher. Understating the agreed price may also result in an additional assessment and charges.',
  },
  {
    pregunta: 'How long do I have to file and pay ITP?',
    respuesta: 'Deadlines vary by region. Check the deadline shown for your community and confirm it on its official tax website. Late filing can lead to additional charges.',
  },
  {
    pregunta: 'Do I need proof of ITP filing to transfer ownership with the DGT?',
    respuesta: 'Yes. Even if an exemption or zero-fee rule applies, keep the contract and any filing or non-liability document required for the DGT ownership transfer.',
  },
]

import { getComunidadITP, type ComunidadITP } from '@/lib/itp'

export function plazoITPEn(c: ComunidadITP) {
  // Andalucía and Navarra define the period as two months, not sixty calendar days.
  if (c.plazoDias === 60 && !c.plazoDiasHabiles) return 'two months'
  return `${c.plazoDias} ${c.plazoDiasHabiles ? 'business days' : 'days'}`
}
import { vehicleScope } from './mensajes-en'

/** The English FAQ uses the same registry fields as the Spanish one. */
export function faqComunidadEn(slug: string): FaqCalculadora[] {
  const c = getComunidadITP(slug)
  if (!c) return CALCULADORA_FAQ_EN.slice(0, 3)
  const faq: FaqCalculadora[] = [{
    pregunta: `What ITP rate applies to a used vehicle in ${c.nombre}?`,
    respuesta: `The general rate is ${c.tipo}%${c.tipoIncrementado ? ` and rises to ${c.tipoIncrementado.tipo}% for ${vehicleScope(c.tipoIncrementado.aplica)}` : ''}. The taxable base is the higher of the agreed contract price and the depreciated official reference value.`,
  }]
  if (c.cuotaFija) faq.push({
    pregunta: `Is there a flat fee for vehicles over ${c.cuotaFija.minAnios} years old in ${c.nombre}?`,
    respuesta: `A flat fee may apply to ${vehicleScope(c.cuotaFija.aplicaA)} aged ${c.cuotaFija.minAnios} years or more, depending on engine size${c.cuotaFija.valorMaximo ? ` and a value below €${c.cuotaFija.valorMaximo}` : ''}. Confirm whether your camper's registered classification qualifies with the regional tax authority.`,
  })
  if (c.exencionPorAntiguedad) faq.push({
    pregunta: `Are older vehicles exempt from ITP in ${c.nombre}?`,
    respuesta: `${vehicleScope(c.exencionPorAntiguedad.aplicaA)} aged ${c.exencionPorAntiguedad.minAnios} years or more may be exempt${c.exencionPorAntiguedad.valorMaximo ? ` if valued below €${c.exencionPorAntiguedad.valorMaximo}` : ''}. Keep any documents needed for the DGT ownership transfer.`,
  })
  faq.push({
    pregunta: `Which form and filing deadline apply in ${c.nombre}?`,
    respuesta: `Use form ${c.modelo}. The listed filing period is ${plazoITPEn(c)} after signing the contract. Confirm the deadline and vehicle classification with the regional tax authority linked on this page.`,
  })
  if (c.tipoCeroEmisiones != null) faq.push({
    pregunta: `Is there a reduced rate for zero-emissions vehicles in ${c.nombre}?`,
    respuesta: `Vehicles with the DGT zero-emissions label have a listed rate of ${c.tipoCeroEmisiones}%${c.tipoEco != null ? `; ECO-labelled vehicles have a listed rate of ${c.tipoEco}%` : ''}. Check eligibility and required documentation with the regional tax authority.`,
  })
  return faq
}
