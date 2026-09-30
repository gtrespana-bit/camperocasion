import { serializeJsonLd } from '@/lib/serialize-json-ld'

describe('serializeJsonLd', () => {
  it('prevents user content from terminating the script element', () => {
    const input = { name: '</script><script>alert(1)</script>', extra: 'a&b' }
    const output = serializeJsonLd(input)

    expect(output).not.toContain('</script>')
    expect(output).toContain('\\u003c/script\\u003e')
    expect(output).toContain('\\u0026')
    expect(JSON.parse(output)).toEqual(input)
  })
})
