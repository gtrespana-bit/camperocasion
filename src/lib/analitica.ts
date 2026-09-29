/**
 * Analítica de audiencia: rangos, buckets y agregados.
 *
 * Vive aparte de la API y del panel a propósito, porque las dos los necesitan:
 * `GET /api/admin/estadisticas` construye el rango y, si la migración de
 * visitas aún no está aplicada, agrupa las filas con estas mismas funciones —
 * así el panel nunca queda a medias y el resultado es el mismo por los dos
 * caminos.
 *
 * Todo el cálculo de fechas se hace en hora peninsular (`Europe/Madrid`): el
 * servidor de Vercel corre en UTC y, sin esto, un negocio español vería el
 * «lunes» empezando a la 1 de la madrugada.
 */

import { getCiudadBySlug } from '@/lib/ubicaciones-seo'

export const ZONA_HORARIA = 'Europe/Madrid'

export type Granularidad = 'dia' | 'semana' | 'mes'
export type PresetRango =
  | 'hoy'
  | 'ayer'
  | '7d'
  | '30d'
  | '90d'
  | 'mes'
  | 'mes_pasado'
  | '12m'
  | 'todo'
  | 'personalizado'

export type TipoPagina =
  | 'home'
  | 'catalogo'
  | 'producto'
  | 'buscar'
  | 'categoria'
  | 'provincia'
  | 'tienda'
  | 'vendedor'
  | 'publicar'
  | 'blog'
  | 'acceso'
  | 'panel'
  | 'informativa'
  | 'otro'

export type Dispositivo = 'movil' | 'tablet' | 'escritorio'

export interface Rango {
  preset: PresetRango
  desde: Date
  hasta: Date
  granularidad: Granularidad
  etiqueta: string
}

export interface Bucket {
  clave: string
  etiqueta: string
  corta: string
}

export interface PuntoSerie extends Bucket {
  visitas: number
  visitantes: number
  sesiones: number
}

export interface FilaRanking {
  clave: string
  visitas: number
  visitantes: number
}

export interface ResumenVisitas {
  visitas: number
  visitantes: number
  sesiones: number
  /** Visitantes que no habían aparecido nunca antes del rango. `null` si no se pudo calcular. */
  nuevos: number | null
  recurrente: number | null
  paginasPorVisita: number | null
  duracionMedia: number | null
  serie: PuntoSerie[]
  dispositivos: FilaRanking[]
  idiomas: FilaRanking[]
  fuentes: FilaRanking[]
  topPaginas: (FilaRanking & { tipo: TipoPagina })[]
  horas: { hora: number; visitas: number }[]
  diasSemana: { dow: number; visitas: number }[]
}

export interface FilaVisitaAgregable {
  creado_en: string
  visitante_id: string
  sesion_id: string | null
  duracion_segundos: number | null
  dispositivo: string | null
  idioma: string | null
  referrer_host: string | null
  ruta: string
  tipo: string
}

/* ------------------------------------------------------------------ */
/* fechas en hora peninsular                                           */
/* ------------------------------------------------------------------ */

const FMT_MADRID = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

interface PartesFecha {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Partes de la fecha tal y como se ven en Madrid. */
export function partesMadrid(fecha: Date): PartesFecha {
  const partes = FMT_MADRID.formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value || 0)
  return {
    year: valor('year'),
    month: valor('month'),
    day: valor('day'),
    hour: valor('hour') % 24,
    minute: valor('minute'),
    second: valor('second'),
  }
}

/** Desplazamiento de Madrid respecto a UTC, en minutos, para esa fecha. */
export function offsetMadrid(fecha: Date): number {
  const p = partesMadrid(fecha)
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((comoUtc - fecha.getTime()) / 60000)
}

/** Instante UTC en el que empieza el día (en Madrid) al que pertenece `fecha`. */
export function inicioDiaMadrid(fecha: Date): Date {
  const p = partesMadrid(fecha)
  const mediodia = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  return new Date(mediodia.getTime() - offsetMadrid(mediodia) * 60000 - 12 * 3600000)
}

/** Instante UTC en el que empieza el mes (en Madrid) al que pertenece `fecha`. */
export function inicioMesMadrid(fecha: Date): Date {
  const p = partesMadrid(fecha)
  const mediodia = new Date(Date.UTC(p.year, p.month - 1, 1, 12, 0, 0))
  return new Date(mediodia.getTime() - offsetMadrid(mediodia) * 60000 - 12 * 3600000)
}

export function sumaDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86400000)
}

/** Suma meses cuidando el desbordamiento de día (31 ene + 1 mes = 28/29 feb). */
export function sumaMeses(fecha: Date, meses: number): Date {
  const p = partesMadrid(fecha)
  const total = p.year * 12 + (p.month - 1) + meses
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dia = Math.min(p.day, ultimoDia)
  const mediodia = new Date(Date.UTC(year, month - 1, dia, 12, 0, 0))
  return new Date(mediodia.getTime() - offsetMadrid(mediodia) * 60000 - 12 * 3600000)
}

/** 'YYYY-MM-DD' del día (en Madrid) al que pertenece la fecha. */
export function claveDia(fecha: Date): string {
  const p = partesMadrid(fecha)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' del lunes de la semana ISO a la que pertenece la fecha. */
export function inicioSemanaMadrid(fecha: Date): Date {
  const p = partesMadrid(fecha)
  const proxy = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const dow = proxy.getUTCDay() // 0 = domingo
  const delta = dow === 0 ? -6 : 1 - dow
  const lunes = new Date(proxy.getTime() + delta * 86400000)
  const mediodia = new Date(Date.UTC(
    lunes.getUTCFullYear(),
    lunes.getUTCMonth(),
    lunes.getUTCDate(),
    12,
    0,
    0,
  ))
  return new Date(mediodia.getTime() - offsetMadrid(mediodia) * 60000 - 12 * 3600000)
}

export function claveSemana(fecha: Date): string {
  return claveDia(inicioSemanaMadrid(fecha))
}

export function claveMes(fecha: Date): string {
  const p = partesMadrid(fecha)
  return `${p.year}-${String(p.month).padStart(2, '0')}`
}

export function claveBucket(fecha: Date, granularidad: Granularidad): string {
  if (granularidad === 'mes') return claveMes(fecha)
  if (granularidad === 'semana') return claveSemana(fecha)
  return claveDia(fecha)
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function etiquetaDia(fecha: Date): { etiqueta: string; corta: string } {
  const p = partesMadrid(fecha)
  return {
    etiqueta: `${p.day} ${MESES_CORTOS[p.month - 1]} ${p.year}`,
    corta: `${p.day} ${MESES_CORTOS[p.month - 1]}`,
  }
}

export function etiquetaBucket(clave: string, granularidad: Granularidad): Bucket {
  if (granularidad === 'mes') {
    const [year, month] = clave.split('-').map(Number)
    return {
      clave,
      etiqueta: `${MESES_CORTOS[(month || 1) - 1]} ${year}`,
      corta: MESES_CORTOS[(month || 1) - 1],
    }
  }
  const fecha = new Date(`${clave}T12:00:00Z`)
  if (granularidad === 'semana') {
    const fin = sumaDias(fecha, 6)
    const a = etiquetaDia(fecha)
    const b = etiquetaDia(fin)
    return { clave, etiqueta: `Semana del ${a.etiqueta}`, corta: `${a.corta} – ${b.corta}` }
  }
  const e = etiquetaDia(fecha)
  return { clave, etiqueta: e.etiqueta, corta: e.corta }
}

/** Lista de buckets completos del rango (incluye los periodos sin visitas). */
export function bucketsDelRango(rango: {
  desde: Date
  hasta: Date
  granularidad: Granularidad
}): Bucket[] {
  const buckets: Bucket[] = []
  const tope = sumaDias(rango.hasta, -1)
  let cursor =
    rango.granularidad === 'mes'
      ? inicioMesMadrid(rango.desde)
      : rango.granularidad === 'semana'
        ? inicioSemanaMadrid(rango.desde)
        : inicioDiaMadrid(rango.desde)

  let guardia = 0
  while (cursor.getTime() <= tope.getTime() && guardia < 800) {
    buckets.push(etiquetaBucket(claveBucket(cursor, rango.granularidad), rango.granularidad))
    cursor =
      rango.granularidad === 'mes'
        ? sumaMeses(cursor, 1)
        : sumaDias(cursor, rango.granularidad === 'semana' ? 7 : 1)
    guardia += 1
  }
  return buckets
}

/* ------------------------------------------------------------------ */
/* rangos                                                              */
/* ------------------------------------------------------------------ */

const ETIQUETAS_PRESET: Record<PresetRango, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  mes: 'Este mes',
  mes_pasado: 'Mes pasado',
  '12m': 'Últimos 12 meses',
  todo: 'Todo el histórico',
  personalizado: 'Rango personalizado',
}

export const PRESETS_RANGO: { id: PresetRango; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_pasado', label: 'Mes pasado' },
  { id: '90d', label: '90 días' },
  { id: '12m', label: '12 meses' },
  { id: 'todo', label: 'Todo' },
]

export function granularidadPorDefecto(preset: PresetRango): Granularidad {
  if (preset === '12m') return 'mes'
  if (preset === '90d') return 'semana'
  return 'dia'
}

function esFechaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

export function resolverRango(opts: {
  preset?: string | null
  desde?: string | null
  hasta?: string | null
  granularidad?: string | null
  ahora?: Date
}): Rango {
  const ahora = opts.ahora ?? new Date()
  const preset: PresetRango = (
    ['hoy', 'ayer', '7d', '30d', '90d', 'mes', 'mes_pasado', '12m', 'todo', 'personalizado'] as const
  ).includes(opts.preset as PresetRango)
    ? (opts.preset as PresetRango)
    : '30d'

  const finHoy = sumaDias(inicioDiaMadrid(ahora), 1)
  let desde: Date
  let hasta = finHoy

  switch (preset) {
    case 'hoy':
      desde = inicioDiaMadrid(ahora)
      break
    case 'ayer': {
      desde = sumaDias(inicioDiaMadrid(ahora), -1)
      hasta = inicioDiaMadrid(ahora)
      break
    }
    case '7d':
      desde = sumaDias(inicioDiaMadrid(ahora), -6)
      break
    case '30d':
      desde = sumaDias(inicioDiaMadrid(ahora), -29)
      break
    case '90d':
      desde = sumaDias(inicioDiaMadrid(ahora), -89)
      break
    case 'mes':
      desde = inicioMesMadrid(ahora)
      break
    case 'mes_pasado': {
      desde = sumaMeses(inicioMesMadrid(ahora), -1)
      hasta = inicioMesMadrid(ahora)
      break
    }
    case '12m':
      desde = sumaMeses(inicioMesMadrid(ahora), -11)
      break
    case 'todo':
      desde = new Date('2024-01-01T00:00:00Z')
      break
    default: {
      desde = esFechaValida(opts.desde) ? inicioDiaMadrid(new Date(`${opts.desde}T12:00:00Z`)) : sumaDias(inicioDiaMadrid(ahora), -29)
      hasta = esFechaValida(opts.hasta) ? sumaDias(inicioDiaMadrid(new Date(`${opts.hasta}T12:00:00Z`)), 1) : finHoy
      if (hasta.getTime() <= desde.getTime()) hasta = sumaDias(desde, 1)
      // Un rango personalizado desmedido dejaría el panel sin respuesta: se
      // recorta a 3 años, que es más de lo que guarda la retención.
      const maximo = 366 * 3
      if (hasta.getTime() - desde.getTime() > maximo * 86400000) {
        desde = sumaDias(hasta, -maximo)
      }
      break
    }
  }

  const granularidad: Granularidad = (['dia', 'semana', 'mes'] as const).includes(
    opts.granularidad as Granularidad,
  )
    ? (opts.granularidad as Granularidad)
    : granularidadPorDefecto(preset)

  return {
    preset,
    desde,
    hasta,
    granularidad,
    etiqueta: ETIQUETAS_PRESET[preset],
  }
}

/** Periodo inmediatamente anterior, de la misma duración (para comparar). */
export function rangoAnterior(rango: Rango): { desde: Date; hasta: Date } {
  const duracion = rango.hasta.getTime() - rango.desde.getTime()
  return {
    desde: new Date(rango.desde.getTime() - duracion),
    hasta: new Date(rango.desde.getTime()),
  }
}

/* ------------------------------------------------------------------ */
/* clasificación de rutas, dispositivos y fuentes                      */
/* ------------------------------------------------------------------ */

const RUTAS_FIJAS: Record<string, TipoPagina> = {
  '/': 'home',
  '/catalogo': 'catalogo',
  '/buscar': 'buscar',
  '/marcas': 'catalogo',
  '/modelo': 'catalogo',
  '/categoria': 'categoria',
  '/tiendas': 'tienda',
  '/blog': 'blog',
  '/publicar': 'publicar',
  '/login': 'acceso',
  '/register': 'acceso',
  '/reset-password': 'acceso',
  '/confirmacion': 'acceso',
  '/dashboard': 'panel',
  '/mi-perfil': 'panel',
  '/chat': 'panel',
  '/offline': 'otro',
}

/** Ruta sin query ni barra final; siempre empieza por `/`. */
export function normalizarRuta(ruta: string): string {
  if (!ruta || typeof ruta !== 'string') return '/'
  const limpia = ruta.split('?')[0].split('#')[0]
  const sinLocale = limpia.replace(/^\/(es|en)(?=\/|$)/, '') || '/'
  const conBarra = sinLocale.startsWith('/') ? sinLocale : `/${sinLocale}`
  return conBarra.length > 1 ? conBarra.replace(/\/+$/, '') : conBarra
}

/** Tipo de página y slug de anuncio (si la ruta es una ficha de producto). */
export function clasificarRuta(rutaOriginal: string): { tipo: TipoPagina; slug: string | null } {
  const ruta = normalizarRuta(rutaOriginal)
  if (ruta === '/') return { tipo: 'home', slug: null }

  const partes = ruta.split('/').filter(Boolean)
  const primero = partes[0]

  if (ruta.startsWith('/producto/')) {
    const slug = partes[1] === 'editar' ? null : partes[1] || null
    return { tipo: 'producto', slug }
  }
  if (ruta.startsWith('/tienda/')) return { tipo: 'tienda', slug: partes[1] || null }
  if (ruta.startsWith('/vendedor/')) return { tipo: 'vendedor', slug: partes[1] || null }
  if (ruta.startsWith('/blog/')) return { tipo: 'blog', slug: partes[1] || null }
  if (ruta.startsWith('/categoria/')) return { tipo: 'categoria', slug: partes[1] || null }
  if (ruta.startsWith('/modelo/')) return { tipo: 'catalogo', slug: partes[1] || null }

  const fija = RUTAS_FIJAS[ruta]
  if (fija) return { tipo: fija, slug: null }

  // Landings SEO por provincia: `/madrid`, `/madrid/gran-volumen`…
  if (primero && getCiudadBySlug(primero)) return { tipo: 'provincia', slug: primero }

  return { tipo: 'informativa', slug: null }
}

export function dispositivoDesdeAncho(ancho: number): Dispositivo {
  if (!Number.isFinite(ancho) || ancho <= 0) return 'escritorio'
  if (ancho < 640) return 'movil'
  if (ancho < 1024) return 'tablet'
  return 'escritorio'
}

export function esDispositivoValido(valor: unknown): valor is Dispositivo {
  return valor === 'movil' || valor === 'tablet' || valor === 'escritorio'
}

/** Host limpio (sin www., en minúsculas) a partir de una URL de referrer. */
export function hostDesdeReferrer(referrer: string | null | undefined): string | null {
  if (!referrer || typeof referrer !== 'string') return null
  try {
    const url = new URL(referrer.startsWith('http') ? referrer : `https://${referrer}`)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

const FUENTES_CONOCIDAS: { id: string; label: string; hosts: RegExp }[] = [
  { id: 'google', label: 'Google', hosts: /(^|\.)google\./ },
  { id: 'bing', label: 'Bing', hosts: /(^|\.)bing\.com$/ },
  { id: 'duckduckgo', label: 'DuckDuckGo', hosts: /(^|\.)duckduckgo\.com$/ },
  { id: 'facebook', label: 'Facebook', hosts: /(^|\.)facebook\.com$|(^|\.)fb\.me$/ },
  { id: 'instagram', label: 'Instagram', hosts: /(^|\.)instagram\.com$/ },
  { id: 'tiktok', label: 'TikTok', hosts: /(^|\.)tiktok\.com$/ },
  { id: 'whatsapp', label: 'WhatsApp', hosts: /(^|\.)whatsapp\.com$|(^|\.)wa\.me$/ },
  { id: 'telegram', label: 'Telegram', hosts: /(^|\.)telegram\.(org|me)$|(^|\.)t\.me$/ },
  { id: 'youtube', label: 'YouTube', hosts: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/ },
  { id: 'wallapop', label: 'Wallapop', hosts: /(^|\.)wallapop\.com$/ },
  { id: 'milanuncios', label: 'Milanuncios', hosts: /(^|\.)milanuncios\.com$/ },
  { id: 'camperocasion', label: 'CamperOcasión (interno)', hosts: /(^|\.)camperocasion\.(online|es)$/ },
]

/**
 * Une los hosts de referrer en fuentes legibles. Es lo que responde a
 * «¿de dónde viene mi tráfico?» sin tablas de campañas.
 */
export function fuenteDeHost(host: string | null | undefined): string {
  if (!host || host === 'directo') return 'directo'
  const h = host.toLowerCase()
  const conocida = FUENTES_CONOCIDAS.find((f) => f.hosts.test(h))
  return conocida ? conocida.id : 'referido'
}

export function etiquetaFuente(id: string, hosts: string[] = []): string {
  const conocida = FUENTES_CONOCIDAS.find((f) => f.id === id)
  if (conocida) return conocida.label
  if (id === 'directo') return 'Directo / sin referrer'
  if (id === 'referido') return hosts.length ? `Otros: ${hosts.slice(0, 2).join(', ')}` : 'Otros referidos'
  return id
}

export function agruparFuentes(fuentes: FilaRanking[]): { clave: string; etiqueta: string; visitas: number; visitantes: number }[] {
  const mapa = new Map<string, { hosts: string[]; visitas: number; visitantes: number }>()
  for (const f of fuentes) {
    const id = fuenteDeHost(f.clave === 'directo' ? 'directo' : f.clave)
    const actual = mapa.get(id) || { hosts: [], visitas: 0, visitantes: 0 }
    if (f.clave && f.clave !== 'directo') actual.hosts.push(f.clave)
    actual.visitas += f.visitas
    actual.visitantes += f.visitantes
    mapa.set(id, actual)
  }
  return Array.from(mapa.entries())
    .map(([id, v]) => ({ clave: id, etiqueta: etiquetaFuente(id, v.hosts), visitas: v.visitas, visitantes: v.visitantes }))
    .sort((a, b) => b.visitas - a.visitas)
}

/* ------------------------------------------------------------------ */
/* métricas y comparativas                                             */
/* ------------------------------------------------------------------ */

export function porcentajeVariacion(actual: number, anterior: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior)) return null
  if (anterior <= 0) return actual > 0 ? 100 : null
  return Math.round(((actual - anterior) / anterior) * 1000) / 10
}

export function formatearDuracion(segundos: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(segundos) || 0))
  if (!s) return '—'
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  const resto = s % 60
  if (min < 60) return resto ? `${min} min ${resto} s` : `${min} min`
  const horas = Math.floor(min / 60)
  const min2 = min % 60
  return min2 ? `${horas} h ${min2} min` : `${horas} h`
}

/** 24 horas completas: los huecos sin visitas van a 0 para que la gráfica no mienta. */
export function serieHoras(parcial: { hora: number; visitas: number }[]): { hora: number; visitas: number }[] {
  const mapa = new Map(parcial.map((h) => [Number(h.hora), Number(h.visitas) || 0]))
  return Array.from({ length: 24 }, (_, hora) => ({ hora, visitas: mapa.get(hora) || 0 }))
}

/** 7 días de la semana (1 = lunes … 7 = domingo), también completos. */
export function serieDiasSemana(parcial: { dow: number; visitas: number }[]): { dow: number; visitas: number }[] {
  const mapa = new Map(parcial.map((d) => [Number(d.dow), Number(d.visitas) || 0]))
  return Array.from({ length: 7 }, (_, i) => ({ dow: i + 1, visitas: mapa.get(i + 1) || 0 }))
}

export function divisionSegura(numerador: number, denominador: number): number | null {
  if (!denominador) return null
  return Math.round((numerador / denominador) * 10) / 10
}

/* ------------------------------------------------------------------ */
/* agregados en JavaScript (plan B si la migración no está aplicada)   */
/* ------------------------------------------------------------------ */

function contarRanking(
  filas: FilaVisitaAgregable[],
  clave: (f: FilaVisitaAgregable) => string,
): FilaRanking[] {
  const mapa = new Map<string, { visitas: number; visitantes: Set<string> }>()
  for (const f of filas) {
    const k = clave(f)
    const actual = mapa.get(k) || { visitas: 0, visitantes: new Set<string>() }
    actual.visitas += 1
    actual.visitantes.add(f.visitante_id)
    mapa.set(k, actual)
  }
  return Array.from(mapa.entries())
    .map(([k, v]) => ({ clave: k, visitas: v.visitas, visitantes: v.visitantes.size }))
    .sort((a, b) => b.visitas - a.visitas)
}

/**
 * Resume filas de visitas con la misma forma que devuelve la RPC
 * `analitica_visitas`. `nuevos` queda en null porque hace falta mirar fuera del
 * rango para saber si un visitante es nuevo de verdad.
 */
export function agregarVisitas(filas: FilaVisitaAgregable[], rango: Rango): ResumenVisitas {
  const buckets = bucketsDelRango(rango)
  const porClave = new Map<string, { visitas: number; visitantes: Set<string>; sesiones: Set<string> }>()
  buckets.forEach((b) => porClave.set(b.clave, { visitas: 0, visitantes: new Set(), sesiones: new Set() }))

  let duracionTotal = 0
  let duracionMuestras = 0
  const visitantes = new Set<string>()
  const sesiones = new Set<string>()

  for (const f of filas) {
    visitantes.add(f.visitante_id)
    if (f.sesion_id) sesiones.add(f.sesion_id)
    if (typeof f.duracion_segundos === 'number' && f.duracion_segundos >= 0) {
      duracionTotal += f.duracion_segundos
      duracionMuestras += 1
    }
    const clave = claveBucket(new Date(f.creado_en), rango.granularidad)
    const bucket = porClave.get(clave)
    if (!bucket) continue
    bucket.visitas += 1
    bucket.visitantes.add(f.visitante_id)
    if (f.sesion_id) bucket.sesiones.add(f.sesion_id)
  }

  const serie: PuntoSerie[] = buckets.map((b) => {
    const dato = porClave.get(b.clave)!
    return {
      ...b,
      visitas: dato.visitas,
      visitantes: dato.visitantes.size,
      sesiones: dato.sesiones.size,
    }
  })

  const horasParcial = new Map<number, number>()
  const diasParcial = new Map<number, number>()
  for (const f of filas) {
    const p = partesMadrid(new Date(f.creado_en))
    horasParcial.set(p.hour, (horasParcial.get(p.hour) || 0) + 1)
    const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    const iso = dow === 0 ? 7 : dow
    diasParcial.set(iso, (diasParcial.get(iso) || 0) + 1)
  }
  const horas = serieHoras(Array.from(horasParcial, ([hora, visitas]) => ({ hora, visitas })))
  const diasSemana = serieDiasSemana(Array.from(diasParcial, ([dow, visitas]) => ({ dow, visitas })))

  return {
    visitas: filas.length,
    visitantes: visitantes.size,
    sesiones: sesiones.size,
    nuevos: null,
    recurrente: null,
    paginasPorVisita: divisionSegura(filas.length, visitantes.size),
    duracionMedia: duracionMuestras ? Math.round(duracionTotal / duracionMuestras) : null,
    serie,
    dispositivos: contarRanking(filas, (f) => f.dispositivo || 'desconocido'),
    idiomas: contarRanking(filas, (f) => f.idioma || 'es'),
    fuentes: contarRanking(filas, (f) => f.referrer_host || 'directo'),
    topPaginas: contarRanking(filas, (f) => f.ruta).slice(0, 20).map((f) => ({
      ...f,
      tipo: (filas.find((x) => x.ruta === f.clave)?.tipo || 'otro') as TipoPagina,
    })),
    horas,
    diasSemana,
  }
}

/** Cuenta cuántos elementos caen en cada bucket del rango. */
export function serieDeFechas(fechas: (string | null | undefined)[], rango: Rango): number[] {
  const buckets = bucketsDelRango(rango)
  const indice = new Map(buckets.map((b, i) => [b.clave, i]))
  const conteo = new Array(buckets.length).fill(0)
  for (const fecha of fechas) {
    if (!fecha) continue
    const i = indice.get(claveBucket(new Date(fecha), rango.granularidad))
    if (i !== undefined) conteo[i] += 1
  }
  return conteo
}

/* ------------------------------------------------------------------ */
/* informe completo que consume el panel («Audiencia»)                 */
/* ------------------------------------------------------------------ */

export interface ActividadPeriodo {
  registros: number
  registrosSerie: number[]
  nuevosProfesionales: number
  publicaciones: number
  publicacionesSerie: number[]
  mensajes: number
  mensajesSerie: number[]
  favoritos: number
  favoritosSerie: number[]
  cupones: number
  cuponesSerie: number[]
  creditosAprobados: number
  creditosSerie: number[]
  importeCreditos: number
  resenas: number
  resenasSerie: number[]
  denuncias: number
  denunciasSerie: number[]
}

export interface EstadoPlataforma {
  usuariosTotal: number
  usuariosVerificados: number
  usuariosConPack: number
  usuariosEnPrueba: number
  packsPorPlan: { plan: string; usuarios: number }[]
  usuariosActivos: number
  anunciosTotales: number
  anunciosActivos: number
  anunciosVendidos: number
  anunciosPublicadosPeriodo: number
  anunciosVendidosPeriodo: number
  anunciosConVisitasPeriodo: number
  porcentajeAnunciosConVisitas: number | null
}

export interface ComparativaAudiencia {
  visitas: number | null
  visitantes: number | null
  registros: number
  publicaciones: number
  mensajes: number
}

export interface InformeAudiencia {
  generadoEn: string
  rango: {
    preset: PresetRango
    etiqueta: string
    desde: string
    hasta: string
    granularidad: Granularidad
    buckets: Bucket[]
    dias: number
  }
  visitas: ResumenVisitas
  actividad: ActividadPeriodo
  estado: EstadoPlataforma
  comparativa: ComparativaAudiencia
  /** true = hubo que cortar filas (periodo muy grande); los totales siguen siendo exactos. */
  filasTruncadas: boolean
  /** true = la tabla de visitas no está disponible o se agrupó en JavaScript. */
  degradado: boolean
  aviso?: string
}

/* ------------------------------------------------------------------ */
/* validación del evento que envía el navegador                        */
/* ------------------------------------------------------------------ */

export interface VisitaNormalizada {
  visitanteId: string
  sesionId: string | null
  ruta: string
  tipo: TipoPagina
  slug: string | null
  referrerHost: string | null
  dispositivo: Dispositivo | null
  idioma: 'es' | 'en'
  anterior: { ruta: string; ts: number; segundos: number } | null
  /** true = solo cierra la duración de la página anterior; no añade una visita. */
  soloDuracion: boolean
}

const ID_VALIDO = /^[A-Za-z0-9_-]{8,64}$/

export function normalizarVisita(
  body: unknown,
): { ok: true; visita: VisitaNormalizada } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido' }
  const datos = body as Record<string, unknown>

  const visitanteId = typeof datos.vid === 'string' ? datos.vid.trim() : ''
  if (!ID_VALIDO.test(visitanteId)) return { ok: false, error: 'Visitante inválido' }

  const sesionId = typeof datos.sid === 'string' && ID_VALIDO.test(datos.sid) ? datos.sid : null
  const ruta = typeof datos.ruta === 'string' ? datos.ruta.slice(0, 300) : ''
  if (!ruta.startsWith('/')) return { ok: false, error: 'Ruta inválida' }

  const { tipo, slug } = clasificarRuta(ruta)
  if (tipo === 'panel') return { ok: false, error: 'Ruta no medible' }

  const idioma: 'es' | 'en' = ruta.startsWith('/en') ? 'en' : 'es'
  const dispositivo = esDispositivoValido(datos.disp)
    ? datos.disp
    : Number.isFinite(Number(datos.ancho))
      ? dispositivoDesdeAncho(Number(datos.ancho))
      : null

  let anterior: VisitaNormalizada['anterior'] = null
  const previo = datos.anterior as Record<string, unknown> | undefined
  if (previo && typeof previo === 'object') {
    const rutaPrevia = typeof previo.ruta === 'string' ? previo.ruta.slice(0, 300) : ''
    const ts = Number(previo.ts)
    const segundos = Math.round(Number(previo.segundos))
    if (
      rutaPrevia.startsWith('/') &&
      Number.isFinite(ts) &&
      ts > 0 &&
      Number.isFinite(segundos) &&
      segundos >= 1 &&
      segundos <= 86400
    ) {
      anterior = { ruta: normalizarRuta(rutaPrevia), ts, segundos }
    }
  }

  const soloDuracion = datos.soloDuracion === true
  // Un cierre de duración sin página previa no aporta nada.
  if (soloDuracion && !anterior) return { ok: false, error: 'Nada que cerrar' }

  return {
    ok: true,
    visita: {
      visitanteId,
      sesionId,
      ruta: normalizarRuta(ruta),
      tipo,
      slug,
      referrerHost: hostDesdeReferrer(typeof datos.ref === 'string' ? datos.ref : null),
      dispositivo,
      idioma,
      anterior,
      soloDuracion,
    },
  }
}
