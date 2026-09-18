/** @jest-environment node */
// El registro permite elegir tipo de vendedor (Fase 2): el valor viaja en la
// metadata del usuario y el trigger de la BD lo copia al perfil. Aquí se fija
// el contrato del endpoint: valores válidos pasan, inventados se rechazan.
// Corre en entorno `node` (no jsdom): `next/server` necesita la API Fetch
// (Request/Response), que Node ≥18 trae nativa pero jsdom no.
import { POST } from '@/app/api/register/route'
import { enviarConfirmacion } from '@/lib/confirmacion-email'

jest.mock('@/lib/confirmacion-email', () => ({
  enviarConfirmacion: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => ({ ok: true })),
  getClientIp: jest.fn(() => '127.0.0.1'),
  rateLimitResponse: jest.fn(),
}))

const mockEnviar = enviarConfirmacion as jest.Mock

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

const valido = { nombre: 'Ana Tester', email: 'ana@test.com', password: 'password-largo' }

beforeEach(() => {
  mockEnviar.mockReset()
  mockEnviar.mockResolvedValue({ ok: true, canal: 'app' })
})

describe('POST /api/register con tipo de vendedor', () => {
  test('un tipo válido llega a enviarConfirmacion', async () => {
    const res = await POST(request({ ...valido, tipo: 'camperizador' }))
    expect(res.status).toBe(200)
    expect(mockEnviar).toHaveBeenCalledWith(valido.email, valido.nombre, valido.password, 'camperizador')
  })

  test('sin tipo, enviarConfirmacion recibe undefined (la BD aplica "particular")', async () => {
    const res = await POST(request(valido))
    expect(res.status).toBe(200)
    expect(mockEnviar).toHaveBeenCalledWith(valido.email, valido.nombre, valido.password, undefined)
  })

  test.each(['empresa', 'PARTICULAR', 42, null])(
    'un tipo inventado (%p) se rechaza con 400',
    async (tipo) => {
      const res = await POST(request({ ...valido, tipo }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/inválido/i)
      expect(mockEnviar).not.toHaveBeenCalled()
    },
  )

  test('los tres tipos oficiales se aceptan', async () => {
    for (const tipo of ['particular', 'camperizador', 'profesional']) {
      const res = await POST(request({ ...valido, email: `${tipo}@test.com`, tipo }))
      expect(res.status).toBe(200)
    }
  })
})
