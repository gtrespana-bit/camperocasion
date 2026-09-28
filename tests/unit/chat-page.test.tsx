import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import ChatPage from '@/app/[locale]/chat/ChatPage'

const BUYER = 'buyer', SEED = 'seed', TEAM = 'team', PRODUCT = 'product', CONV = 'conv'
let mockParams: URLSearchParams
let mockConvs: any[]
let mockUser: any
const mockPush = jest.fn()
let mockHandlers: Record<string, (p: any) => void>

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockParams,
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }))
jest.mock('@/components/Avatar', () => ({ __esModule: true, default: () => <span /> }))
jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))
jest.mock('@/lib/supabase', () => ({ supabase: {
  from: (table: string) => {
    const q: any = {}
    for (const name of ['select', 'or', 'eq', 'in', 'order']) q[name] = () => q
    q.then = (fn: any) => Promise.resolve({ data: table === 'conversaciones' ? mockConvs : table === 'productos' ? [{ id: PRODUCT, titulo: 'Camper' }] : [], error: null }).then(fn)
    return q
  },
  channel: (name: string) => {
    const q: any = { on: (_type: any, _opts: any, cb: any) => { mockHandlers[name] = cb; return q }, subscribe: () => q }
    return q
  },
  removeChannel: jest.fn(),
} }))

const conv = { id: CONV, user1_id: BUYER, user2_id: TEAM, producto_id: PRODUCT, ultimo_mensaje: null }
let fetchMock: jest.Mock
beforeEach(() => {
  mockUser = { id: BUYER }
  mockParams = new URLSearchParams()
  mockConvs = []
  mockHandlers = {}
  sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: jest.fn() })
  global.BroadcastChannel = class { postMessage() {} close() {} } as any
  fetchMock = jest.fn(async (url: string) => {
    if (url.startsWith('/api/user-bulk')) return { ok: true, json: async () => ({ profiles: [{ id: TEAM, nombre: 'Equipo real' }, { id: SEED, nombre: 'Vendedor ficticio' }].filter(p => url.includes(p.id)) }) }
    if (url === '/api/crear-conversacion') return { ok: true, json: async () => conv }
    return { ok: true, json: async () => ({}) }
  })
  global.fetch = fetchMock
})

test('deep link de notificación abre el chat y marca los mensajes como leídos', async () => {
  mockParams = new URLSearchParams(`conversation=${CONV}`)
  mockConvs = [conv]
  render(<ChatPage />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/mensajes-leidos', expect.objectContaining({ body: JSON.stringify({ conversacion_id: CONV }) })))
  expect(screen.queryByText('Selecciona una conversacion')).not.toBeInTheDocument()
})

test('usa el participante devuelto por API, no el vendedor ficticio de la URL', async () => {
  mockParams = new URLSearchParams(`producto_id=${PRODUCT}&vendedor_id=${SEED}`)
  render(<ChatPage />)
  await waitFor(() => expect(screen.getAllByText('Equipo real').length).toBeGreaterThan(0))
  expect(screen.queryByText('Vendedor ficticio')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(`/api/user-bulk?ids=${TEAM}`)
})

test('conversación nueva recibida por realtime aparece sin recargar', async () => {
  render(<ChatPage />)
  await screen.findByText('No hay conversaciones')
  mockConvs = [conv]
  await act(async () => { mockHandlers['chat-convs']({ new: conv }) })
  await screen.findByText('Equipo real')
})

test('no lee conversaciones cacheadas de otra cuenta', async () => {
  sessionStorage.setItem('camperocasion_chat_convs', JSON.stringify([{ ...conv, otro_nombre: 'Dato privado anterior' }]))
  render(<ChatPage />)
  expect(screen.queryByText('Dato privado anterior')).not.toBeInTheDocument()
  await screen.findByText('No hay conversaciones')
})

test('error de red conserva el borrador y desbloquea el envío', async () => {
  mockParams = new URLSearchParams(`conversation=${CONV}`)
  mockConvs = [conv]
  render(<ChatPage />)
  const input = await screen.findByPlaceholderText('typeMessage')
  fireEvent.change(input, { target: { value: 'Quiero una camper' } })
  const original = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((url: string, ...args: any[]) => url === '/api/enviar-mensaje' ? Promise.reject(new Error('offline')) : original(url, ...args))
  fireEvent.keyDown(input, { key: 'Enter' })
  await screen.findByText('No hay conexión. Tu mensaje no se ha borrado; puedes reintentarlo.')
  expect(input).toHaveValue('Quiero una camper')
  expect(screen.queryByText('Enviando...')).not.toBeInTheDocument()
})
