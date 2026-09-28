/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST as crear } from '@/app/api/crear-conversacion/route'
import { POST as enviar } from '@/app/api/enviar-mensaje/route'
import { GET as reservas } from '@/app/api/reservas/route'
import { POST as semilla } from '@/app/api/admin/semilla/route'
import { requireUser, requireAdmin } from '@/lib/require-auth'
import { destinatarioSemilla } from '@/lib/semilla-chat'
import { asegurarVendedores } from '@/lib/semilla-admin.js'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/require-auth', () => ({ requireUser: jest.fn(), requireAdmin: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn(async () => ({ ok: true })), getClientIp: () => '127.0.0.1' }))
jest.mock('@/lib/semilla-chat', () => ({ destinatarioSemilla: jest.fn() }))
jest.mock('@/lib/semilla-admin.js', () => ({ asegurarVendedores: jest.fn(), CAMPOS_ANUNCIO_SEMILLA: {} }))
jest.mock('@/lib/push-notify', () => ({ notifyUser: jest.fn(async () => {}) }))
jest.mock('@/lib/telegram-admin', () => ({ notificarAdminTelegram: jest.fn() }))

const BUYER = '11111111-1111-4111-8111-111111111111'
const SELLER = '22222222-2222-4222-8222-222222222222'
const ADMIN = '33333333-3333-4333-8333-333333333333'
const PRODUCT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONV = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let tables: Record<string, any>
let results: Record<string, any[]>

function req(body: any) {
  return new NextRequest('https://site.test/api', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireUser as jest.Mock).mockResolvedValue({ user: { id: BUYER } })
  ;(requireAdmin as jest.Mock).mockResolvedValue({ user: { id: ADMIN } })
  ;(destinatarioSemilla as jest.Mock).mockResolvedValue(ADMIN)
  results = {
    productos: [{ data: { user_id: SELLER, activo: true, estado_moderacion: 'aprobado', es_demo: true } }],
    conversaciones: [{ data: null }, { data: { id: CONV, user1_id: BUYER, user2_id: ADMIN, producto_id: PRODUCT } }],
    mensajes: [{ data: { id: 'message' } }],
    perfiles: [{ data: { nombre: 'Comprador' } }],
    reservas: [{ data: [] }],
  }
  tables = {}
  ;(createClient as jest.Mock).mockReturnValue({ from: (table: string) => {
    if (!tables[table]) {
      const q: any = {}
      for (const method of ['select', 'eq', 'in', 'or', 'order', 'insert', 'update', 'delete']) q[method] = jest.fn(() => q)
      const resolve = () => Promise.resolve(results[table]?.shift() || { data: null, error: null })
      q.maybeSingle = jest.fn(resolve)
      q.single = jest.fn(resolve)
      q.limit = jest.fn(resolve)
      q.then = (fn: any) => resolve().then(fn)
      tables[table] = q
    }
    return tables[table]
  } })
})

test('anuncio semilla crea conversación comprador → cuenta real, no vendedor ficticio', async () => {
  const response = await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ id: CONV, user2_id: ADMIN })
  expect(tables.conversaciones.insert).toHaveBeenCalledWith({ user1_id: BUYER, user2_id: ADMIN, producto_id: PRODUCT })
})

test('anuncios reales no pasan por el destino de semilla', async () => {
  results.productos[0].data.es_demo = false
  await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))
  expect(destinatarioSemilla).not.toHaveBeenCalled()
  expect(tables.conversaciones.insert).toHaveBeenCalledWith({ user1_id: BUYER, user2_id: SELLER, producto_id: PRODUCT })
})

test('sin sesión, ni consulta la base de datos', async () => {
  ;(requireUser as jest.Mock).mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) })
  expect((await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))).status).toBe(401)
  expect(createClient).not.toHaveBeenCalled()
})

test.each([
  [{ vendedorId: ADMIN, productoId: PRODUCT }, 400],
  [{ vendedorId: SELLER, productoId: PRODUCT, otroUsuarioId: ADMIN }, 403],
  [{ vendedorId: 'bad', productoId: PRODUCT }, 400],
])('rechaza vendedor manipulado, destino externo o ID inválido (%j)', async (body, status) => {
  expect((await crear(req(body))).status).toBe(status)
  expect(tables.conversaciones).toBeUndefined()
})

test('cuenta de atención ausente: no crea un chat muerto', async () => {
  ;(destinatarioSemilla as jest.Mock).mockRejectedValueOnce(new Error('not found'))
  expect((await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))).status).toBe(503)
  expect(tables.conversaciones).toBeUndefined()
})

test('el admin no puede iniciar una consulta consigo mismo', async () => {
  ;(requireUser as jest.Mock).mockResolvedValue({ user: { id: ADMIN } })
  expect((await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))).status).toBe(400)
  expect(tables.conversaciones).toBeUndefined()
})

test('anuncio oculto no acepta nuevas consultas', async () => {
  results.productos[0].data.activo = false
  expect((await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))).status).toBe(410)
})

test('reutiliza la conversación sin duplicar', async () => {
  results.conversaciones = [{ data: { id: CONV } }]
  expect((await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))).status).toBe(200)
  expect(tables.conversaciones.insert).not.toHaveBeenCalled()
})

test('dos peticiones concurrentes recuperan la conversación ganadora', async () => {
  results.conversaciones = [{ data: null }, { error: { code: '23505' } }, { data: { id: CONV } }]
  const response = await crear(req({ vendedorId: SELLER, productoId: PRODUCT }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ id: CONV })
})

test.each([[BUYER, ADMIN], [ADMIN, BUYER]])('mensajes y respuestas van al participante real %s → %s', async (sender, recipient) => {
  ;(requireUser as jest.Mock).mockResolvedValue({ user: { id: sender } })
  results.conversaciones = [{ data: { user1_id: BUYER, user2_id: ADMIN, producto_id: PRODUCT, productos: { user_id: SELLER, es_demo: true } } }]
  const response = await enviar(req({ conversacion_id: CONV, destinatario_id: recipient, contenido: 'Hola, busco una camper' }))
  expect(response.status).toBe(200)
  expect(tables.mensajes.insert).toHaveBeenCalledWith(expect.objectContaining({ remitente_id: sender, destinatario_id: recipient, producto_id: PRODUCT }))
  expect(notifyUser).toHaveBeenCalledWith(expect.anything(), recipient, expect.objectContaining({ click_url: `/chat?conversation=${CONV}` }))
})

test('no se puede enviar a un tercero ajeno al chat', async () => {
  results.conversaciones = [{ data: { user1_id: BUYER, user2_id: ADMIN } }]
  expect((await enviar(req({ conversacion_id: CONV, destinatario_id: SELLER, contenido: 'Hola' }))).status).toBe(400)
  expect(tables.mensajes).toBeUndefined()
})

test('un tercero no puede escribir en conversaciones ajenas', async () => {
  ;(requireUser as jest.Mock).mockResolvedValue({ user: { id: SELLER } })
  results.conversaciones = [{ data: { user1_id: BUYER, user2_id: ADMIN } }]
  expect((await enviar(req({ conversacion_id: CONV, destinatario_id: ADMIN, contenido: 'Hola' }))).status).toBe(403)
})

test('chat antiguo ficticio: no envía ni transfiere historial privado, ofrece reapertura explícita', async () => {
  results.conversaciones = [{ data: { user1_id: BUYER, user2_id: SELLER, producto_id: PRODUCT, productos: { user_id: SELLER, es_demo: true } } }]
  const response = await enviar(req({ conversacion_id: CONV, destinatario_id: SELLER, contenido: 'Hola' }))
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: 'CONVERSACION_SEMILLA_CERRADA', reabrir: `/chat?producto_id=${PRODUCT}&vendedor_id=${SELLER}` })
  expect(tables.mensajes).toBeUndefined()
})

test('reservas por producto filtran comprador/vendedor incluso usando service_role', async () => {
  expect((await reservas(new NextRequest(`https://site.test/api/reservas?productoId=${PRODUCT}`))).status).toBe(200)
  expect(tables.reservas.or).toHaveBeenCalledWith(`comprador_id.eq.${BUYER},vendedor_id.eq.${BUYER}`)
})

test('estado semilla API usa solo lectura y no crea categoría ni actualiza productos', async () => {
  ;(asegurarVendedores as jest.Mock).mockResolvedValue({ ids: {}, creados: 0, reutilizados: 0 })
  const response = await semilla(new NextRequest('https://site.test/api/admin/semilla?dry=1', { method: 'POST' }))
  expect(response.status).toBe(200)
  expect(asegurarVendedores).toHaveBeenCalledWith(expect.anything(), true)
  expect(tables).toEqual({})
})
