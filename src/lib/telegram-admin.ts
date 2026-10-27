/**
 * Avisos al admin por Telegram (best-effort, pero con timeout y reintento).
 *
 * Existe para que las acciones que requieren intervención humana (una reserva
 * con señal que hay que verificar, un expediente que hay que revisar, una
 * publicación marcada como sospechosa) lleguen al móvil sin tener que mirar el
 * panel. Es el mismo canal que usa el panel de administración
 * (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`).
 *
 * Nunca lanza: estos avisos no pueden tumbar la acción del usuario. Pero un
 * fallo silencioso tampoco vale: se registra en consola con un prefijo
 * filtrable y, si se piden reintentos, se vuelve a intentar en errores de red,
 * 429 y 5xx. Cada intento tiene su propio timeout de 5 s (un `fetch` sin
 * `signal` podía dejar colgada la función serverless indefinidamente).
 */

const TIMEOUT_MS = 5_000

export interface OpcionesAvisoTelegram {
  /** Reintentos adicionales (0 = un solo intento, máximo 2). */
  reintentos?: number
}

export async function notificarAdminTelegram(
  texto: string,
  opciones: OpcionesAvisoTelegram = {},
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId || !texto) return false

  const intentos = 1 + Math.min(Math.max(opciones.reintentos ?? 0, 0), 2)
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const body = JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4000) })

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Telegram no interpreta HTML por defecto: texto plano para que un
        // título con `<>` no rompa el envío ni permita inyección.
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) return true

      // 4xx distinto de 429 (token/chat incorrectos, mensaje inválido) no se
      // arregla reintentando; sí lo hacen 429 y los errores del servidor.
      const reintentable = res.status === 429 || res.status >= 500
      console.error(`[telegram] sendMessage ${res.status} (intento ${intento}/${intentos})`)
      if (!reintentable || intento === intentos) return false
    } catch (err: any) {
      console.warn(`[telegram] error en intento ${intento}/${intentos}:`, err?.message || err)
      if (intento === intentos) return false
    }
  }

  return false
}
