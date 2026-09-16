import { normalizeMessengerUrl, resolveContactMethods } from '@/lib/contact-methods'

describe('contact methods exposed in product detail', () => {
  it('keeps every valid method configured for a product', () => {
    expect(resolveContactMethods({
      telefono: '+58 212 555 0101',
      whatsapp: '+58 414 555 0102',
      email: 'venta@example.com',
      messenger: 'https://m.me/vendedor',
    }, '+58 412 000 0000')).toEqual({
      hasProductConfiguration: true,
      phone: '+58 212 555 0101',
      whatsapp: '+58 414 555 0102',
      email: 'venta@example.com',
      messengerUrl: 'https://m.me/vendedor',
    })
  })

  it('uses the visible profile phone only for legacy products without contact configuration', () => {
    expect(resolveContactMethods(undefined, '+58 412 000 0000')).toEqual({
      hasProductConfiguration: false,
      phone: '+58 412 000 0000',
      whatsapp: '',
      email: '',
      messengerUrl: '',
    })
  })

  it('does not expose a legacy fallback when an explicit empty configuration is saved', () => {
    expect(resolveContactMethods({}, '+58 412 000 0000')).toEqual({
      hasProductConfiguration: true,
      phone: '',
      whatsapp: '',
      email: '',
      messengerUrl: '',
    })
  })

  it('rejects unsafe or unsupported Messenger links', () => {
    expect(normalizeMessengerUrl('javascript:alert(1)')).toBe('')
    expect(normalizeMessengerUrl('https://example.com/profile')).toBe('')
    expect(normalizeMessengerUrl('http://m.me/vendedor')).toBe('')
  })
})
