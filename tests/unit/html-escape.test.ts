import { escapeHtml } from '@/lib/html-escape'

describe('escapeHtml', () => {
  it('escapes HTML text and attribute delimiters', () => {
    expect(escapeHtml(`a&b <script> "x" 'y'`)).toBe(
      'a&amp;b &lt;script&gt; &quot;x&quot; &#39;y&#39;',
    )
  })

  it('prevents attribute injection in mailto links', () => {
    expect(escapeHtml('victim"onmouseover="alert(1)@example.com')).toBe(
      'victim&quot;onmouseover=&quot;alert(1)@example.com',
    )
  })
})
