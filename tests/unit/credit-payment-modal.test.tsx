import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ModalPago from '@/components/creditos/ModalPago'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) } },
}))
jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))

describe('Shared credit payment dialog', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('uses an accessible dialog, supports Escape and sends the English checkout locale', async () => {
    const onClose = jest.fn()
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: false }) })
    global.fetch = fetchMock
    render(<ModalPago paquete={{ creditos: 4, precio: 5 }} metodos={[]} configurado={null} stripeDisponible onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: /4 credits/ })).toHaveAttribute('aria-modal', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'payNowButton' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({
      body: JSON.stringify({ creditos: 4, locale: 'en' }),
    })))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the English login URL for an unauthenticated buyer', async () => {
    // The manual path uses the same localized login redirect as Stripe checkout.
    const { supabase } = jest.requireMock('@/lib/supabase')
    const getUser = jest.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({ data: { user: null } })
    render(<ModalPago paquete={{ creditos: 4, precio: 5 }} metodos={[]} configurado={null} stripeDisponible onClose={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'payNowButton' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/en/login?redirect=/creditos'))
    getUser.mockRestore()
  })
})
