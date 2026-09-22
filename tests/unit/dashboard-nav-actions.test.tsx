import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import DashboardNav from '@/app/[locale]/dashboard/components/DashboardNav'

describe('DashboardNav: acciones en móvil y escritorio', () => {
  it('abre las nuevas secciones de cuenta y tratos', () => {
    const onChange = jest.fn()
    render(<DashboardNav active="resumen" onChange={onChange} onLogout={jest.fn()} />)

    for (const button of screen.getAllByRole('button', { name: 'Confianza y perfil' })) {
      fireEvent.click(button)
      expect(onChange).toHaveBeenLastCalledWith('cuenta')
    }
    for (const button of screen.getAllByRole('button', { name: 'Tratos' })) {
      fireEvent.click(button)
      expect(onChange).toHaveBeenLastCalledWith('tratos')
    }
  })

  it('permite cerrar sesión en ambas navegaciones', () => {
    const onLogout = jest.fn()
    render(<DashboardNav active="resumen" onChange={jest.fn()} onLogout={onLogout} />)

    const buttons = screen.getAllByRole('button', { name: 'Cerrar sesión' })
    expect(buttons).toHaveLength(2)
    buttons.forEach(button => fireEvent.click(button))
    expect(onLogout).toHaveBeenCalledTimes(2)
  })
})
