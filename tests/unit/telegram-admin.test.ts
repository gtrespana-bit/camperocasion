import { notificarAdminTelegram } from '@/lib/telegram-admin'

describe('notificarAdminTelegram (auditoría punto 8)', () => {
  const fetchMock = jest.fn()

  beforeAll(() => {
    // jsdom no siempre trae AbortSignal.timeout; en producción sí existe
    // (Node >= 18). Lo simulamos para poder comprobar que se pasa la señal.
    const anySignal = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }
    if (typeof anySignal.timeout !== 'function') {
      anySignal.timeout = () => new AbortController().signal
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(globalThis as any).fetch = fetchMock
    process.env.TELEGRAM_BOT_TOKEN = 'token-de-prueba'
    process.env.TELEGRAM_CHAT_ID = 'chat-1'
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('no llama a Telegram si faltan las variables de entorno', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    expect(await notificarAdminTelegram('hola')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía con timeout y devuelve true', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 })
    expect(await notificarAdminTelegram('alerta')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const opciones = fetchMock.mock.calls[0][1]
    expect(opciones.signal).toBeDefined()
    expect(opciones.body).toContain('"text":"alerta"')
  })

  it('reintenta un 500 y no reintenta un 400', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    expect(await notificarAdminTelegram('aviso', { reintentos: 1 })).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockReset().mockResolvedValueOnce({ ok: false, status: 400 })
    expect(await notificarAdminTelegram('aviso', { reintentos: 1 })).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un error de red se registra y devuelve false', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    expect(await notificarAdminTelegram('aviso')).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})
