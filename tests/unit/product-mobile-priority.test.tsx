import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import ProductoPageClient from '@/app/[locale]/producto/[slug]/ProductoPageClient'
import es from '@/i18n/dictionaries/es.json'

jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))
jest.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => ({
  useTranslations: (namespace: keyof typeof es) => (key: string) => (es[namespace] as Record<string, string>)[key] || key,
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn((name: string) => name === 'obtener_detalle_producto' ? Promise.resolve({ data: {}, error: null }) : Promise.resolve({})) },
}))
jest.mock('@/components/ReservaProducto', () => ({ __esModule: true, default: () => null, AvisoReservado: () => null }))
jest.mock('@/components/BotonInspeccion', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ReportarButton', () => ({ __esModule: true, default: () => null }))

const product = {
  id: 'vehicle-1', slug: 'camper-uno', user_id: 'seller-1', titulo: 'Camper Uno',
  precio_usd: 29000, estado: 'usado', imagen_url: null, imagenes: [],
  descripcion: 'Descripción detallada del vehículo', especificaciones: {},
  ubicacion_ciudad: 'Madrid', metodos_contacto: {}, vendido: false, visitas: 2,
}

test('mobile structure puts one real price and one available chat after title, before long description', async () => {
  render(<ProductoPageClient initialProduct={product} esDemo />)
  const title = await screen.findByRole('heading', { level: 1, name: 'Camper Uno' })
  const price = screen.getByText('29.000 €')
  const description = screen.getByText('Descripción detallada del vehículo')
  expect(title.closest('.order-2')).toBeInTheDocument()
  expect(price.closest('.order-3')).toBeInTheDocument()
  expect(description.closest('.order-4')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: es.productDetail.chat })).toHaveLength(1)
  expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: es.productDetail.chat }))
  expect(screen.getByText(es.productDetail.guestNudgeTitle)).toBeInTheDocument()
})

test('sold vehicles keep price but do not offer contact', async () => {
  render(<ProductoPageClient initialProduct={{ ...product, vendido: true }} esDemo />)
  expect(await screen.findByText('29.000 €')).toBeInTheDocument()
  expect(screen.getByText(es.productDetail.soldBannerTitle)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: es.productDetail.chat })).not.toBeInTheDocument()
})
