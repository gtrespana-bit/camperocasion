import { verificarContenido } from '../../src/lib/moderacion'

describe('moderación por términos completos', () => {
  it.each(['Computadora portátil', 'Reputación de vendedor', 'Balanza de cocina'])('does not flag a fragment in: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('limpio')
  })
  it.each(['Pistola de calor', 'Pistola para silicón', 'Pistola para pintar'])('sends ambiguous products to review: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('sospechoso')
  })
  it.each(['Venta de rifle', 'Cocaína disponible', 'servicio de prostitución'])('still blocks prohibited content: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('prohibido')
  })
})
