/**
 * Filtro de moderación automatizada
 * - Palabras prohibidas → se rechaza la publicación directamente
 * - Palabras sospechosas → se publica pero se marca "pendiente" y alerta Telegram
 *
 * Dureza del normalizado (auditoría 2026-10-27, punto 5):
 *   · NFKD + eliminación de diacríticos: "cocaína" y "cocaina" son lo mismo.
 *   · Caracteres de formato / zero-width: "ma\u200Bri\u200Bhuana" no cuela.
 *   · Homoglifos cirílicos/griegos más comunes: "cоcaína" (о cirílica).
 *   · Leetspeak (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s…).
 *   · Separadores artificiales: "c.o.c.a.i.n.a" y "v.e.n.t.a d.e d.r.o.g.a.s"
 *     se comparan también en su versión compactada (sin puntuación ni espacios).
 *
 * Los términos se comparan por PALABRA COMPLETA (`\p{L}\p{N}` como frontera)
 * para no rechazar "Balanza de cocina" por contener "bala". El compactado se
 * aplica también al texto normal: si no hubiera separadores, ambas variantes
 * son iguales y no se hace trabajo extra.
 *
 * `verificarContenidoCampos()` modera cada campo por separado Y la concatenación,
 * para que un término partido entre título y descripción no se pierda.
 *
 * Nota: esto sigue siendo un filtro de listas. La segunda capa con un servicio
 * externo (OpenAI Moderation / Perspective) sigue pendiente de decisión de
 * producto; no se puede añadir sin API key ni política de privacidad.
 */

// 🚫 RECHAZO: contenido 100% prohibido (ilegal o extremadamente inapropiado)
export const palabrasProhibidas: string[] = [
  // Armas y munición
  'ametralladora', 'bala', 'c4', 'cartucho', 'dinamita', 'escopeta', 'fusil',
  'granada', 'lanzacohetes', 'mina antipersona', 'mortero',
  'polvera', 'pulsora', 'rifl', 'revolver', 'revólver', 'rifle', 'semiautomática',
  'sniper', 'subfusil', 'trabuco', 'armas de fuego', 'armas blancas',
  'fabricación de armas', 'modificación de armas',

  // Drogas y sustancias ilegales
  'basuco', 'cocaína', 'cocaina', 'crack', 'droga sintética', 'droga',
  'extasis', 'éxtasis', 'farmaco', 'fármaco recetado', 'hashish', 'hashís',
  'heroina', 'heroína', 'ketamina', 'lsd', 'marihuana', 'mdma', 'metanfetamina',
  'pastilla', 'piedra base', 'perico', 'polvillo', 'thc', 'tripi', 'tripis',
  'alucinógeno', 'alucinogeno', 'psicotrópico', 'psicotrópico',
  'venta de drogas', 'narco',

  // Ilegalidad general
  'cedula falsa', 'cédula falsa', 'documento falso', 'pasaporte falso',
  'documento adulterado', 'identidad falsa', 'placa falsa', 'titulo falso',
  'título falso', 'diploma falso', 'receta falsa',

  // Explotación y tráfico
  'trafico de personas', 'tráfico de personas', 'trata de personas',
  'explotación sexual', 'explotacion sexual', 'proxenetismo', 'lenocinio',

  // Pornografía y contenido sexual explícito
  'pornografía', 'porno', 'sex server', 'cam show', 'chat erotico',
  'chat erótico', 'striptease', 'servicio sexual', 'prostitución', 'prostitucion',
  'whore', 'escort servicios', 'escorts', 'servicios acompañante',

  // Órganos humanos
  'riñon en venta', 'riñón en venta', 'organos humanos', 'órganos humanos',
  'compra de organos', 'compra de órganos', 'vientre', 'alquiler vientre',

  // Fraude/estafa directa
  'hackeo', 'hackear', 'robar cuenta', 'robar clave', 'clonar tarjeta',
  'clonar telefono', 'burlar seguridad', 'bypass security', 'keylogger',
  'phishing', 'skimmer',
]

// ⚠️ SOSPECHOSO: se publica pero se marca para revisión
export const palabrasSospechosas: string[] = [
  // Precios sospechosos (solo los muy específicos)
  'solo cripto', 'solo bitcoin', 'transferencia previa',
  'pago por adelantado',

  // Eufemismos comunes de drogas
  'sustancia natural', 'medicamento sin receta',
  // Términos ambiguos: revisión humana, no rechazo automático.
  'pistola', 'bala',

  // Contacto fuera de plataforma (potencial estafa)
  'escribe a mi email', 'contacta por telegram', 'whatsapp antes',
  'habla por telegram', 'enviame por correo',
]

/** Homoglifos que un atacante usa para saltarse un filtro de texto plano. */
const CONFUSABLES: Record<string, string> = {
  // Cirílico con apariencia latina
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
  'і': 'i', 'ѕ': 's', 'һ': 'h', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't',
  'в': 'b', 'г': 'r', 'п': 'n', 'л': 'n', 'д': 'd', 'и': 'u', 'й': 'u',
  'б': 'b', 'я': 'r', 'э': 'e', 'ф': 'f', 'ц': 'c', 'ч': 'c', 'ш': 'w',
  // Griego con apariencia latina
  'α': 'a', 'β': 'b', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'ι': 'i', 'κ': 'k',
  'ν': 'v', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ς': 's', 'σ': 'o', 'μ': 'u',
  'π': 'n', 'ω': 'w', 'δ': 'd',
}

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'l', '€': 'e',
}

/** Marcas de combinación, direccionales, zero-width y guiones invisibles. */
const INVISIBLES = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\u00ad]/gu

function normalizarBase(texto: string): string {
  return texto
    .normalize('NFKD')
    .toLowerCase()
    .replace(INVISIBLES, '')
    .replace(/[^\u0000-\u007f]/gu, c => CONFUSABLES[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizado canónico (expuesto para tests y para otros módulos).
 * NO aplica leetspeak: así "CA" (corriente alterna) no se confunde con el
 * término prohibido "c4". La variante leet se aplica solo al TEXTO, nunca a
 * los términos de la lista.
 */
export function normalizarTextoModeracion(texto: string): string {
  return normalizarBase(texto)
}

function normalizarLeet(texto: string): string {
  return normalizarBase(texto).replace(/[01345789@$!|€]/g, c => LEET[c] ?? c)
}

// "1" se usa tanto para "i" como para "l" ("1sd" = lsd). Generamos una segunda
// variante para no elegir una sola lectura y dejar huecos.
function normalizarLeetConL(texto: string): string {
  return normalizarBase(texto).replace(/[01345789@$!|€]/g, c => (c === '1' ? 'l' : LEET[c] ?? c))
}

/** Quita cualquier separador: "c.o.c.a" → "coca", "venta de" → "ventade". */
function compactar(texto: string): string {
  return texto.replace(/[^\p{L}\p{N}]/gu, '')
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Patrón de palabra/frase completa sobre un texto YA normalizado. */
function patronDe(terminoNormalizado: string): RegExp | null {
  const termino = terminoNormalizado.trim()
  if (!termino) return null
  const patron = termino.split(/\s+/).map(escaparRegex).join('\\s+')
  // Sin flag 'g': se puede reutilizar el mismo RegExp en cada comprobación.
  return new RegExp(`(^|[^\\p{L}\\p{N}])${patron}(?=$|[^\\p{L}\\p{N}])`, 'u')
}

function coincide(texto: string, terminoNormalizado: string): boolean {
  return patronDe(terminoNormalizado)?.test(texto) ?? false
}

/**
 * Variantes del texto escrito por el usuario.
 *
 * Además del normalizado y sus dos lecturas leet, generamos tres formas de
 * quitar separadores artificiales. Hacen falta las tres:
 *  · quitar PUNTUACIÓN entre letras mantiene los espacios entre palabras
 *    ("c.o.c.a.i.n.a disponible" → "cocaina disponible", así "cocaina" sigue
 *    siendo palabra completa);
 *  · colapsar letras SUELTAS ("c o c a i n a" → "cocaina", "Venta de
 *    d.r.o.g.a.s" → "venta de drogas");
 *  · compactar del todo ("ven" + "ta de drogas" → "ventadedrogas"), que es la
 *    única que reconstruye un término partido entre campos.
 */
function variantesDeTexto(texto: string): string[] {
  const base = normalizarBase(texto)
  const variantes = new Set<string>([base, normalizarLeet(texto), normalizarLeetConL(texto)])
  for (const v of [...variantes]) {
    const sinPuntuacion = v.replace(
      /([\p{L}\p{N}])[^\p{L}\p{N}\s]+(?=[\p{L}\p{N}])/gu,
      '$1',
    )
    if (sinPuntuacion !== v) variantes.add(sinPuntuacion)

    const colapsado = v.replace(
      /(^|[^\p{L}\p{N}])((?:[\p{L}\p{N}][^\p{L}\p{N}]){2,}[\p{L}\p{N}])(?=$|[^\p{L}\p{N}])/gu,
      (_m, prefijo: string, run: string) => prefijo + run.replace(/[^\p{L}\p{N}]/gu, ''),
    )
    if (colapsado !== v) variantes.add(colapsado)

    const compacto = compactar(v)
    if (compacto !== v) variantes.add(compacto)
  }
  return [...variantes]
}

/** Variantes del término de la lista: normal + compactada, SIN leetspeak. */
function variantesDeTermino(termino: string): string[] {
  const base = normalizarBase(termino)
  const compacta = compactar(base)
  return compacta === base ? [base] : [base, compacta]
}

type Termino = { original: string; patrones: RegExp[] }

function preparar(terminos: string[]): Termino[] {
  // Los patrones se compilan UNA vez. El normalizado genera varias variantes de
  // texto por publicación; reconstruir ~100 RegExp por variante sería caro.
  return terminos.map(original => ({
    original,
    patrones: variantesDeTermino(original)
      .map(patronDe)
      .filter((p): p is RegExp => p !== null),
  }))
}

// Se calculan una sola vez al cargar el módulo: verificarContenido se llama en
// el cliente (formulario) y en tres rutas de servidor por cada publicación.
const PROHIBIDOS = preparar(palabrasProhibidas)
const SOSPECHOSOS = preparar(palabrasSospechosas)

function buscar(texto: string, terminos: Termino[]): string[] {
  if (!texto?.trim()) return []
  const variantes = variantesDeTexto(texto)
  const encontrados: string[] = []
  for (const termino of terminos) {
    if (variantes.some(v => termino.patrones.some(p => p.test(v)))) {
      encontrados.push(termino.original)
    }
  }
  return encontrados
}

/** Matches complete words/phrases only. Punctuation and whitespace are boundaries. */
export function contieneTerminoCompleto(texto: string, termino: string): boolean {
  const variantes = variantesDeTexto(texto)
  const delTermino = variantesDeTermino(termino)
  return variantes.some(v => delTermino.some(t => coincide(v, t)))
}

export type ResultadoModeracion = {
  nivel: 'prohibido' | 'sospechoso' | 'limpio'
  palabras: string[]
}

export function verificarContenido(texto: string): ResultadoModeracion {
  if (!texto?.trim()) return { nivel: 'limpio', palabras: [] }
  const encontradasProhibidas = buscar(texto, PROHIBIDOS)
  if (encontradasProhibidas.length) return { nivel: 'prohibido', palabras: encontradasProhibidas }
  const encontradasSospechosas = buscar(texto, SOSPECHOSOS)
  return encontradasSospechosas.length
    ? { nivel: 'sospechoso', palabras: encontradasSospechosas }
    : { nivel: 'limpio', palabras: [] }
}

/**
 * Modera varios campos (título, descripción…) por separado y también juntos.
 * `prohibido` gana siempre; los términos sospechosos se acumulan sin repetir.
 */
export function verificarContenidoCampos(...campos: unknown[]): ResultadoModeracion {
  const textos = campos
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
  if (textos.length === 0) return { nivel: 'limpio', palabras: [] }

  const combinaciones = textos.length > 1 ? [...textos, textos.join(' ')] : textos
  const sospechosas = new Set<string>()

  for (const texto of combinaciones) {
    const resultado = verificarContenido(texto)
    if (resultado.nivel === 'prohibido') return resultado
    if (resultado.nivel === 'sospechoso') {
      for (const palabra of resultado.palabras) sospechosas.add(palabra)
    }
  }

  return sospechosas.size
    ? { nivel: 'sospechoso', palabras: [...sospechosas] }
    : { nivel: 'limpio', palabras: [] }
}

/**
 * Genera alerta para Telegram
 */
export function formatearAlertaModeracion(
  nivel: 'prohibido' | 'sospechoso',
  titulo: string,
  palabras: string[],
  userId: string,
  userName: string = 'Desconocido'
): string {
  const icono = nivel === 'prohibido' ? '🚫' : '⚠️'
  const nivelTexto = nivel === 'prohibido' ? 'PROHIBIDO' : 'SOSPECHOSO'

  return `${icono} <b>ALERTA MODERACIÓN — ${nivelTexto}</b>

📝 <b>Título:</b> ${titulo}
👤 <b>Usuario:</b> ${userName}
🔍 <b>Palabras detectadas:</b> ${palabras.join(', ')}

Revisa en el Admin Panel → Moderación`
}
