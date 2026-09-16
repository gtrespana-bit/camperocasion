/**
 * Verificación de homologación — reglas de negocio.
 *
 * El vertical camper tiene un problema que un marketplace generalista no
 * entiende: un anuncio puede declarar "Vehículo Vivienda (2448/3148)" y ser, en
 * realidad, un furgón sin homologar. Esta capa formaliza el EXPEDIENTE DEL
 * VEHÍCULO: qué documentos lo componen, cuáles son exigibles según lo que el
 * vendedor declara, y qué le falta.
 *
 * Todo lo de este módulo es lógica pura (sin Supabase, sin React) para poder
 * usarse en el servidor (API y ficha del producto) y comprobarse en tests.
 */

/** Estados del expediente. Deben coincidir con el CHECK de la migración. */
export const ESTADOS_VERIFICACION_HOMOLOGACION = [
  'sin_verificar',
  'pendiente',
  'verificada',
  'rechazada',
] as const

export type EstadoVerificacionHomologacion = (typeof ESTADOS_VERIFICACION_HOMOLOGACION)[number]

export const ESTADO_VERIFICACION_POR_DEFECTO: EstadoVerificacionHomologacion = 'sin_verificar'

/** ¿Es un estado válido? Se usa al normalizar lo que llega de la base. */
export function esEstadoVerificacion(valor: unknown): valor is EstadoVerificacionHomologacion {
  return typeof valor === 'string'
    && (ESTADOS_VERIFICACION_HOMOLOGACION as readonly string[]).includes(valor)
}

export function normalizarEstadoVerificacion(valor: unknown): EstadoVerificacionHomologacion {
  return esEstadoVerificacion(valor) ? valor : ESTADO_VERIFICACION_POR_DEFECTO
}

/**
 * Tipos de documento del expediente.
 *
 * `exigido` puede ser:
 *  - `true`  → siempre requerido para considerar el expediente completo;
 *  - `false` → opcional (suma, no bloquea);
 *  - `'vivienda'` → requerido solo si el vehículo se declara Vehículo Vivienda.
 */
export const TIPOS_DOCUMENTO_VEHICULO = [
  {
    tipo: 'ficha_tecnica',
    label: 'Ficha técnica (anexo I)',
    ayuda: 'Documento oficial del vehículo donde figuran MMA, plazas y carrocería.',
    exigido: true,
  },
  {
    tipo: 'proyecto_homologacion',
    label: 'Proyecto de homologación',
    ayuda: 'Obligatorio si el anuncio declara Vehículo Vivienda (2448/3148).',
    exigido: 'vivienda',
  },
  {
    tipo: 'itv',
    label: 'Última ITV en vigor',
    ayuda: 'Con la fecha de inspección visible.',
    exigido: true,
  },
  {
    tipo: 'certificado_kilometraje',
    label: 'Certificado de kilometraje',
    ayuda: 'Historial de km (informe DGT o del taller).',
    exigido: false,
  },
  {
    tipo: 'contrato_compraventa',
    label: 'Contrato de compraventa',
    ayuda: 'Útil si ya hay una operación en curso.',
    exigido: false,
  },
  {
    tipo: 'otro',
    label: 'Otro documento',
    ayuda: 'Certificados de reformas, facturas de camperización…',
    exigido: false,
  },
] as const

export type TipoDocumentoVehiculo = (typeof TIPOS_DOCUMENTO_VEHICULO)[number]['tipo']

export const TIPOS_DOCUMENTO_VALIDOS: readonly string[] = TIPOS_DOCUMENTO_VEHICULO.map(d => d.tipo)

export function esTipoDocumentoValido(valor: unknown): valor is TipoDocumentoVehiculo {
  return typeof valor === 'string' && TIPOS_DOCUMENTO_VALIDOS.includes(valor)
}

export function etiquetaTipoDocumento(tipo: string): string {
  return TIPOS_DOCUMENTO_VEHICULO.find(d => d.tipo === tipo)?.label || tipo
}

/** Documento del expediente tal como se lee de `documentos_vehiculo`. */
export interface DocumentoVehiculo {
  tipo: string
  estado?: string | null
  nombre_archivo?: string | null
  creado_en?: string | null
}

/** Límites de subida compartidos por la API y el formulario. */
export const TAMANO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024 // 10 MB
export const TIPOS_ARCHIVO_DOCUMENTO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/**
 * ¿Declara el anuncio que el vehículo está homologado como vivienda?
 * Se compara sobre la clave `Homologación` de `especificaciones`, que es donde
 * la escriben tanto `/publicar` como `/producto/editar`.
 */
export function esHomologacionVivienda(especificaciones?: Record<string, unknown> | null): boolean {
  const valor = especificaciones?.['Homologación']
  return typeof valor === 'string' && /vivienda/i.test(valor)
}

/** Tipos exigidos para este anuncio, según lo que declara en la ficha. */
export function tiposExigidos(
  especificaciones?: Record<string, unknown> | null
): TipoDocumentoVehiculo[] {
  const vivienda = esHomologacionVivienda(especificaciones)
  return TIPOS_DOCUMENTO_VEHICULO
    .filter(d => d.exigido === true || (d.exigido === 'vivienda' && vivienda))
    .map(d => d.tipo)
}

export interface ItemExpediente {
  tipo: TipoDocumentoVehiculo
  label: string
  ayuda: string
  exigido: boolean
  presente: boolean
  estado: string | null
  nombre_archivo: string | null
}

export interface ResumenExpediente {
  items: ItemExpediente[]
  /** Tipos exigidos que todavía no se han subido. */
  faltantes: TipoDocumentoVehiculo[]
  /** Avisos para el vendedor y para el comprador (texto ya listo). */
  avisos: string[]
  /** ¿Está todo lo exigido? Es la condición para poder revisar el expediente. */
  completo: boolean
  /** ¿El expediente ya está verificado por el equipo? */
  verificado: boolean
}

/**
 * Construye el checklist del expediente: qué documentos hay, cuáles faltan y
 * qué avisos mostrar. Es el mismo cálculo para el vendedor (qué le falta), el
 * comprador (qué se ha verificado) y el admin (qué va a revisar).
 */
export function resumenExpediente(
  especificaciones: Record<string, unknown> | null | undefined,
  documentos: DocumentoVehiculo[] | null | undefined,
  estadoVerificacion?: unknown
): ResumenExpediente {
  const docs = Array.isArray(documentos) ? documentos : []
  const porTipo = new Map(docs.map(d => [d.tipo, d]))
  const exigidos = new Set(tiposExigidos(especificaciones))

  const items: ItemExpediente[] = TIPOS_DOCUMENTO_VEHICULO.map(def => {
    const doc = porTipo.get(def.tipo)
    return {
      tipo: def.tipo,
      label: def.label,
      ayuda: def.ayuda,
      exigido: exigidos.has(def.tipo),
      presente: !!doc,
      estado: doc?.estado || null,
      nombre_archivo: doc?.nombre_archivo || null,
    }
  })

  const faltantes = items.filter(i => i.exigido && !i.presente).map(i => i.tipo)

  const avisos: string[] = []
  if (esHomologacionVivienda(especificaciones) && !porTipo.has('proyecto_homologacion')) {
    avisos.push(
      'El anuncio declara Vehículo Vivienda (2448/3148) pero no hay proyecto de homologación: '
      + 'queda "pendiente de verificar" para el comprador.'
    )
  }
  if (faltantes.length > 0) {
    avisos.push(
      `Faltan documentos para completar el expediente: ${faltantes.map(etiquetaTipoDocumento).join(', ')}.`
    )
  }

  const estado = normalizarEstadoVerificacion(estadoVerificacion)

  return {
    items,
    faltantes,
    avisos,
    completo: faltantes.length === 0,
    verificado: estado === 'verificada',
  }
}

/**
 * Un anuncio sin expediente completo no debe mostrarse como "verificado"; pero
 * tampoco conviene castigar al vendedor que aún no ha subido nada: el sello
 * informativo solo aparece cuando hay algo que contar.
 */
export const ETIQUETAS_VERIFICACION: Record<EstadoVerificacionHomologacion, { label: string; descripcion: string }> = {
  sin_verificar: {
    label: 'Sin expediente',
    descripcion: 'El vendedor todavía no ha subido documentación del vehículo.',
  },
  pendiente: {
    label: 'Pendiente de verificar',
    descripcion: 'Hay documentación subida y está en revisión por el equipo de CamperOcasión.',
  },
  verificada: {
    label: 'Homologación verificada',
    descripcion: 'El equipo de CamperOcasión ha revisado la documentación del vehículo.',
  },
  rechazada: {
    label: 'Documentación rechazada',
    descripcion: 'La documentación no acredita lo que declara el anuncio.',
  },
}

/** ¿Procede revisar este anuncio en el panel? (hay documentos y toca revisión) */
export function estaEnColaDeRevision(estado: unknown): boolean {
  return normalizarEstadoVerificacion(estado) === 'pendiente'
}

/** Nombre de archivo seguro: sin rutas, sin acentos raros y con extensión conocida. */
export function nombreArchivoSeguro(nombreOriginal: string | null | undefined): string {
  const base = (nombreOriginal || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 120)
  return base || 'documento'
}
