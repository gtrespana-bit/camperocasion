/**
 * Vigilancia del runtime de Node.js en producción.
 *
 * Vercel decide el parche de Node que ejecuta cada función; el repositorio solo
 * puede fijar la rama (`engines.node`) y comprobarla en ejecución. Mientras su
 * rollout va por detrás del parche de seguridad, hay que saber cuándo cambia
 * sin mirar el endpoint a mano todos los días.
 *
 * Aquí vive la lógica pura (sin red ni base de datos) para que se pueda probar:
 * el cron `/api/cron/runtime-check` la usa y guarda el estado en
 * `plataforma_ajustes` (clave `runtime_node`).
 */
import { leerRuntimeNode, type RuntimeNode } from '@/lib/runtime-node'

export type EstadoRuntime = {
  node: string
  cumple: boolean
  commit: string | null
  region: string | null
  comprobado_en?: string
}

export type MotivoAviso =
  | 'parcheado'      // la versión por fin cumple el mínimo
  | 'sin-parchear'   // sigue por debajo, pero es una versión distinta de la última vista
  | 'regresion'      // estaba parcheada y ha vuelto a una versión vulnerable
  | 'sin-cambio'

export type DecisionAviso = {
  avisar: boolean
  motivo: MotivoAviso
  texto: string
}

export function estadoDesdeRuntime(info: RuntimeNode, ahora: Date = new Date()): EstadoRuntime {
  return {
    node: info.node,
    cumple: info.cumple,
    commit: info.commit,
    region: info.region,
    comprobado_en: ahora.toISOString(),
  }
}

/**
 * ¿Hay que avisar? Reglas, pensadas para no mandar un mensaje al día:
 *
 * - Primera comprobación: solo avisa si ya está parcheado (buena noticia) o si
 *   está por debajo del mínimo (para dejar constancia una vez).
 * - Cambio de versión: avisa siempre, porque es la señal de que Vercel ha
 *   movido el runtime. Lo importante es el salto a `cumple: true`.
 * - Misma versión que la última vez: silencio.
 */
export function decidirAviso(
  anterior: EstadoRuntime | null,
  actual: EstadoRuntime,
  minimo: string,
): DecisionAviso {
  const sitio = actual.region ? ` (región ${actual.region})` : ''
  const commit = actual.commit ? ` · commit ${actual.commit}` : ''

  const texto = (cuerpo: string) => `${cuerpo}${sitio}${commit}`

  if (actual.cumple && (!anterior || !anterior.cumple)) {
    return {
      avisar: true,
      motivo: 'parcheado',
      texto: texto(
        `✅ Producción ya ejecuta Node.js ${actual.node}, que cumple el mínimo ${minimo}.\n` +
        'Ya se puede rotar (otra vez) la clave de Stripe con el entorno parcheado.',
      ),
    }
  }

  if (!actual.cumple && anterior?.cumple) {
    return {
      avisar: true,
      motivo: 'regresion',
      texto: texto(
        `⚠️ Producción ha vuelto a Node.js ${actual.node}, por debajo del mínimo ${minimo}. ` +
        'Revisa el despliegue y el WAF.',
      ),
    }
  }

  if (!actual.cumple && (!anterior || anterior.node !== actual.node)) {
    return {
      avisar: true,
      motivo: 'sin-parchear',
      texto: texto(
        `ℹ️ Producción ejecuta Node.js ${actual.node}, por debajo del mínimo ${minimo}. ` +
        'Sigue pendiente del rollout de Vercel; el WAF cubre el vector de entrada.',
      ),
    }
  }

  return { avisar: false, motivo: 'sin-cambio', texto: '' }
}

/** Estado actual del proceso que atiende la petición. */
export function estadoActual(ahora: Date = new Date()): { info: RuntimeNode; estado: EstadoRuntime } {
  const info = leerRuntimeNode()
  return { info, estado: estadoDesdeRuntime(info, ahora) }
}
