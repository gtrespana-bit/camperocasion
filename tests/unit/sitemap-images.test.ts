/** @jest-environment node */

import { GET } from '@/app/sitemap-images.xml/route'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'

jest.mock('@/lib/supabase-server-client', () => ({
  getSupabaseServerClient: jest.fn(),
}))

const mockGetSupabaseServerClient = getSupabaseServerClient as unknown as jest.Mock

function makeSupabase(response: { data: any[] | null; error: unknown | null }) {
  const query: any = {}
  query.select = jest.fn(() => query)
  query.eq = jest.fn(() => query)
  query.or = jest.fn(() => query)
  query.order = jest.fn(() => query)
  query.range = jest.fn().mockResolvedValue(response)

  return { from: jest.fn(() => query) }
}

describe('GET /sitemap-images.xml', () => {
  beforeEach(() => {
    mockGetSupabaseServerClient.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('includes a URL entry when there are no products with images', async () => {
    mockGetSupabaseServerClient.mockReturnValue(makeSupabase({ data: [], error: null }))

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(xml).toContain('<url>\n    <loc>https://camperocasion.online/</loc>\n  </url>')
  })

  it('keeps returning valid XML if Supabase initialization fails', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetSupabaseServerClient.mockImplementation(() => {
      throw new Error('Supabase is unavailable')
    })

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('<loc>https://camperocasion.online/</loc>')
    expect(logError).toHaveBeenCalled()
  })

  it('includes approved product URLs and escaped image metadata', async () => {
    mockGetSupabaseServerClient.mockReturnValue(
      makeSupabase({
        data: [
          {
            id: 'product-id',
            slug: 'camper-uno',
            titulo: 'Camper & más',
            imagen_url: 'https://images.example/camper.jpg?x=1&y=2',
            imagenes: [],
          },
        ],
        error: null,
      }),
    )

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('<loc>https://camperocasion.online/producto/camper-uno</loc>')
    expect(xml).toContain('<image:loc>https://images.example/camper.jpg?x=1&amp;y=2</image:loc>')
    expect(xml).toContain('<image:title>Camper &amp; más</image:title>')
    expect(xml).not.toContain('https://camperocasion.online/</loc>')
  })
})
