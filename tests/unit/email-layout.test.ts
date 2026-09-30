import { emailLayout, priceLine } from '@/lib/email-layout'

describe('email HTML escaping', () => {
  it('escapes the email title, call-to-action label, and URL', () => {
    const html = emailLayout(
      '<img src=x onerror=alert(1)>',
      '<p>Trusted static body</p>',
      'Click <here>',
      'https://example.com/?a=1&b="x"',
    )

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('Click &lt;here&gt;')
    expect(html).toContain('https://example.com/?a=1&amp;b=&quot;x&quot;')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('escapes dynamic label and value in price rows', () => {
    expect(priceLine('<b>Plan</b>', '</td><script>alert(1)</script>')).toContain(
      '&lt;/td&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })
})
