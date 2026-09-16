import { createClient } from '@supabase/supabase-js'

/**
 * Limpia registros de auditoría antiguos (más de 90 días)
 * Útil para mantener la tabla pequeña y eficiente
 */
export async function limpiarAuditoriaAntigua(): Promise<{ eliminados: number; error?: string }> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Llamar a la función de PostgreSQL que ya creamos
    const { data, error } = await sb.rpc('limpiar_auditoria_antigua')

    if (error) {
      console.error('Error limpiando auditoría:', error)
      return { eliminados: 0, error: error.message }
    }

    return { eliminados: data || 0 }
  } catch (e: any) {
    console.error('Error en limpiarAuditoriaAntigua:', e)
    return { eliminados: 0, error: e.message }
  }
}

/**
 * Obtiene un resumen de cambios recientes
 */
export async function obtenerResumenAuditoria(dias: number = 7) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

    // Contar por tabla
    const { data: porTabla, error: errorTabla } = await sb
      .from('auditoria')
      .select('tabla_afectada, operacion')
      .gte('fecha_registro', fechaInicio)

    if (errorTabla) throw errorTabla

    const resumen: Record<string, Record<string, number>> = {}
    porTabla?.forEach(item => {
      if (!resumen[item.tabla_afectada]) {
        resumen[item.tabla_afectada] = { INSERT: 0, UPDATE: 0, DELETE: 0 }
      }
      resumen[item.tabla_afectada][item.operacion]++
    })

    // Contar total
    const total = porTabla?.length || 0

    return {
      total,
      porTabla: resumen,
      dias
    }
  } catch (e: any) {
    console.error('Error en obtenerResumenAuditoria:', e)
    return { total: 0, porTabla: {}, dias, error: e.message }
  }
}
