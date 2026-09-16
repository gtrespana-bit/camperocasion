/**
 * Tests del sello de homologación.
 *
 * Regla de producto que se protege aquí: el sello SOLO aparece cuando hay algo
 * que contar. Un anuncio sin expediente no lleva ninguna marca (no se insinúa
 * que sea dudoso), y el estado rechazado jamás se pinta como verificado.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import BadgeHomologacion from '@/components/BadgeHomologacion'

// `BadgeHomologacion` pide las claves dentro del namespace 'productCard', así
// que el traductor mockeado recibe la clave sin prefijo (como next-intl real).
const ETIQUETAS: Record<string, string> = {
  homologacionVerificada: 'Homologación verificada',
  homologacionPendiente: 'Verificación en curso',
  homologacionRechazada: 'Documentación rechazada',
  homologacionSinExpediente: 'Sin expediente',
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => ETIQUETAS[key] ?? key,
}))

describe('BadgeHomologacion', () => {
  test('no pinta nada si el anuncio no tiene expediente', () => {
    const { container } = render(<BadgeHomologacion estado="sin_verificar" />)
    expect(container).toBeEmptyDOMElement()
  })

  test('tampoco pinta nada si el estado llega vacío o desconocido', () => {
    const { container: sinEstado } = render(<BadgeHomologacion estado={null} />)
    expect(sinEstado).toBeEmptyDOMElement()

    const { container: raro } = render(<BadgeHomologacion estado="lo-que-sea" />)
    expect(raro).toBeEmptyDOMElement()
  })

  test('muestra el sello cuando el expediente está verificado', () => {
    render(<BadgeHomologacion estado="verificada" />)
    expect(screen.getByText('Homologación verificada')).toBeInTheDocument()
  })

  test('en revisión informa, pero no afirma que esté verificado', () => {
    render(<BadgeHomologacion estado="pendiente" />)
    expect(screen.getByText('Verificación en curso')).toBeInTheDocument()
    expect(screen.queryByText('Homologación verificada')).not.toBeInTheDocument()
  })

  test('el rechazo se muestra como rechazo, nunca como verificado', () => {
    render(<BadgeHomologacion estado="rechazada" />)
    expect(screen.getByText('Documentación rechazada')).toBeInTheDocument()
    expect(screen.queryByText('Homologación verificada')).not.toBeInTheDocument()
  })

  test('permite pintar el estado "sin expediente" cuando se pide explícitamente', () => {
    render(<BadgeHomologacion estado="sin_verificar" mostrarSinVerificar />)
    expect(screen.getByText('Sin expediente')).toBeInTheDocument()
  })

  test('acepta los tamaños sm, md y lg', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = render(<BadgeHomologacion estado="verificada" size={size} />)
      expect(screen.getByText('Homologación verificada')).toBeInTheDocument()
      unmount()
    }
  })
})
