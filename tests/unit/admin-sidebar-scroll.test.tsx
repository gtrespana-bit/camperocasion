import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminClient from '@/app/[locale]/admin/AdminClient'

const mockRouter = { push: jest.fn(), replace: jest.fn() }
const mockSearchParams = new URLSearchParams()
const mockUser = { id: 'admin-1', email: 'gtrespana@gmail.com' }
const mockSession = { access_token: 'tok' }

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/admin',
}))

jest.mock('@/components/LocalLink', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    session: mockSession,
    loading: false,
  }),
}))

jest.mock('@/app/[locale]/admin/components/AdminDashboard', () => function MockDashboard() {
  return <div data-testid="tab-dashboard">Dashboard content</div>
})
jest.mock('@/app/[locale]/admin/components/AdminAjustes', () => function MockAjustes() {
  return <div data-testid="tab-ajustes">Ajustes content</div>
})
jest.mock('@/app/[locale]/admin/AdminInspecciones', () => function MockInspecciones() {
  return <div data-testid="tab-inspecciones">Inspecciones content</div>
})
jest.mock('@/app/[locale]/admin/AdminGestoria', () => function MockGestoria() {
  return <div data-testid="tab-gestoria">Gestoria content</div>
})

describe('AdminClient sidebar scroll y navegación', () => {
  const fetchOriginal = (global as any).fetch

  beforeEach(() => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, usuarios: [], counts: {} }),
    })
  })

  afterEach(() => {
    ;(global as any).fetch = fetchOriginal
  })

  it('habilita scroll vertical propio en la navegación lateral del panel admin', async () => {
    render(<AdminClient />)
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    const nav = screen.getByRole('navigation', { name: 'Secciones del panel' })
    expect(nav.className).toContain('min-h-0')
    expect(nav.className).toContain('flex-1')
    expect(nav.className).toContain('overflow-y-auto')
    expect(nav.className).toContain('overscroll-contain')

    const aside = nav.closest('aside')
    expect(aside).not.toBeNull()
    expect(aside?.className).toContain('overflow-y-auto')
    expect(aside?.className).toContain('overscroll-contain')
  })

  it('permite hacer scroll con la rueda incluso sobre la cabecera o pie del aside y navegar a opciones inferiores', async () => {
    const scrollIntoViewMock = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    render(<AdminClient />)
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    const nav = screen.getByRole('navigation', { name: 'Secciones del panel' })
    const headerText = screen.getByText('Admin CamperOcasión')
    expect(nav.scrollTop).toBe(0)

    fireEvent.wheel(headerText, { deltaY: 180 })
    expect(nav.scrollTop).toBe(180)

    const btnAjustes = screen.getByRole('button', { name: /Ajustes/i })
    fireEvent.click(btnAjustes)
    await waitFor(() => expect(screen.getByTestId('tab-ajustes')).toBeInTheDocument())
    expect(btnAjustes).toHaveAttribute('aria-current', 'page')
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest' })

    fireEvent.click(screen.getByRole('button', { name: /Inspecciones/i }))
    await waitFor(() => expect(screen.getByTestId('tab-inspecciones')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Gestoría/i }))
    await waitFor(() => expect(screen.getByTestId('tab-gestoria')).toBeInTheDocument())
  })
})
