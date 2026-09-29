import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegalarPlanModal from '@/app/[locale]/admin/components/RegalarPlanModal'

/**
 * El modal de regalo es la única puerta para dar tiempo gratis a un usuario:
 * lo que se prueba aquí es que la previsualización dice la verdad (se calcula
 * con la misma función que la API) y que el POST sale con lo que se ha
 * elegido.
 */

const USUARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Taller Norte',
  email: 'taller@example.com',
  tipo_vendedor: 'profesional',
  plan_anuncios: 'plus',
  plan_hasta: '2026-10-29T10:00:00.000Z',
}

describe('RegalarPlanModal', () => {
  const fetchOriginal = (global as any).fetch

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  afterEach(() => {
    ;(global as any).fetch = fetchOriginal
  })

  it('previsualiza la fecha de fin sumando los días al pack vigente', () => {
    render(<RegalarPlanModal usuario={USUARIO} onClose={() => {}} notify={() => {}} />)

    // 30 días de Plus sumados al final del pack que ya tenía.
    expect(screen.getByText(/Plus hasta el/i)).toBeInTheDocument()
    expect(screen.getByText(/Se suman 30 días al final/i)).toBeInTheDocument()
    expect(screen.getByText(/quedan \d+ días/)).toBeInTheDocument()
  })

  it('cambia a «empezar ahora» y avisa de que el tiempo anterior no se suma', async () => {
    const user = userEvent.setup()
    render(<RegalarPlanModal usuario={USUARIO} onClose={() => {}} notify={() => {}} />)

    await user.click(screen.getByText(/Empezar ahora/i))
    expect(screen.getByText(/Empieza a contar ahora \(30 días\)/i)).toBeInTheDocument()
  })

  it('envía el regalo con el pack, los días y el motivo elegidos', async () => {
    const user = userEvent.setup()
    const notify = jest.fn()
    const onClose = jest.fn()
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        resumen: 'Unlimited hasta el 29 de octubre de 2026',
        emailEnviado: true,
        cambiaTipo: false,
      }),
    })
    // En jsdom no hay fetch global: se inyecta para poder espiar el POST.
    ;(global as any).fetch = fetchMock

    render(<RegalarPlanModal usuario={USUARIO} onClose={onClose} notify={notify} />)

    await user.click(screen.getByText('Unlimited'))
    await user.click(screen.getByRole('button', { name: /90/i }))
    await user.type(screen.getByPlaceholderText(/acuerdo de colaboración/i), 'colaboración')
    await user.click(screen.getByRole('button', { name: /Regalar 90 días de Unlimited/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, opciones] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/admin/regalar-plan')
    const cuerpo = JSON.parse(String((opciones as RequestInit).body))
    expect(cuerpo).toMatchObject({
      userId: USUARIO.id,
      plan: 'unlimited',
      dias: 90,
      modo: 'extender',
      motivo: 'colaboración',
    })
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Unlimited'))
    expect(onClose).toHaveBeenCalled()
  })

  it('al quitar el pack el botón pasa a ser destructivo y no pide días', async () => {
    const user = userEvent.setup()
    render(<RegalarPlanModal usuario={USUARIO} onClose={() => {}} notify={() => {}} />)

    await user.click(screen.getByText('Sin pack'))
    expect(screen.getByRole('button', { name: /Quitar pack/i })).toBeInTheDocument()
    expect(screen.queryByText(/^Días$/)).not.toBeInTheDocument()
    expect(screen.getByText(/La cuenta vuelve al plan gratuito/i)).toBeInTheDocument()
  })
})
