/**
 * Rendimiento del vendedor: reglas puras.
 *
 * Este módulo decide QUÉ se puede ver según el pack y QUÉ significa cada cifra.
 * No toca la base de datos ni la red, así que se puede probar con números
 * fijos: los umbrales de «este anuncio no funciona» son justo lo que no
 * queremos cambiar por accidente.
 *
 * La escalera de valor es deliberada. El plan gratuito ya ve sus totales (es
 * su anuncio, no se le esconde), pero el detalle útil —contactos por anuncio,
 * diagnóstico, comparativa de mercado, evolución y exportación— es lo que
 * justifica pagar:
 *
 *   Gratis      totales del periodo
 *   Gratis      totales del periodo
 *   Plus        + mercado, serie diaria y precio frente a la mediana de su categoría
 *   Profesional todo: detalle, mercado, 90 días y CSV
 */

export type NivelPlan = 0 | 1 | 2 | 3

/**
 * Con un solo plan de pago ya no hay escalera: gratis ve totales y
 * Profesional lo ve todo. Los valores antiguos se conservan por si algún
 * perfil quedó con ellos en la base.
 */
const NIVELES: Record<string, NivelPlan> = {
  gratis: 0,
  starter: 1,
  plus: 3,
  unlimited: 3,
}

/** Nivel de un plan. Cualquier valor raro cae a gratis (falla cerrado). */
export function nivelPlan(plan: string | null | undefined): NivelPlan {
  return NIVELES[plan || 'gratis'] ?? 0
}

export interface Capacidades {
  /** Totales del periodo: visitas, favoritos, contactos, activos. */
  totales: boolean
  /** Filas por anuncio con visitas, favoritos y contactos del periodo. */
  porAnuncio: boolean
  /** Diagnóstico automático («muchas visitas y ningún contacto»…). */
  diagnostico: boolean
  /** Serie diaria de visitas. */
  serie: boolean
  /** Comparativa con la categoría: precio mediano y días hasta vender. */
  mercado: boolean
  /** Comparar el precio de cada anuncio con la mediana de su categoría. */
  precioVsMercado: boolean
  /** Descargar el informe en CSV. */
  exportar: boolean
}

export function capacidades(plan: string | null | undefined): Capacidades {
  const nivel = nivelPlan(plan)
  return {
    totales: true,
    porAnuncio: nivel >= 1,
    diagnostico: nivel >= 1,
    serie: nivel >= 2,
    mercado: nivel >= 2,
    precioVsMercado: nivel >= 2,
    exportar: nivel >= 3,
  }
}

/** Periodos que ofrece el panel. 90 días es la vista «profesional». */
export const PERIODOS = [7, 30, 90] as const
export type Periodo = (typeof PERIODOS)[number]

export function normalizarPeriodo(valor: unknown): Periodo {
  const n = Number(valor)
  return (PERIODOS as readonly number[]).includes(n) ? (n as Periodo) : 30
}

/** Un periodo de 90 días necesita Profesional; 7 y 30 están en todos. */
export function periodoPermitido(periodo: Periodo, plan: string | null | undefined): boolean {
  return periodo !== 90 || nivelPlan(plan) >= 3
}

// ── Diagnóstico por anuncio ────────────────────────────────────────────────

export type Tono = 'ok' | 'aviso' | 'malo' | 'neutro'

export interface Diagnostico {
  clave:
    | 'vendido'
    | 'pausado'
    | 'nuevo'
    | 'sin-visitas'
    | 'sin-contactos'
    | 'funciona'
    | 'normal'
  etiqueta: string
  sugerencia: string
  tono: Tono
}

/**
 * Qué decir de un anuncio a partir de sus números del periodo.
 *
 * Los umbrales están pensados para 30 días y no dependen del pack: 30 visitas
 * es el mínimo para que un «0 contactos» signifique algo (con 4 visitas no
 * dice nada, es ruido). Con 7 días se relajan las visitas mínimas y con 90 se
 * mantienen, porque el porcentaje ya está normalizado por tiempo.
 */
export function diagnosticoAnuncio(opts: {
  visitas: number
  favoritos: number
  contactos: number
  diasPublicado: number
  activo?: boolean
  vendido?: boolean
  pausadoPorPlan?: boolean
}): Diagnostico {
  const visitas = Math.max(0, Number(opts.visitas) || 0)
  const contactos = Math.max(0, Number(opts.contactos) || 0)
  const favoritos = Math.max(0, Number(opts.favoritos) || 0)
  const dias = Math.max(0, Number(opts.diasPublicado) || 0)

  if (opts.vendido) {
    return {
      clave: 'vendido',
      etiqueta: 'Vendido',
      sugerencia: 'Ya está vendido. Duplícalo si te entra otra unidad igual.',
      tono: 'neutro',
    }
  }

  if (opts.pausadoPorPlan || opts.activo === false) {
    return {
      clave: 'pausado',
      etiqueta: opts.pausadoPorPlan ? 'Pausado por cupo' : 'Pausado',
      sugerencia: 'No se está mostrando. Reactívalo cuando tengas hueco en tu plan.',
      tono: 'aviso',
    }
  }

  if (dias < 7) {
    return {
      clave: 'nuevo',
      etiqueta: 'Recién publicado',
      sugerencia: 'Aún es pronto para sacar conclusiones: deja pasar una semana.',
      tono: 'neutro',
    }
  }

  if (visitas === 0) {
    return {
      clave: 'sin-visitas',
      etiqueta: 'Sin visitas',
      sugerencia:
        'No lo está viendo nadie. Revisa el título y la portada, y compártelo en tus redes o por WhatsApp.',
      tono: 'malo',
    }
  }

  if (visitas >= 30 && contactos === 0) {
    return {
      clave: 'sin-contactos',
      etiqueta: 'Visitas sin contactos',
      sugerencia:
        visitas >= 100
          ? 'Mucho tráfico y ninguna pregunta: el precio está por encima de lo que espera el comprador. Bájalo un 5–10 % o añade más fotos del interior.'
          : 'Recibe visitas pero nadie escribe. Revisa el precio frente a otros anuncios parecidos y completa la descripción.',
      tono: 'malo',
    }
  }

  const tasa = visitas > 0 ? contactos / visitas : 0
  if (contactos >= 2 && tasa >= 0.05) {
    return {
      clave: 'funciona',
      etiqueta: 'Funciona',
      sugerencia: `Te escriben ${Math.round(tasa * 100)} de cada 100 visitas. Mantén las fotos y el precio donde están.`,
      tono: 'ok',
    }
  }

  if (favoritos >= 5 && contactos === 0) {
    return {
      clave: 'sin-contactos',
      etiqueta: 'Guardado, sin consultas',
      sugerencia:
        'A mucha gente le interesa (lo guardan) pero no da el paso. Responde rápido en el chat y añade el precio en el título.',
      tono: 'aviso',
    }
  }

  return {
    clave: 'normal',
    etiqueta: 'Normal',
    sugerencia: 'Sin señales raras. Si quieres más visibilidad, destácalo unos días.',
    tono: 'neutro',
  }
}

// ── Comparativa ────────────────────────────────────────────────────────────

/** Porcentaje de visitas que acaban en una conversación. */
export function tasaContacto(contactos: number, visitas: number): number | null {
  if (!visitas || visitas <= 0) return null
  return (Math.max(0, contactos) / visitas) * 100
}

/**
 * Diferencia porcentual entre dos precios, redondeada.
 * Positivo = el tuyo es más caro que la mediana.
 */
export function diferenciaPrecio(precio: number | null | undefined, mediana: number | null | undefined): number | null {
  if (!precio || !mediana || precio <= 0 || mediana <= 0) return null
  return Math.round(((precio - mediana) / mediana) * 100)
}

export interface ComparativaVentas {
  /** Días medianos propios (null si aún no ha vendido nada). */
  diasMios: number | null
  /** Días medianos de su categoría (null si no hay muestra suficiente). */
  diasMercado: number | null
  /** Cuánto más rápido (negativo) o más lento (positivo) vende, en %. */
  diferencia: number | null
  titulo: string
  detalle: string
  tono: Tono
}

/**
 * Compara el tiempo hasta la venta con el de la categoría.
 *
 * Con menos de 3 ventas propias no se saca conclusión: un solo coche vendido
 * en 2 días no significa que vendas rápido, significa que tuviste suerte.
 */
export function compararVentas(opts: {
  diasMios: number | null | undefined
  diasMercado: number | null | undefined
  ventasPropias?: number | null
  ventasMercado?: number | null
}): ComparativaVentas {
  const diasMios = Number.isFinite(Number(opts.diasMios)) && Number(opts.diasMios) > 0
    ? Math.round(Number(opts.diasMios))
    : null
  const diasMercado = Number.isFinite(Number(opts.diasMercado)) && Number(opts.diasMercado) > 0
    ? Math.round(Number(opts.diasMercado))
    : null
  const ventasPropias = Number(opts.ventasPropias) || 0
  const ventasMercado = Number(opts.ventasMercado) || 0

  if (ventasMercado < 3 || diasMercado == null) {
    return {
      diasMios,
      diasMercado: null,
      diferencia: null,
      titulo: 'Aún no hay suficiente mercado para comparar',
      detalle:
        'Cuando se vendan más anuncios de tu categoría podrás ver si vendes más rápido o más lento que la media.',
      tono: 'neutro',
    }
  }

  if (ventasPropias < 3 || diasMios == null) {
    return {
      diasMios,
      diasMercado,
      diferencia: null,
      titulo: `En tu categoría se tarda ${diasMercado} días de media`,
      detalle: 'Vende 3 anuncios y te diremos si vas por delante o por detrás.',
      tono: 'neutro',
    }
  }

  const diferencia = Math.round(((diasMios - diasMercado) / diasMercado) * 100)

  if (diferencia <= -15) {
    return {
      diasMios,
      diasMercado,
      diferencia,
      titulo: `Vendes un ${Math.abs(diferencia)} % más rápido que tu categoría`,
      detalle: `Tardas ${diasMios} días frente a ${diasMercado} de mediana. Buen precio y buen anuncio.`,
      tono: 'ok',
    }
  }
  if (diferencia >= 15) {
    return {
      diasMios,
      diasMercado,
      diferencia,
      titulo: `Vendes un ${diferencia} % más lento que tu categoría`,
      detalle: `Tardas ${diasMios} días frente a ${diasMercado} de mediana. Revisa precio y fotos de los que menos visitas reciben.`,
      tono: 'aviso',
    }
  }
  return {
    diasMios,
    diasMercado,
    diferencia,
    titulo: 'Vas en línea con tu categoría',
    detalle: `Tardas ${diasMios} días y la mediana es ${diasMercado}.`,
    tono: 'neutro',
  }
}

/**
 * Rellena los días sin visitas con 0 para que la gráfica no mienta.
 *
 * `serie` llega solo con los días que tuvieron visitas. Si se pinta tal cual,
 * un hueco de cuatro días parece continuidad y la caída no se ve.
 */
export function rellenarSerie(
  dias: number,
  puntos: { dia: string; visitas: number }[] | null | undefined,
  ahora: Date = new Date(),
): { dia: string; visitas: number }[] {
  const pedidos = Number(dias)
  const total = Number.isFinite(pedidos)
    ? Math.max(1, Math.min(365, Math.round(pedidos)))
    : 30
  const mapa = new Map<string, number>()
  for (const p of puntos || []) {
    if (!p?.dia) continue
    mapa.set(String(p.dia).slice(0, 10), Number(p.visitas) || 0)
  }

  // Fechas en la zona del panel (Europa/Madrid) para que el último día sea
  // «hoy» también cuando el servidor corre en UTC.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const salida: { dia: string; visitas: number }[] = []
  const hoyMs = ahora.getTime()
  for (let i = total - 1; i >= 0; i--) {
    const dia = fmt.format(new Date(hoyMs - i * 86400000))
    salida.push({ dia, visitas: mapa.get(dia) ?? 0 })
  }
  return salida
}

// ── Textos para el panel ───────────────────────────────────────────────────

/** «hace 3 días» / «hoy» para la antigüedad de un anuncio. */
export function antiguedad(diasPublicado: number): string {
  const d = Math.max(0, Math.round(Number(diasPublicado) || 0))
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  return `hace ${d} días`
}

/** Mensaje del upsell según lo que esté viendo y su plan. */
export function motivoUpsell(
  capacidad: 'porAnuncio' | 'serie' | 'mercado' | 'exportar' | 'periodo90',
): { titulo: string; detalle: string } {
  switch (capacidad) {
    case 'porAnuncio':
      return {
        titulo: 'Mira qué anuncio te trae compradores',
        detalle:
          'Con Profesional ves visitas, favoritos y contactos de cada anuncio, y un diagnóstico de qué cambiar.',
      }
    case 'serie':
      return {
        titulo: 'Descubre si tu stock está subiendo o bajando',
        detalle:
          'Profesional añade la evolución diaria de 90 días y la comparativa con el resto de tu categoría.',
      }
    case 'mercado':
      return {
        titulo: 'Compara tu precio con el mercado',
        detalle:
          'Profesional te dice el precio mediano de tu categoría y cuánto tarda en venderse un anuncio como el tuyo.',
      }
    case 'exportar':
      return {
        titulo: 'Llévate el informe a tu hoja de cálculo',
        detalle: 'Profesional permite descargar el rendimiento de todos tus anuncios en CSV.',
      }
    case 'periodo90':
      return {
        titulo: 'Necesitas más perspectiva',
        detalle: 'El periodo de 90 días está incluido en Profesional.',
      }
  }
}
