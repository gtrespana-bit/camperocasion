/**
 * Reglas de los avisos al vendedor.
 *
 * Aquí es donde se venden los créditos: no en la página de precios, sino en el
 * momento exacto en que el vendedor ve que su anuncio ha perdido posiciones y
 * puede arreglarlo por 1 crédito.
 *
 * El riesgo de esto es convertirse en spam. Un vendedor que recibe cuatro
 * correos de «sube tu anuncio» deja de leerlos y acaba dándose de baja, así
 * que las reglas están escritas para **avisar poco y avisar bien**:
 *
 *  · Un único aviso por anuncio y ciclo de boost (nada de recordatorios).
 *  · Solo cuando el aviso es accionable: si ya está subido, no hay nada que
 *    hacer y no se molesta.
 *  · Solo con señal de demanda (el anuncio tiene visitas): si nadie lo ve,
 *    subirlo no es la solución y venderle un crédito sería estafarle.
 *  · Nunca a anuncios vendidos, inactivos o de demostración.
 */
import { BOOST_DIAS } from '@/lib/catalog-consulta'

/** Días de gracia tras caducar el boost antes de avisar. */
export const DIAS_GRACIA_AVISO = 1

/** No se vuelve a avisar del mismo anuncio en este plazo. */
export const DIAS_ENTRE_AVISOS = 14

/** Visitas mínimas para que subir el anuncio tenga sentido. */
export const VISITAS_MINIMAS_AVISO = 10

/** Antigüedad a partir de la cual un anuncio sin boost se considera hundido. */
export const DIAS_PARA_HUNDIRSE = 14

export interface AnuncioParaAviso {
  id: string
  user_id: string
  titulo: string
  visitas?: number | null
  creado_en?: string | null
  boosteado_en?: string | null
  activo?: boolean | null
  vendido?: boolean | null
  es_demo?: boolean | null
  /** Fecha del último aviso enviado sobre este anuncio. */
  ultimo_aviso_en?: string | null
}

export type MotivoAviso = 'boost-caducado' | 'anuncio-hundido'

export interface Aviso {
  productoId: string
  userId: string
  titulo: string
  motivo: MotivoAviso
  visitas: number
  /** Días que lleva el anuncio sin visibilidad reforzada. */
  diasSinVisibilidad: number
}

const dias = (desde: string | null | undefined, ahoraMs: number): number | null => {
  if (!desde) return null
  const t = new Date(desde).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((ahoraMs - t) / 864e5)
}

/**
 * Decide si un anuncio merece aviso. Devuelve `null` cuando no, que es el caso
 * mayoritario y deseable.
 */
export function evaluarAviso(a: AnuncioParaAviso, ahoraMs = Date.now()): Aviso | null {
  // 1. Descartes duros: nada que promocionar.
  if (a.activo === false) return null
  if (a.vendido) return null
  if (a.es_demo) return null

  // 2. Si ya está subido, no hay nada accionable: avisar sería ruido.
  const diasBoost = dias(a.boosteado_en, ahoraMs)
  if (diasBoost != null && diasBoost < BOOST_DIAS) return null

  // 3. No repetir avisos: el segundo recordatorio es el que quema al usuario.
  const diasUltimoAviso = dias(a.ultimo_aviso_en, ahoraMs)
  if (diasUltimoAviso != null && diasUltimoAviso < DIAS_ENTRE_AVISOS) return null

  // 4. Tiene que haber demanda. Sin visitas, el problema no es la posición
  //    (será el precio o las fotos) y venderle un boost no le va a servir.
  const visitas = Number(a.visitas || 0)
  if (visitas < VISITAS_MINIMAS_AVISO) return null

  // 5a. Boost caducado hace poco: el mejor momento, acaba de perder posiciones.
  if (diasBoost != null) {
    const desdeCaducidad = diasBoost - BOOST_DIAS
    if (desdeCaducidad >= DIAS_GRACIA_AVISO) {
      return {
        productoId: a.id,
        userId: a.user_id,
        titulo: a.titulo,
        motivo: 'boost-caducado',
        visitas,
        diasSinVisibilidad: desdeCaducidad,
      }
    }
    return null
  }

  // 5b. Nunca promocionado y ya lleva tiempo publicado: se ha hundido en el
  //     catálogo, que ordena por fecha.
  const diasPublicado = dias(a.creado_en, ahoraMs)
  if (diasPublicado != null && diasPublicado >= DIAS_PARA_HUNDIRSE) {
    return {
      productoId: a.id,
      userId: a.user_id,
      titulo: a.titulo,
      motivo: 'anuncio-hundido',
      visitas,
      diasSinVisibilidad: diasPublicado,
    }
  }

  return null
}

/** Máximo de avisos por vendedor en una misma pasada. */
export const MAX_AVISOS_POR_VENDEDOR = 1

/**
 * Filtra una lista de anuncios y devuelve los avisos a enviar, con un tope por
 * vendedor: alguien con 15 anuncios caducados recibiría 15 notificaciones el
 * mismo día, que es la forma más rápida de que silencie la app. Se prioriza el
 * anuncio con más visitas, que es el que más tiene que ganar.
 */
export function seleccionarAvisos(
  anuncios: AnuncioParaAviso[],
  ahoraMs = Date.now()
): Aviso[] {
  const porVendedor = new Map<string, Aviso[]>()

  for (const a of anuncios) {
    const aviso = evaluarAviso(a, ahoraMs)
    if (!aviso) continue
    const lista = porVendedor.get(aviso.userId)
    if (lista) lista.push(aviso)
    else porVendedor.set(aviso.userId, [aviso])
  }

  const resultado: Aviso[] = []
  for (const lista of porVendedor.values()) {
    lista.sort((x, y) => y.visitas - x.visitas)
    resultado.push(...lista.slice(0, MAX_AVISOS_POR_VENDEDOR))
  }
  return resultado
}

/**
 * Texto del aviso. Se escribe aquí para que push y email digan lo mismo y para
 * que el mensaje sea concreto: un aviso genérico («promociona tus anuncios»)
 * no convierte, uno con el dato sí.
 */
export function textoAviso(aviso: Aviso): { titulo: string; cuerpo: string } {
  if (aviso.motivo === 'boost-caducado') {
    return {
      titulo: 'Tu anuncio ha bajado de posición',
      cuerpo: `"${aviso.titulo}" ya no aparece destacado y lleva ${aviso.diasSinVisibilidad} ${aviso.diasSinVisibilidad === 1 ? 'día' : 'días'} perdiendo visibilidad. Ha tenido ${aviso.visitas} visitas: súbelo al principio del catálogo por 1 crédito.`,
    }
  }
  return {
    titulo: 'Tu anuncio se está hundiendo en el catálogo',
    cuerpo: `"${aviso.titulo}" lleva ${aviso.diasSinVisibilidad} días publicado y ya está lejos de la primera página. Con ${aviso.visitas} visitas hay interés: súbelo al nº 1 por 1 crédito.`,
  }
}
