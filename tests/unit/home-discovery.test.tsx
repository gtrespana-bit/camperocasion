import React from 'react'
import { render, screen, within } from '@testing-library/react'
import RoutePanels from '@/components/home/RoutePanels'
import Gallery from '@/components/home/Gallery'

jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))

test('families remain directly navigable without fixed fullscreen panels', () => {
  render(<RoutePanels kicker="Vehicle families" explore="Explore" panels={[
    { key: 'campers', label: 'Campervans', desc: 'Find a campervan', image: '/home/campers.webp', alt: 'Campervan', href: '/catalogo?subcategoria=Camper', tipos: [{ label: 'Camper', href: '/catalogo?subcategoria=Camper' }, { label: 'Compact', href: '/catalogo?subcategoria=Compact' }, { label: 'Mini', href: '/catalogo?subcategoria=Mini' }] },
    { key: 'motorhomes', label: 'Motorhomes', desc: 'Find a motorhome', image: '/home/autocaravanas.webp', alt: 'Motorhome', href: '/catalogo?subcategoria=Autocaravana', tipos: [{ label: 'Integrated', href: '/catalogo?subcategoria=Integrated' }] },
  ]} />)
  const region = screen.getByRole('region', { name: 'Vehicle families' })
  expect(within(region).getAllByRole('heading', { level: 2 })).toHaveLength(2)
  expect(within(region).getAllByRole('link', { name: 'Explore' })[0]).toHaveAttribute('href', '/catalogo?subcategoria=Camper')
  expect(within(region).getByRole('link', { name: 'Camper' })).toHaveAttribute('href', '/catalogo?subcategoria=Camper')
  expect(region.querySelector('[data-panel]')).toBeNull()
  const cards = within(region).getAllByRole('article')
  expect(cards).toHaveLength(2)
  for (const card of cards) {
    expect(card.querySelector('h2')).toHaveClass('min-h-[4.75rem]')
    expect(card.querySelector('ul')).toHaveClass('min-h-[9rem]')
    expect(within(card).getByRole('link', { name: 'Explore' })).toHaveClass('mt-5')
  }
})

test('market cards keep price, location and product destination visible', () => {
  render(<Gallery header={<h2>Campers for sale</h2>} labels={{ featured: 'Featured', isNew: 'New', see: 'View', empty: 'No listings', emptyCta: 'List one', progress: 'Swipe to see more' }} items={[
    { id: 'one', href: '/producto/one', title: 'Camper One', image: '/placeholder-product.webp', price: '29.000 €', place: 'Madrid', condition: 'Used', ago: null, badge: 'featured' },
  ]} />)
  expect(screen.getByRole('heading', { name: 'Campers for sale' })).toBeInTheDocument()
  const card = screen.getByRole('link', { name: /Camper One/ })
  expect(card).toHaveAttribute('href', '/producto/one')
  expect(within(card).getByText('29.000 €')).toBeInTheDocument()
  expect(within(card).getByText(/Madrid/)).toBeInTheDocument()
})
