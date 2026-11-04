import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import PlanesClient from '@/app/[locale]/para-profesionales/PlanesClient'
import en from '@/i18n/dictionaries/en.json'

jest.mock('next/navigation', () => ({ usePathname: () => '/en/para-profesionales' }))
jest.mock('@/i18n/routing', () => ({ routing: { locales: ['es', 'en'], defaultLocale: 'es' } }))
jest.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ session: null, user: null, loading: false }) }))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    let text = (en.proPlans as Record<string, string>)[key] || key
    for (const [name, value] of Object.entries(values || {})) text = text.replace(`{${name}}`, String(value))
    return text
  },
}))
jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))

describe('Professional plans in English', () => {
  afterEach(() => window.history.replaceState({}, '', '/en/para-profesionales'))

  it('does not claim that a plan is active just because the URL says checkout succeeded', async () => {
    window.history.replaceState({}, '', '/en/para-profesionales?pago=ok&plan=plus')
    render(<PlanesClient />)
    await waitFor(() => expect(screen.getByText(en.proPlans.paymentProcessing)).toBeInTheDocument())
    expect(screen.queryByText(en.proPlans.paymentConfirmed)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Publish a listing/ })).not.toBeInTheDocument()
  })

  it('shows the configured plan and pricing controls without Spanish labels', () => {
    render(<PlanesClient />)
    expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Annual/ })).toBeInTheDocument()
    expect(screen.getByText('Up to 20 photos per listing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start with Professional/ })).toBeInTheDocument()
    expect(screen.queryByText('Facturado mes a mes · sin permanencia')).not.toBeInTheDocument()
  })
})
