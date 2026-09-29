/**
 * Parte servidor de la analítica propia: nada de cálculo, solo acceso a datos
 * que no puede vivir en `src/lib/analitica.ts` (que también importa el panel).
 */

import { sbAdmin } from '@/lib/planes-servidor'

/** Días de visitas que se conservan por defecto (algo más de un año). */
export const DIAS_RETENCION_VISITAS = 400

/**
 * Borra las visitas más antiguas que `dias` llamando a la función SQL
 * `limpiar_visitas_antiguas`. La llama el cron diario, junto a la limpieza del
 * rate limit: sin esto la tabla crecería para siempre.
 */
export async function limpiarVisitasAntiguas(
  dias: number = DIAS_RETENCION_VISITAS,
): Promise<{ eliminados: number; error?: string }> {
  try {
    const sb = sbAdmin()
    const { data, error } = await sb.rpc('limpiar_visitas_antiguas', { p_dias: dias })
    if (error) {
      // Si la migración no está aplicada no hay nada que limpiar: no es un
      // fallo del cron, pero se registra para poder verlo.
      if (!/does not exist|schema cache/i.test(error.message || '')) {
        console.error('Error limpiando visitas:', error.message)
      }
      return { eliminados: 0, error: error.message }
    }
    return { eliminados: Number(data) || 0 }
  } catch (e: any) {
    console.error('Error en limpiarVisitasAntiguas:', e)
    return { eliminados: 0, error: e?.message }
  }
}
