/** @jest-environment node */
import { asegurarVendedores, buscarUsuarioPorEmail, CAMPOS_ANUNCIO_SEMILLA } from '@/lib/semilla-admin.js'
import { VENDEDORES, emailVendedor } from '@/lib/semilla-datos.js'
import { destinatarioSemilla } from '@/lib/semilla-chat'
import { puedeReservar } from '@/lib/reservas'
import { puedeSolicitarInspeccion } from '@/lib/inspecciones'

function client(users: any[] = []) {
  const query: any = {}
  for (const method of ['select', 'eq']) query[method] = jest.fn(() => query)
  query.maybeSingle = jest.fn(async () => ({ data: { id: 'admin', es_demo: false }, error: null }))
  query.upsert = jest.fn(async () => ({ error: null }))
  const admin = {
    listUsers: jest.fn(async () => ({ data: { users }, error: null })),
    createUser: jest.fn(async (input: any) => ({ data: { user: { id: input.email, ...input } }, error: null })),
    updateUserById: jest.fn(async () => ({ error: null })),
    getUserById: jest.fn(async () => ({ data: { user: { app_metadata: { semilla: true } } }, error: null })),
  }
  return { auth: { admin }, from: jest.fn(() => query), query }
}

beforeEach(() => { delete process.env.SEMILLA_CHAT_EMAIL })

test('buscar por email pagina y normaliza mayúsculas', async () => {
  const sb = client()
  sb.auth.admin.listUsers
    .mockResolvedValueOnce({ data: { users: Array(200).fill({ email: 'other@site.com' }) }, error: null })
    .mockResolvedValueOnce({ data: { users: [{ id: 'a', email: 'GTRESPANA@GMAIL.COM' }] }, error: null })
  expect(await buscarUsuarioPorEmail(sb, 'gtrespana@gmail.com')).toMatchObject({ id: 'a' })
  expect(sb.auth.admin.listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 200 })
})

test('dry-run no crea usuarios, perfiles ni cambia contraseñas', async () => {
  const sb = client()
  const result = await asegurarVendedores(sb, true)
  expect(result).toEqual({ ids: {}, creados: 0, reutilizados: 0 })
  expect(sb.from).not.toHaveBeenCalled()
  expect(sb.auth.admin.createUser).not.toHaveBeenCalled()
  expect(sb.auth.admin.updateUserById).not.toHaveBeenCalled()
})

test('vendedores nuevos bloqueados, contraseñas aleatorias y sin contactos o verificaciones ficticios', async () => {
  const sb = client()
  await asegurarVendedores(sb)
  const inputs = sb.auth.admin.createUser.mock.calls.map(([input]) => input)
  expect(inputs).toHaveLength(VENDEDORES.length)
  expect(new Set(inputs.map(i => i.password)).size).toBe(inputs.length)
  for (const input of inputs) {
    expect(input.password.length).toBeGreaterThan(50)
    expect(input.password).not.toContain('Semilla#')
    expect(input.app_metadata).toEqual({ semilla: true })
    expect(input.ban_duration).toBe('876000h')
  }
  for (const call of sb.query.upsert.mock.calls) {
    expect(call[0]).toMatchObject({ telefono: null, verificado: false, es_demo: true, whatsapp_disponible: false })
  }
})

test('cuentas antiguas se protegen al generar, sin borrar su ID', async () => {
  const users = VENDEDORES.map(v => ({ id: v.slug, email: emailVendedor(v), user_metadata: { semilla: true } }))
  const sb = client(users)
  const result = await asegurarVendedores(sb)
  expect(result.reutilizados).toBe(users.length)
  expect(sb.auth.admin.createUser).not.toHaveBeenCalled()
  expect(sb.auth.admin.updateUserById).toHaveBeenCalledTimes(users.length)
  expect(result.ids[VENDEDORES[0].slug]).toBe(users[0].id)
})

test('no modifica una cuenta real cuyo email coincida', async () => {
  const sb = client([{ email: emailVendedor(VENDEDORES[0]), user_metadata: {} }])
  await expect(asegurarVendedores(sb)).rejects.toThrow('no pertenece a la semilla')
  expect(sb.from).not.toHaveBeenCalled()
  expect(sb.auth.admin.updateUserById).not.toHaveBeenCalled()
})

test('campos compartidos marcan la semilla, sin homologación o reservas inventadas', () => {
  expect(CAMPOS_ANUNCIO_SEMILLA).toMatchObject({ es_demo: true, metodos_contacto: {}, vendedor_verificado: false, verificacion_homologacion: 'sin_verificar', reservado: false })
  expect(VENDEDORES.every(v => !v.telefono && !v.verificado)).toBe(true)
})

test('destino por defecto: cuenta real y confirmada gtrespana@gmail.com', async () => {
  const sb = client([{ id: 'admin', email: 'gtrespana@gmail.com', email_confirmed_at: '2026-01-01' }])
  expect(await destinatarioSemilla(sb as any, 'seed')).toBe('admin')
})

test('correo configurado en servidor permite otra cuenta confirmada', async () => {
  process.env.SEMILLA_CHAT_EMAIL = ' TEAM@SITE.COM '
  const sb = client([{ id: 'team', email: 'team@site.com', email_confirmed_at: '2026-01-01' }])
  expect(await destinatarioSemilla(sb as any, 'seed')).toBe('team')
})

test.each([
  [],
  [{ id: 'admin', email: 'gtrespana@gmail.com' }],
  [{ id: 'admin', email: 'gtrespana@gmail.com', email_confirmed_at: '2026-01-01', app_metadata: { semilla: true } }],
  [{ id: 'admin', email: 'gtrespana@gmail.com', email_confirmed_at: '2026-01-01', banned_until: '2099-01-01' }],
].map(users => [users]))('destino ausente, sin confirmar, ficticio o bloqueado: falla cerrado (%j)', async (users) => {
  await expect(destinatarioSemilla(client(users) as any, 'seed')).rejects.toThrow()
})

test('no basta un flag en producto o user_metadata para desviar un anuncio real', async () => {
  const sb = client()
  sb.auth.admin.getUserById.mockResolvedValueOnce({ data: { user: { app_metadata: { semilla: false } } }, error: null })
  await expect(destinatarioSemilla(sb as any, 'real')).rejects.toThrow('no es una cuenta de semilla')
  expect(sb.auth.admin.listUsers).not.toHaveBeenCalled()
})

test('falla cerrado si no hay perfil real de atención', async () => {
  const sb = client([{ id: 'admin', email: 'gtrespana@gmail.com', email_confirmed_at: '2026-01-01' }])
  sb.query.maybeSingle.mockResolvedValueOnce({ data: { es_demo: true }, error: null })
  await expect(destinatarioSemilla(sb as any, 'seed')).rejects.toThrow('perfil real')
})

test('ni reservas ni inspecciones de vehículos ficticios aunque se invoque la API directamente', () => {
  const product = { id: 'p', user_id: 'seed', activo: true, es_demo: true }
  expect(puedeReservar(product, null, 'buyer').ok).toBe(false)
  expect(puedeSolicitarInspeccion(product, null, 'buyer').ok).toBe(false)
})
