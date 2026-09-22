import { normalizarTab, TABS_VALIDOS } from '@/app/[locale]/dashboard/components/DashboardNav'

describe('normalizarTab', () => {
  it('cae a inicio si no hay tab', () => {
    expect(normalizarTab(null)).toBe('resumen')
    expect(normalizarTab('inventado')).toBe('resumen')
  })

  it('mapea las pestañas antiguas a las nuevas', () => {
    expect(normalizarTab('reservas')).toBe('tratos')
    expect(normalizarTab('inspecciones')).toBe('tratos')
    expect(normalizarTab('verificacion')).toBe('cuenta')
    expect(normalizarTab('reputacion')).toBe('cuenta')
  })

  it('conserva las pestañas nuevas', () => {
    for (const t of TABS_VALIDOS) {
      expect(normalizarTab(t)).toBe(t)
    }
  })
})
