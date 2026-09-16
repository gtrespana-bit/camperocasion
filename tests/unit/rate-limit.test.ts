import { checkRateLimit } from '@/lib/rate-limit'

const rpc = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc })),
}))

describe('rate limit atómico', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('delegates the decision and registration to the atomic RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: { ok: true, remaining: 4, resetIn: 900000, limit: 5 },
      error: null,
    })

    const result = await checkRateLimit('auth:login', '127.0.0.1', { ip: '127.0.0.1' })

    expect(result).toEqual({ ok: true, remaining: 4, resetIn: 900000, limit: 5 })
    expect(rpc).toHaveBeenCalledWith('check_rate_limit_atomic', expect.objectContaining({
      p_key: 'auth:login',
      p_identifier: '127.0.0.1',
      p_ip: '127.0.0.1',
      p_limit: 5,
      p_window_ms: 15 * 60 * 1000,
    }))
  })

  it('fails closed when the atomic RPC is unavailable', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC unavailable') })

    const result = await checkRateLimit('creditos:comprar', 'user-1', { ip: '127.0.0.1' })

    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.limit).toBe(12)
  })
})
