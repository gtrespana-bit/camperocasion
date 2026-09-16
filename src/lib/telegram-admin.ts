/**
 * Avisos al admin por Telegram (best-effort).
 *
 * Existe para que las acciones que requieren intervención humana (una reserva
 * con señal que hay que verificar, un expediente que hay que revisar) lleguen al
 * móvil sin tener que mirar el panel. Es el mismo canal que usa el panel de
 * administración (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`).
 *
 * Nunca lanza: estos avisos no pueden tumbar la acción del usuario.
 */

const TIMEOUT_MS = 5_000

export async function notificarAdminTelegram(texto: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId || !texto) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Telegram no interpreta HTML por defecto: se manda texto plano para que
      // un título con `<>` no rompa el envío.
      body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4000) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok
  } catch (err: any) {
    console.warn('Aviso a Telegram no enviado:', err?.message)
    return false
  }
}
