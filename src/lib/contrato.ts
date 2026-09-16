/**
 * Contrato de compraventa de vehículo usado — datos y documento (plan §4.2).
 *
 * QUÉ ES
 * Generador 100% software: el usuario rellena los datos de las partes y del
 * vehículo (o llegan precargados desde el anuncio), previsualiza el contrato y
 * lo imprime/guarda como PDF desde el navegador. Sin partner, sin coste, y
 * sirve como utilidad SEO ("contrato compraventa camper").
 *
 * DECISIONES
 *  - El texto del contrato está SIEMPRE en español: es el documento legal que
 *    firman las partes en España. La UI alrededor se traduce (en), el contrato
 *    no.
 *  - Nada se guarda en la base de datos: es una utilidad de descarga, y los
 *    datos de DNI/domicilio no tienen por qué pasar por nuestro servidor.
 *  - La matrícula del vehículo NUNCA se precarga desde el anuncio (no es
 *    pública): la escribe el vendedor al generar el contrato.
 */

import type { EstadoInspeccion } from './inspecciones'

// ── Modelo de datos ─────────────────────────────────────────────────────────

export interface ParteContrato {
  nombre: string
  dni: string
  domicilio: string
}

export interface DatosContrato {
  vendedor: ParteContrato
  comprador: ParteContrato
  vehiculo: {
    tipo: string
    marca: string
    modelo: string
    matricula: string
    bastidor: string
    anio: string
    kilometros: string
    itvVigente: boolean
  }
  precio: string
  formaPago: string
  lugar: string
  fecha: string
  observaciones: string
}

export const FORMAS_PAGO = [
  'Transferencia bancaria',
  'Efectivo',
  'Bizum',
  'Pago mixto (parte transferencia, parte efectivo)',
] as const

export function parteVacia(): ParteContrato {
  return { nombre: '', dni: '', domicilio: '' }
}

export function datosContratoPorDefecto(): DatosContrato {
  return {
    vendedor: parteVacia(),
    comprador: parteVacia(),
    vehiculo: {
      tipo: 'Furgoneta camper / autocaravana',
      marca: '',
      modelo: '',
      matricula: '',
      bastidor: '',
      anio: '',
      kilometros: '',
      itvVigente: true,
    },
    precio: '',
    formaPago: FORMAS_PAGO[0],
    lugar: '',
    fecha: new Date().toISOString().slice(0, 10),
    observaciones: '',
  }
}

// ── Normalización (lo que escribe el usuario → lo que va al documento) ──────

function limpiar(valor: unknown, max = 120): string {
  return String(valor ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Devuelve una copia lista para renderizar (y para los tests). */
export function normalizarDatosContrato(datos: DatosContrato): DatosContrato {
  const parte = (p: ParteContrato) => ({
    nombre: limpiar(p.nombre, 100),
    dni: limpiar(p.dni, 20).toUpperCase(),
    domicilio: limpiar(p.domicilio, 160),
  })
  return {
    vendedor: parte(datos.vendedor),
    comprador: parte(datos.comprador),
    vehiculo: {
      tipo: limpiar(datos.vehiculo.tipo, 80) || 'Furgoneta camper / autocaravana',
      marca: limpiar(datos.vehiculo.marca, 60),
      modelo: limpiar(datos.vehiculo.modelo, 80),
      matricula: limpiar(datos.vehiculo.matricula, 15).toUpperCase(),
      bastidor: limpiar(datos.vehiculo.bastidor, 30).toUpperCase(),
      anio: limpiar(datos.vehiculo.anio, 10),
      kilometros: limpiar(datos.vehiculo.kilometros, 12),
      itvVigente: !!datos.vehiculo.itvVigente,
    },
    precio: limpiar(datos.precio, 20),
    formaPago: limpiar(datos.formaPago, 60) || FORMAS_PAGO[0],
    lugar: limpiar(datos.lugar, 80),
    fecha: limpiar(datos.fecha, 10),
    observaciones: limpiar(datos.observaciones, 400),
  }
}

/** ¿Están los mínimos para que el documento tenga sentido? */
export function contratoCompleto(datos: DatosContrato): boolean {
  const d = normalizarDatosContrato(datos)
  return (
    d.vendedor.nombre.length > 1 &&
    d.comprador.nombre.length > 1 &&
    d.vehiculo.marca.length > 0 &&
    d.vehiculo.matricula.length > 3 &&
    Number(d.precio.replace(/[^\d.,]/g, '').replace(',', '.')) > 0
  )
}

// ── Prefill desde el anuncio ────────────────────────────────────────────────

/**
 * Campos públicos de un anuncio con los que se precarga el contrato. La
 * matrícula y el bastidor NO vienen del anuncio: no son datos públicos.
 */
export interface ProductoParaContrato {
  titulo?: string | null
  marca?: string | null
  modelo?: string | null
  precio?: number | null
  precio_usd?: number | null
  anio?: number | null
  especificaciones?: Record<string, unknown> | null
}

const CLAVE_KM = ['Kilómetros', 'Kilometros', 'kilometros', 'km']
const CLAVE_ANIO = ['Año de matriculación', 'Año', 'año', 'anio']

function primeraClave(spec: Record<string, unknown> | null | undefined, claves: string[]): string {
  if (!spec) return ''
  for (const k of claves) {
    const v = spec[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/**
 * Datos del contrato precargados desde un anuncio público. Si el anuncio trae
 * marca/modelo se usan; si no, el título (que en los campers suele traerlo).
 * El precio solo se precarga si es > 0 (anuncios "precio a consultar" van
 * vacíos para obligar a mirarlo).
 */
export function prefillDesdeProducto(producto: ProductoParaContrato | null | undefined): DatosContrato {
  const base = datosContratoPorDefecto()
  if (!producto) return base

  const marca = String(producto.marca || '').trim()
  const modelo = String(producto.modelo || '').trim()
  const precio = Number(producto.precio ?? producto.precio_usd ?? 0)

  return {
    ...base,
    vehiculo: {
      ...base.vehiculo,
      marca: marca || base.vehiculo.marca,
      modelo: modelo || base.vehiculo.modelo,
      anio:
        primeraClave(producto.especificaciones, CLAVE_ANIO) ||
        (producto.anio ? String(producto.anio) : ''),
      kilometros: primeraClave(producto.especificaciones, CLAVE_KM),
    },
    precio: precio > 0 ? String(Math.round(precio)) : '',
  }
}

// ── Documento (cláusulas) ───────────────────────────────────────────────────

/**
 * Cuerpo del contrato, sección a sección. Es el texto que se renderiza en la
 * página y se imprime; los huecos se rellenan con los datos normalizados y los
 * que falten quedan como "____" para completar a mano antes de firmar.
 */
export function parrafosContrato(d: DatosContrato): string[] {
  const p = (v: string, extra = '') => (v ? v : '________') + extra
  const km = d.vehiculo.kilometros ? `${d.vehiculo.kilometros} km` : '____ km'
  const anio = d.vehiculo.anio || '____'
  const precio = d.precio ? `${d.precio} €` : '______ €'

  const clausulas: string[] = []

  clausulas.push(
    `En ${p(d.lugar)}, a ${p(d.fecha)}.\n\nREUNIDOS\n\nDE UNA PARTE, D./Dña. ${p(d.vendedor.nombre)}, con DNI/NIE ${p(d.vendedor.dni)} y domicilio en ${p(d.vendedor.domicilio)}, en adelante «EL VENDEDOR».\n\nDE OTRA PARTE, D./Dña. ${p(d.comprador.nombre)}, con DNI/NIE ${p(d.comprador.dni)} y domicilio en ${p(d.comprador.domicilio)}, en adelante «EL COMPRADOR».\n\nAmbas partes se reconocen capacidad legal suficiente para el presente contrato y`
  )

  clausulas.push(
    `EXPONEN\n\nQue EL VENDEDOR es propietario del siguiente vehículo:\n\n• Tipo: ${p(d.vehiculo.tipo)}\n• Marca: ${p(d.vehiculo.marca)}\n• Modelo: ${p(d.vehiculo.modelo)}\n• Matrícula: ${p(d.vehiculo.matricula)}\n• Nº de bastidor (VIN): ${p(d.vehiculo.bastidor)}\n• Año de matriculación: ${anio}\n• Kilómetros actuales: ${km}\n• ITV: ${d.vehiculo.itvVigente ? 'vigente en el momento de la firma' : '____ (indicar estado)'}`
  )

  clausulas.push(
    `CLÁUSULAS\n\nPRIMERA — Objeto. EL VENDEDOR transmite a EL COMPRADOR la propiedad del vehículo descrito, libre de cargas, gravámenes, embargos y derechos de tercero, así como con las cuotas y multas pendientes al día. EL VENDEDOR declara que el vehículo no figura como sustraído y que es su titular o representa legítimamente a quien lo es.\n\nSEGUNDA — Precio y forma de pago. El precio de la compraventa se fija en ${precio}, que EL COMPRADOR paga mediante ${p(d.formaPago)}. Con la firma de este documento, EL VENDEDOR declara haber recibido la totalidad del precio, dejando constancia de ello a su costa y requerimiento.\n\nTERCERA — Estado del vehículo. EL COMPRADOR declara conocer el estado del vehículo, que adquiere «visto y de conformidad», sin derecho a reclamar por desgaste o defectos propios de su uso y antigüedad, salvo vicio oculto no detectable que impida la circulación legal del vehículo.\n\nCUARTA — Documentación y entrega. En el acto de la firma, EL VENDEDOR entrega a EL COMPRADOR: permiso de circulación, ficha técnica / tarjeta ITV, informe de la vida del vehículo obtenido de la DGT, y las llaves del vehículo. EL VENDEDOR conservará copia firmada del contrato.\n\nQUINTA — Cambio de titularidad. EL COMPRADOR se obliga a efectuar el cambio de titularidad en la Jefatura de Tráfico en el plazo legal de 30 días desde la firma, abriendo a su costa los expedientes de transmisión (notificación de venta por parte del vendedor) y de pago del Impuesto de Transmisiones Patrimoniales (modelo 620), cuyo importe corresponde íntegramente a EL COMPRADOR.\n\nSEXTA — Responsabilidades. EL VENDEDOR responde de la titularidad del vehículo y de la veracidad de los datos aquí recogidos hasta la fecha de firma. A partir de la entrega, EL COMPRADOR asume la responsabilidad civil y administrativa derivada de la circulación del vehículo. Hasta la efectiva transmisión, EL VENDEDOR podrá justificar la fecha de la venta con este contrato ante cualquier administración.\n\nSÉPTIMA — Protección de datos. Los datos personales recogidos en este documento se emplean exclusivamente para formalizar la compraventa y cumplir las obligaciones legales derivadas de ella, sin que puedan destinarse a otro fin ni cederse a terceros salvo obligación legal.\n\nOCTAVA — Ley aplicable. Este contrato se rige por el Código Civil y la legislación española. Para cualquier controversia, las partes se someten a los juzgados que correspondan por su domicilio.\n\nY en prueba de conformidad, firman ambas partes el presente contrato en dos ejemplares, de igual tenor y a un solo efecto.${
      d.observaciones ? `\n\nOBSERVACIONES: ${d.observaciones}` : ''
    }`
  )

  return clausulas
}

/** Recordatorios posteriores a la firma (se muestran junto al contrato). */
export const RECUERDOS_POSTFIRMA: { titulo: string; texto: string; enlace?: string }[] = [
  {
    titulo: 'Cambio de nombre en la DGT',
    texto: 'El comprador tiene 30 días desde la firma. El vendedor debe presentar la notificación de venta.',
    enlace: '/gestoria-cambio-nombre',
  },
  {
    titulo: 'Impuesto de Transmisiones (ITP)',
    texto: 'Lo paga el comprador antes del cambio de nombre (modelo 620). Calcula el importe exacto según tu comunidad.',
    enlace: '/calcular-itp',
  },
  {
    titulo: 'Seguro y ITV',
    texto: 'El vehículo no puede circular sin seguro a nombre del nuevo titular. Si la ITV caduca cerca de la venta, pásala antes.',
  },
]

/**
 * Utilidad compartida con el panel: si la inspección está completada, el
 * contrato es el siguiente paso natural (el informe llega por email). Se usa
 * para los enlaces de la ficha y del panel.
 */
export function contratoRecomendadoTras(estado: EstadoInspeccion): boolean {
  return estado === 'completada'
}
