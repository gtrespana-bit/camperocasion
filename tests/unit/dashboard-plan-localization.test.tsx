import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TabPlan from '@/app/[locale]/dashboard/components/tabs/TabPlan'
import en from '@/i18n/dictionaries/en.json'
import es from '@/i18n/dictionaries/es.json'

jest.mock('next-intl', () => {
  const messages = require('@/i18n/dictionaries/en.json').planTab as Record<string, string>
  const translate = (key: string, values?: Record<string, string | number>) => {
    let text = messages[key] || key
    for (const [name, value] of Object.entries(values || {})) text = text.replaceAll(`{${name}}`, String(value))
    return text
  }
  return { useLocale: () => 'en', useTranslations: () => translate }
})
jest.mock('@/components/LocalLink', () => ({ __esModule: true, default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))

const freeState = {
  ok: true,
  tipo: 'particular', plan: 'gratis', planContratado: 'gratis', planHasta: null,
  planPagoVigente: false, suscripcionStripe: false, gestionable: false,
  trial: false, trialHasta: null, diasTrial: 0, diasTrialTotal: 30,
  trialElegible: false, trialGracia: false, pagoFallido: false,
  creditos: 2, pausadosPorPlan: 0,
  cupo: {
    max: 1, usados: 0, restantes: 1, puedePublicar: true, plan: 'gratis',
    fotosMax: 10, destacadosMes: 0, destacadosUsados: 0, destacadosRestantes: 0,
    trial: false, tipo: 'particular',
  },
}

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

test('English free plan shows translated quota, benefits and seller identity without Spanish plan copy', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => freeState })
  render(<TabPlan />)
  expect(await screen.findByText(en.planTab.capacity)).toBeInTheDocument()
  expect(screen.getByText(en.planTab.photos)).toBeInTheDocument()
  expect(screen.getByText('15 concurrent active listings')).toBeInTheDocument()
  expect(screen.getByText(en.planTab.typeTitle)).toBeInTheDocument()
  expect(screen.getByText(en.planTab.freeSummary.replace('{listings}', '1').replace('{photos}', '10'))).toBeInTheDocument()
  expect(screen.queryByText('Tu capacidad ahora')).not.toBeInTheDocument()
  expect(screen.queryByText('15 anuncios activos a la vez')).not.toBeInTheDocument()
})

test('failed payment has English messaging and sends locale to Stripe portal', async () => {
  mockFetch.mockImplementation(async (url: string) => url === '/api/planes/estado'
    ? { ok: true, json: async () => ({ ...freeState, plan: 'plus', planContratado: 'plus', planPagoVigente: true, suscripcionStripe: true, gestionable: true, pagoFallido: true }) }
    : { ok: false, json: async () => ({ error: 'El portal no está disponible' }) })
  render(<TabPlan />)
  fireEvent.click(await screen.findByRole('button', { name: en.planTab.manageSubscription }))
  await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/planes/portal', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ locale: 'en' }),
  })))
  expect(await screen.findByText(en.planTab.portalError)).toBeInTheDocument()
  expect(screen.queryByText('El portal no está disponible')).not.toBeInTheDocument()
  expect(screen.getByText(en.planTab.failedTitle)).toBeInTheDocument()
})

test('starting a trial keeps the existing API and refreshes plan state in English', async () => {
  const onRefresh = jest.fn()
  const updatedState = { ...freeState, trial: true, trialElegible: false, trialHasta: '2026-11-30T12:00:00Z', diasTrial: 30 }
  mockFetch.mockImplementation(async (url: string) => {
    if (url === '/api/planes/prueba') return { ok: true, json: async () => ({ ok: true, reactivados: 0, hasta: updatedState.trialHasta }) }
    return { ok: true, json: async () => (mockFetch.mock.calls.length > 2 ? updatedState : { ...freeState, trialElegible: true }) }
  })
  render(<TabPlan onRefresh={onRefresh} />)
  fireEvent.click(await screen.findByRole('button', { name: en.planTab.startTrial }))
  await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  expect(mockFetch).toHaveBeenCalledWith('/api/planes/prueba', { method: 'POST' })
  expect(await screen.findByText(en.planTab.professionalTrial)).toBeInTheDocument()
  expect(screen.getAllByText(/30 November 2026/).length).toBeGreaterThan(0)
})

test('ES and EN plan tab translations have the same keys and placeholders', () => {
  expect(Object.keys(en.planTab).sort()).toEqual(Object.keys(es.planTab).sort())
  for (const key of Object.keys(en.planTab) as Array<keyof typeof en.planTab>) {
    const placeholders = (message: string) => [...message.matchAll(/\{([a-zA-Z]+)(?:,|\})/g)].map(match => match[1]).sort()
    expect(placeholders(en.planTab[key])).toEqual(placeholders(es.planTab[key]))
  }
})
