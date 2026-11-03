import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import LoginClient from '@/app/[locale]/(auth)/login/LoginClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/routing', () => ({ routing: { locales: ['es', 'en'], defaultLocale: 'es' } }))
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { setSession: jest.fn() } } }))
jest.mock('@/components/BrandLogo', () => ({ __esModule: true, default: () => <span>CamperOcasión</span> }))
jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))

describe('Acceso y recuperación', () => {
  it('separa los formularios y mantiene el campo de correo etiquetado', () => {
    const { container } = render(<LoginClient />)
    expect(screen.getByLabelText('login.email')).toHaveAttribute('type', 'email')
    expect(container.querySelectorAll('form')).toHaveLength(1)
    expect(container.querySelector('form form')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'login.forgot_password' }))
    expect(container.querySelectorAll('form')).toHaveLength(1)
    expect(container.querySelector('form form')).toBeNull()
    expect(screen.getByRole('button', { name: 'login.reset_submit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'login.submit' })).not.toBeInTheDocument()
  })
})
