import {
  esImagenValida,
  MAX_FILAS,
  mapearColumnas,
  normalizarComunidad,
  normalizarEstado,
  normalizarSubcategoria,
  parseCsv,
  parsearPrecio,
  plantillaCsv,
  separarImagenes,
  validarImportacion,
} from '@/lib/importar-csv'

const CABECERAS = 'Titulo;Precio;Tipo;Comunidad;Ciudad;Marca;Modelo;Estado;Año;Kilómetros;Fotos;Descripción'
const FILA_OK =
  'Fiat Ducato L3H2;38.500;Gran Volumen;Comunitat Valenciana;Valencia;Fiat;Ducato;Como nuevo;2019;145.000;https://cdn.x.com/a.jpg|https://cdn.x.com/b.jpg;Camper 4 plazas'

describe('importar-csv - parser', () => {
  test('detecta el punto y coma de Excel en español', () => {
    const csv = parseCsv('a;b;c\n1;2;3')
    expect(csv.cabeceras).toEqual(['a', 'b', 'c'])
    expect(csv.filas).toEqual([['1', '2', '3']])
    expect(csv.separador).toBe(';')
  })

  test('detecta la coma', () => {
    const csv = parseCsv('a,b\n1,2')
    expect(csv.filas).toEqual([['1', '2']])
    expect(csv.separador).toBe(',')
  })

  test('respeta los separadores dentro de comillas', () => {
    const csv = parseCsv('titulo;precio\n"Camper, la buena; 4 plazas";38500')
    expect(csv.filas[0][0]).toBe('Camper, la buena; 4 plazas')
    expect(csv.filas[0][1]).toBe('38500')
  })

  test('deshace las comillas escapadas', () => {
    const csv = parseCsv('a\n"dice ""hola"""')
    expect(csv.filas[0][0]).toBe('dice "hola"')
  })

  test('admite saltos de línea dentro de una celda', () => {
    const csv = parseCsv('a;b\n"linea 1\nlinea 2";x')
    expect(csv.filas[0][0]).toBe('linea 1\nlinea 2')
    expect(csv.filas[0][1]).toBe('x')
  })

  test('tolera CRLF y BOM de Excel', () => {
    const csv = parseCsv('\uFEFFa;b\r\n1;2\r\n')
    expect(csv.cabeceras).toEqual(['a', 'b'])
    expect(csv.filas).toEqual([['1', '2']])
  })

  test('ignora líneas vacías', () => {
    const csv = parseCsv('a;b\n1;2\n\n\n3;4\n')
    expect(csv.filas).toHaveLength(2)
  })

  test('corta en el máximo de filas', () => {
    const filas = Array.from({ length: 150 }, (_, i) => `${i};x`).join('\n')
    expect(parseCsv(`a;b\n${filas}`).filas).toHaveLength(MAX_FILAS)
  })
})

describe('importar-csv - columnas', () => {
  test('reconoce cabeceras en español e inglés, sin acentos ni mayúsculas', () => {
    const mapa = mapearColumnas(['TÍTULO', 'price', 'tipo', 'Comunidad', 'Fotos'])
    expect(mapa.indices.titulo).toBe(0)
    expect(mapa.indices.precio).toBe(1)
    expect(mapa.indices.subcategoria).toBe(2)
    expect(mapa.indices.ubicacion_estado).toBe(3)
    expect(mapa.indices.imagenes).toBe(4)
    expect(mapa.faltan).toEqual([])
  })

  test('dice qué obligatorias faltan', () => {
    const mapa = mapearColumnas(['Titulo', 'Marca'])
    expect(mapa.faltan).toEqual(['Precio', 'Tipo', 'Comunidad'])
  })

  test('una columna repetida no pisa a la primera', () => {
    const mapa = mapearColumnas(['titulo', 'title'])
    expect(mapa.indices.titulo).toBe(0)
    expect(mapa.desconocidas).toContain('title')
  })
})

describe('importar-csv - valores', () => {
  test('precio con punto de millar español', () => {
    expect(parsearPrecio('38.500 €')).toBe(38500)
    expect(parsearPrecio('1.234.567')).toBe(1234567)
  })

  test('precio con decimales', () => {
    expect(parsearPrecio('38.500,50')).toBe(38500.5)
    expect(parsearPrecio('38,50')).toBe(38.5)
    expect(parsearPrecio('38.50')).toBe(38.5)
  })

  test('precio limpio y rechazo de basura', () => {
    expect(parsearPrecio(' € 38500 ')).toBe(38500)
    expect(parsearPrecio(38500)).toBe(38500)
    expect(parsearPrecio('abc')).toBeNull()
    expect(parsearPrecio('')).toBeNull()
    expect(parsearPrecio('0')).toBeNull()
    expect(parsearPrecio('-100')).toBeNull()
  })

  test('estado del vehículo normalizado a la forma de la base', () => {
    expect(normalizarEstado('nuevo')).toBe('Nuevo')
    expect(normalizarEstado('COMO NUEVO')).toBe('Como nuevo')
    expect(normalizarEstado('seminuevo')).toBe('Como nuevo')
    expect(normalizarEstado('buen estado')).toBe('Bueno')
    expect(normalizarEstado('segunda mano')).toBe('Usado')
    expect(normalizarEstado('para repuestos')).toBe('Para repuestos')
    expect(normalizarEstado('impecable')).toBeNull()
  })

  test('subcategoría por slug o por etiqueta', () => {
    expect(normalizarSubcategoria('gran volumen')).toBe('gran-volumen')
    expect(normalizarSubcategoria('Gran Volumen')).toBe('gran-volumen')
    expect(normalizarSubcategoria('gran-volumen')).toBe('gran-volumen')
    expect(normalizarSubcategoria('Camper Mediana / Compacta')).toBe('camper-mediana')
    expect(normalizarSubcategoria('autocaravana perfilada')).toBe('perfilada')
    expect(normalizarSubcategoria('4x4')).toBe('overland')
    expect(normalizarSubcategoria('nave espacial')).toBeNull()
  })

  test('comunidad con y sin tildes, y alias', () => {
    expect(normalizarComunidad('Andalucía')).toBe('Andalucía')
    expect(normalizarComunidad('andalucia')).toBe('Andalucía')
    expect(normalizarComunidad('Comunidad Valenciana')).toBe('Comunitat Valenciana')
    expect(normalizarComunidad('Madrid')).toBe('Madrid')
    expect(normalizarComunidad('euskadi')).toBe('País Vasco')
    expect(normalizarComunidad('Narnia')).toBeNull()
  })

  test('fotos: separa y solo acepta https', () => {
    expect(separarImagenes('https://a.com/1.jpg|https://a.com/2.jpg')).toHaveLength(2)
    expect(separarImagenes('https://a.com/1.jpg\nhttps://a.com/2.jpg')).toHaveLength(2)
    expect(separarImagenes('')).toEqual([])
    expect(esImagenValida('https://cdn.x.com/a.jpg')).toBe(true)
    expect(esImagenValida('https://cdn.x.com/sin-extension')).toBe(true)
    expect(esImagenValida('http://cdn.x.com/a.jpg')).toBe(false)
    expect(esImagenValida('javascript:alert(1)')).toBe(false)
  })
})

describe('importar-csv - validación de filas', () => {
  const validar = (texto: string, opts = {}) => validarImportacion(parseCsv(texto), opts)

  test('una fila correcta sale sin errores y con sus especificaciones', () => {
    const r = validar(`${CABECERAS}\n${FILA_OK}`)
    expect(r.validas).toBe(1)
    expect(r.invalidas).toBe(0)
    const fila = r.filas[0]
    expect(fila.titulo).toBe('Fiat Ducato L3H2')
    expect(fila.precio).toBe(38500)
    expect(fila.subcategoria).toBe('gran-volumen')
    expect(fila.ubicacion_estado).toBe('Comunitat Valenciana')
    expect(fila.estado).toBe('Como nuevo')
    expect(fila.imagenes).toHaveLength(2)
    expect(fila.especificaciones['Año de matriculación']).toBe('2019')
    expect(fila.especificaciones['Kilómetros']).toBe('145000')
  })

  test('la línea del error es la del archivo, no la del índice', () => {
    const r = validar(`${CABECERAS}\n${FILA_OK}\nMala;;;Narnia`)
    expect(r.filas[0].linea).toBe(2)
    expect(r.filas[1].linea).toBe(3)
  })

  test('fila sin precio, tipo ni comunidad: tres errores claros', () => {
    const r = validar(`${CABECERAS}\nSolo titulo;;;`)
    const fila = r.filas[0]
    expect(fila.errores).toHaveLength(3)
    expect(fila.errores.join(' ')).toContain('precio')
    expect(fila.errores.join(' ')).toContain('tipo')
    expect(fila.errores.join(' ')).toContain('comunidad')
    expect(r.invalidas).toBe(1)
  })

  test('un título demasiado corto no se acepta', () => {
    const r = validar(`${CABECERAS}\nAB;1000;Minicamper;Madrid`)
    expect(r.filas[0].errores[0]).toContain('título')
  })

  test('lo dudoso es aviso, no error: estado raro y año imposible', () => {
    const r = validar(`${CABECERAS}\nCamper X;20000;Integral;Galicia;;;;impecable;1850`)
    const fila = r.filas[0]
    expect(fila.errores).toEqual([])
    expect(fila.estado).toBeNull()
    expect(fila.avisos.join(' ')).toContain('Estado')
    expect(fila.avisos.join(' ')).toContain('Año')
    expect(fila.especificaciones['Año de matriculación']).toBeUndefined()
  })

  test('las fotos se recortan al máximo del plan', () => {
    const fotos = ['a', 'b', 'c', 'd'].map((n) => `https://cdn.x.com/${n}.jpg`).join('|')
    const r = validar(`${CABECERAS}\nCamper X;20000;Integral;Galicia;;;;;;;${fotos}`, { maxFotos: 2 })
    expect(r.filas[0].imagenes).toHaveLength(2)
    expect(r.filas[0].avisos.join(' ')).toContain('2 fotos')
  })

  test('las fotos http se descartan sin invalidar la fila', () => {
    const r = validar(`${CABECERAS}\nCamper X;20000;Integral;Galicia;;;;;;;http://x.com/a.jpg|https://x.com/b.jpg`)
    expect(r.filas[0].errores).toEqual([])
    expect(r.filas[0].imagenes).toEqual(['https://x.com/b.jpg'])
    expect(r.filas[0].avisos.join(' ')).toContain('descartada')
  })

  test('cuenta válidas e inválidas y respeta el tope de filas', () => {
    const tres = [FILA_OK, 'X;0;Integral;Madrid', FILA_OK].join('\n')
    const r = validar(`${CABECERAS}\n${tres}`, { maxFilas: 2 })
    expect(r.filas).toHaveLength(2)
    expect(r.validas).toBe(1)
    expect(r.invalidas).toBe(1)
    expect(r.recortadas).toBe(1)
  })
})

describe('importar-csv - plantilla', () => {
  test('la plantilla se puede volver a leer con el propio parser', () => {
    const csv = parseCsv(plantillaCsv())
    expect(csv.cabeceras).toHaveLength(12)
    expect(csv.filas).toHaveLength(2)
    const r = validarImportacion(csv)
    expect(r.validas).toBe(2)
    expect(r.invalidas).toBe(0)
  })
})
