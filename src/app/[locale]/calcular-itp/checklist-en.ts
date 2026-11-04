import type { ItemChecklist } from '@/lib/itp'

// Short explanations of the same documentary checks used in the Spanish
// purchase checklist; no tax amounts or eligibility rules are altered here.
export const CHECKLIST_CAMPER_EN: ItemChecklist[] = [
  { titulo: 'Declared vehicle classification', detalle: 'Check that the technical document lists the classification claimed in the advert (for example, dwelling vehicle 2448/3148 rather than van 2400).', donde: 'Vehicle technical document, classification field' },
  { titulo: 'Travel and sleeping places', detalle: 'Check approved passenger seats and any recorded conversions. Changes to seat installations must be properly documented.', donde: 'Technical document and modification records' },
  { titulo: 'Maximum authorised mass and driving licence', detalle: 'Check the maximum authorised mass and the licence needed for the particular vehicle; insurance and inspections can also differ.', donde: 'Vehicle technical document (MMA)' },
  { titulo: 'Gas and electrical installation', detalle: 'Ask for installation certificates and inspection records for gas, heating and electrical modifications.', donde: 'Installation certificates and inspection' },
  { titulo: 'Actual payload', detalle: 'Water, batteries and equipment can bring a camper close to its maximum authorised mass. Check its loaded weight if needed.', donde: 'Public weighbridge and technical document' },
]

export const CHECKLIST_COMPRA_SEGURA_EN: ItemChecklist[] = [
  { titulo: 'Registration in the seller’s name', detalle: 'Check that the registered owner matches the person signing the contract and their ID.', donde: 'DGT registration certificate' },
  { titulo: 'Vehicle technical document', detalle: 'Verify approved classification, passenger seats and recorded conversions against the listing.', donde: 'ITV technical document' },
  { titulo: 'Valid roadworthiness inspection (ITV)', detalle: 'Check the expiry date and any comments on the inspection record.', donde: 'ITV card and inspection report' },
  { titulo: 'Conversion certificates', detalle: 'Ask for certificates and technical-document entries for modifications to windows, roof, seating or gas and electrical systems.', donde: 'Workshop and homologation documents' },
  { titulo: 'Dwelling-vehicle homologation', detalle: 'If listed as a dwelling vehicle, check its conversion project and certificate.', donde: 'Vehicle documentation and listing file' },
]
