import { render, screen } from '@testing-library/react'
import Link from 'next/link'
import PublicHero from '@/components/editorial/PublicHero'

describe('PublicHero', () => {
  it('mantiene una jerarquía semántica con título, entradilla y acciones', () => {
    render(
      <PublicHero eyebrow="CamperOcasión" title="Furgonetas camper y autocaravanas" description="Encuentra tu vehículo" compact>
        <Link href="/catalogo">Explorar</Link>
      </PublicHero>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Furgonetas camper y autocaravanas' })).toBeInTheDocument()
    expect(screen.getByText('Encuentra tu vehículo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/catalogo')
  })
})
