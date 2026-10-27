import * as fs from 'fs'
import * as path from 'path'
import {
  checkRateLimit,
  getClientIp,
  normalizarIp,
  LIMITS,
  LIMITES_IP,
} from '@/lib/rate-limit'

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

describe('rate limit compuesto usuario + IP (auditoría punto 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    rpc.mockResolvedValue({ data: { ok: true, remaining: 10, resetIn: 3600000, limit: 20 }, error: null })
  })

  it('publicar usa la RPC dual con límite de IP', async () => {
    const result = await checkRateLimit('producto:create', 'user-1', { ip: '203.0.113.7, 10.0.0.1' })

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('check_rate_limit_dual', {
      p_key: 'producto:create',
      p_identifier: 'user-1',
      p_ip: '203.0.113.7',
      p_limit: LIMITS['producto:create'].max,
      p_window_ms: LIMITS['producto:create'].windowMs,
      p_ip_limit: LIMITES_IP['producto:create'],
    })
  })

  it('una IP desconocida no agrupa a todos en el mismo bucket', async () => {
    await checkRateLimit('producto:create', 'user-1', { ip: 'unknown' })
    expect(rpc).toHaveBeenCalledWith('check_rate_limit_atomic', expect.objectContaining({ p_ip: null }))
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_ip_limit')
  })

  it('las claves sin bucket de IP siguen usando la RPC atómica', async () => {
    await checkRateLimit('auth:login', '127.0.0.1', { ip: '127.0.0.1' })
    expect(rpc).toHaveBeenCalledWith('check_rate_limit_atomic', expect.objectContaining({ p_key: 'auth:login' }))
  })

  it('una clave sin configurar falla cerrado en vez de permitir todo', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const result = await checkRateLimit('typo:inexistente', 'user-1')
    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('sin límite configurado'), 'typo:inexistente')
    spy.mockRestore()
  })
})

describe('IP de cliente', () => {
  it('prioriza la cabecera que reescribe la plataforma', () => {
    const cabeceras: Record<string, string> = {
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'x-vercel-forwarded-for': '9.9.9.9',
    }
    const req = {
      headers: { get: (nombre: string) => cabeceras[nombre] ?? null },
    } as unknown as Request
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('normaliza cadena de proxies y valores inútiles', () => {
    expect(normalizarIp('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7')
    expect(normalizarIp('203.0.113.7:5432')).toBe('203.0.113.7')
    expect(normalizarIp('unknown')).toBeNull()
    expect(normalizarIp(undefined)).toBeNull()
  })
})

describe('cobertura de claves', () => {
  it('toda llamada checkRateLimit(\'clave\') del código tiene límite definido', () => {
    const raiz = path.join(__dirname, '../../src')
    const archivos: string[] = []
    const visitar = (dir: string) => {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, entrada.name)
        if (entrada.isDirectory()) visitar(ruta)
        else if (/\.tsx?$/.test(entrada.name)) archivos.push(ruta)
      }
    }
    visitar(raiz)

    const usadas = new Set<string>()
    for (const archivo of archivos) {
      const texto = fs.readFileSync(archivo, 'utf8')
      for (const m of texto.matchAll(/checkRateLimit\(\s*'([^']+)'/g)) usadas.add(m[1])
    }

    expect(usadas.size).toBeGreaterThan(15)
    const sinLimite = [...usadas].filter(k => !LIMITS[k])
    // Un typo aquí dejaba el endpoint SIN rate limiting (devolvía ok:true).
    expect(sinLimite).toEqual([])
  })

  it('las claves con bucket de IP tienen límite de usuario definido', () => {
    for (const clave of Object.keys(LIMITES_IP)) {
      expect(LIMITS[clave]).toBeDefined()
      expect(LIMITES_IP[clave]).toBeGreaterThanOrEqual(LIMITS[clave].max)
    }
  })
})
