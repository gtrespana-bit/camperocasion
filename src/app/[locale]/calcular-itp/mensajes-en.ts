import { normalizarEtiquetaDGT, type EntradaITP, type ResultadoITP } from '@/lib/itp'

// Text-only rendering of the same decision branches in calcularITP. Rates,
// thresholds, exemptions and amounts always come from the original result.
const scope: Record<string, string> = {
  'turismos y todoterrenos de más de 15 CV fiscales': 'passenger cars and off-road vehicles over 15 fiscal hp',
  'vehículos de más de 2.000 cc y vehículos históricos': 'vehicles over 2,000 cc and historic vehicles',
  'turismos y todoterrenos': 'passenger cars and off-road vehicles',
  'turismos y motocicletas': 'passenger cars and motorcycles',
  'vehículos no históricos': 'non-historic vehicles',
  'vehículos': 'vehicles',
}
export const vehicleScope = (value: string) => scope[value] || value

export function mensajesITPEn(r: ResultadoITP, entrada: EntradaITP) {
  const c = r.comunidad
  const cf = c.cuotaFija
  const ex = c.exencionPorAntiguedad
  const inc = c.tipoIncrementado
  const precio = Math.max(0, Number(entrada.precio) || 0)
  const valorTablas = Number(entrada.valorTablas) > 0 ? Number(entrada.valorTablas) : null
  const cc = Number(entrada.cilindrada) > 0 ? Number(entrada.cilindrada) : null
  const hp = Number(entrada.cvFiscales) > 0 ? Number(entrada.cvFiscales) : null
  const etiqueta = normalizarEtiquetaDGT(entrada.etiquetaDGT)

  const reglas = r.reglas.map(regla => {
    switch (regla.clave) {
      case 'depreciacion': return `Vehicle age: ${r.edadAnios} ${r.edadAnios === 1 ? 'year' : 'years'}; official depreciation coefficient: ${Math.round(r.coeficiente * 100)}%.`
      case 'base': return r.valorFiscal != null && r.valorFiscal >= precio
        ? `Taxable base: depreciated official value (€${r.valorFiscal}), higher than the agreed price (€${precio}).`
        : `Taxable base: agreed price (€${precio}), higher than the depreciated official value (€${r.valorFiscal}).`
      case 'exencion': return `${vehicleScope(ex?.aplicaA || '')} aged ${ex?.minAnios} years or more do not file ITP${ex?.valorMaximo ? ` if valued below €${ex.valorMaximo}` : ''}. Check the vehicle classification.`
      case 'cuotaFija': return r.cuotaFija
        ? `${vehicleScope(cf?.aplicaA || '')} aged ${cf?.minAnios} years or more with ${cc} cc: flat fee of €${r.cuota}${r.sinAutoliquidar ? ', with no filing required' : ''}. Check the vehicle classification.`
        : `Although the vehicle is at least ${cf?.minAnios} years old, the flat fee does not cover ${cc} cc; the general rate applies.`
      case 'ceroEmisiones': return `Zero-emissions DGT label: ${r.tipoAplicado}% rate${r.tipoAplicado === 0 ? ' (exempt)' : ''}.`
      case 'eco': return `ECO DGT label: reduced rate of ${r.tipoAplicado}%.`
      case 'tipoIncrementado': return `With ${inc?.masDeCVFiscales != null ? `${hp} fiscal hp` : `${cc} cc`}, the rate rises from ${c.tipo}% to ${r.tipoAplicado}% for ${vehicleScope(inc?.aplica || '')}.`
      case 'tipoIncrementadoNo': return inc?.masDeCVFiscales != null
        ? `${hp} fiscal hp does not exceed the ${inc.masDeCVFiscales} hp threshold: the ${c.tipo}% general rate applies.`
        : `${cc} cc does not exceed the ${inc?.masDeCc} cc threshold: the ${c.tipo}% general rate applies.`
      case 'tipoGeneral': return `General rate in ${c.nombre}: ${r.tipoAplicado}%.`
      default: return `Original rule (Spanish): ${regla.descripcion}`
    }
  })

  // Reproduce the order of notices from calcularITP so no caution disappears
  // when switching languages. A test checks notice counts across all regions.
  const avisos: string[] = []
  if (valorTablas == null) avisos.push('No official reference value entered: the estimate uses only the agreed price. If the depreciated official value is higher, the tax authority will use that value.')
  if (ex && r.edadAnios >= ex.minAnios && ex.valorMaximo != null && r.baseImponible >= ex.valorMaximo) {
    avisos.push(`The age requirement (${ex.minAnios} years) is met, but the declared value reaches the €${ex.valorMaximo} exemption limit.`)
  }
  if (r.cuotaFija && cf?.aplicaA && /turismo/i.test(cf.aplicaA)) {
    avisos.push('The flat fee is intended for passenger cars and off-road vehicles. For a dwelling (2448/3148) or mixed-use camper, check eligibility with the regional tax authority.')
  }
  if (cf && r.edadAnios >= cf.minAnios && cc == null && !r.sinAutoliquidar) {
    avisos.push(`In ${c.nombre}, vehicles aged ${cf.minAnios} years or more may qualify for an engine-size-based flat fee. Enter the engine size to check.`)
  }
  const rateByPercentage = !r.sinAutoliquidar && !r.cuotaFija
  const usedGeneralRate = r.reglas.some(regla => regla.clave === 'tipoGeneral')
  if (rateByPercentage && usedGeneralRate) {
    if (etiqueta == null && (c.tipoCeroEmisiones != null || c.tipoEco != null)) {
      avisos.push(`In ${c.nombre}, ${c.tipoCeroEmisiones != null ? `zero-emissions vehicles pay ${c.tipoCeroEmisiones}%` : ''}${c.tipoCeroEmisiones != null && c.tipoEco != null ? ' and ' : ''}${c.tipoEco != null ? `ECO vehicles pay ${c.tipoEco}%` : ''}. Enter the DGT label to check eligibility.`)
    }
    if (inc?.masDeCVFiscales != null && hp == null) {
      avisos.push(`In ${c.nombre}, the rate rises to ${inc.tipo}% for ${vehicleScope(inc.aplica)}. Enter fiscal horsepower from the registration certificate to check.`)
    } else if (inc?.masDeCc != null && cc == null) {
      avisos.push(`In ${c.nombre}, the rate rises to ${inc.tipo}% for ${vehicleScope(inc.aplica)}. Enter engine size from the technical document to check.`)
    }
  }
  if (r.sinAutoliquidar) avisos.push('Even if no tax is payable, keep the contract and proof of exemption or non-liability: the DGT may require them for the ownership transfer.')

  // If a new regulatory notice is added to the tax engine, keep the original
  // visible rather than silently omitting a potentially important warning.
  if (avisos.length !== r.avisos.length) return { reglas, avisos: r.avisos.map(text => `Original tax warning (Spanish): ${text}`) }
  return { reglas, avisos }
}
