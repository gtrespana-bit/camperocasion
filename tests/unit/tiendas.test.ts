/**
 * Tests de la tienda de profesionales.
 *
 * Lo que se protege:
 *  1. Que el slug del navegador y el de SQL den lo MISMO. El formulario
 *     previsualiza la URL y la base la genera: si divergen, el vendedor
 *     reparte una dirección que no existe.
 *  2. Que un slug no pueda secuestrar una ruta real (`/tienda/admin`).
 *  3. Que la web del vendedor no acabe siendo un `javascript:` en un href
 *     público.
 *  4. Que un particular no pueda abrir tienda (es la distinción que vende
 *     este marketplace).
 */
import {
  LIMITES_TIENDA,
  SLUGS_RESERVADOS,
  TIPOS_CON_TIENDA,
  normalizarWeb,
  puedeTenerTienda,
  slugReservado,
  slugValido,
  slugify,
  urlTienda,
  validarTienda,
} from '@/lib/tiendas'

describe('quién puede abrir tienda', () => {
  it('camperizadores y profesionales sí', () => {
    expect(puedeTenerTienda('camperizador')).toBe(true)
    expect(puedeTenerTienda('profesional')).toBe(true)
  })

  it('un particular no', () => {
    expect(puedeTenerTienda('particular')).toBe(false)
  })

  it('un tipo desconocido o ausente tampoco', () => {
    expect(puedeTenerTienda(null)).toBe(false)
    expect(puedeTenerTienda(undefined)).toBe(false)
    expect(puedeTenerTienda('')).toBe(false)
    expect(puedeTenerTienda('admin')).toBe(false)
  })

  it('la lista coincide con la del check de la migración', () => {
    expect([...TIPOS_CON_TIENDA].sort()).toEqual(['camperizador', 'profesional'])
  })
})

describe('slugify (debe igualar a fn_slugify en SQL)', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(slugify('Camperización Martín')).toBe('camperizacion-martin')
  })

  it('colapsa separadores y recorta guiones', () => {
    expect(slugify('  Furgo   Camper &  Co.  ')).toBe('furgo-camper-co')
    expect(slugify('---Taller---')).toBe('taller')
  })

  it('trata la ñ y la ç como en SQL', () => {
    expect(slugify('Peñíscola Camper')).toBe('peniscola-camper')
    expect(slugify('Provença Vans')).toBe('provenca-vans')
  })

  it('es idempotente: slugificar un slug lo deja igual', () => {
    const s = slugify('Autocaravanas del Sur, S.L.')
    expect(slugify(s)).toBe(s)
  })

  it('no revienta con entradas vacías', () => {
    expect(slugify('')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})

describe('slugs válidos y reservados', () => {
  it('acepta slugs normales', () => {
    expect(slugValido('furgocamper-valencia')).toBe(true)
    expect(slugValido('vans4x4')).toBe(true)
  })

  it('rechaza guiones al borde o dobles', () => {
    expect(slugValido('-taller')).toBe(false)
    expect(slugValido('taller-')).toBe(false)
    expect(slugValido('taller--sur')).toBe(false)
  })

  it('rechaza mayúsculas, espacios y símbolos', () => {
    expect(slugValido('Taller Sur')).toBe(false)
    expect(slugValido('taller_sur')).toBe(false)
    expect(slugValido('taller/sur')).toBe(false)
  })

  it('respeta la longitud mínima y máxima', () => {
    expect(slugValido('ab')).toBe(false)
    expect(slugValido('a'.repeat(LIMITES_TIENDA.slugMax + 1))).toBe(false)
    expect(slugValido('a'.repeat(LIMITES_TIENDA.slugMax))).toBe(true)
  })

  it('no deja secuestrar rutas del sitio', () => {
    for (const reservado of SLUGS_RESERVADOS) {
      expect(slugReservado(reservado)).toBe(true)
      expect(validarTienda({ nombre: 'X', slug: reservado }).slug).toBeTruthy()
    }
  })
})

describe('normalizarWeb', () => {
  it('añade https a un dominio suelto', () => {
    expect(normalizarWeb('furgocamper.es')).toBe('https://furgocamper.es/')
  })

  it('conserva una URL completa', () => {
    expect(normalizarWeb('https://taller.es/stock')).toBe('https://taller.es/stock')
  })

  it('rechaza esquemas peligrosos (acaba en un href público)', () => {
    expect(normalizarWeb('javascript:alert(1)')).toBeNull()
    expect(normalizarWeb('data:text/html,<script>')).toBeNull()
  })

  it('rechaza texto que no es un dominio', () => {
    expect(normalizarWeb('mi taller')).toBeNull()
    expect(normalizarWeb('localhost')).toBeNull()
  })

  it('vacío es null, no error', () => {
    expect(normalizarWeb('')).toBeNull()
    expect(normalizarWeb(null)).toBeNull()
    expect(normalizarWeb(undefined)).toBeNull()
  })
})

describe('validarTienda', () => {
  it('acepta una tienda completa', () => {
    expect(
      validarTienda({
        nombre: 'Furgocamper Valencia',
        descripcion: 'Camperizamos furgonetas desde 2011.',
        web: 'furgocamper.es',
        horario: 'L-V 9:00-18:00',
        direccion: 'Pol. Ind. Norte, nave 4',
        slug: 'furgocamper-valencia',
      })
    ).toEqual({})
  })

  it('exige nombre', () => {
    expect(validarTienda({ nombre: '' }).nombre).toBeTruthy()
    expect(validarTienda({ nombre: 'A' }).nombre).toBeTruthy()
  })

  it('corta descripciones desmesuradas', () => {
    const larga = 'x'.repeat(LIMITES_TIENDA.descripcion + 1)
    expect(validarTienda({ nombre: 'Taller', descripcion: larga }).descripcion).toBeTruthy()
  })

  it('avisa de una web inválida', () => {
    expect(validarTienda({ nombre: 'Taller', web: 'javascript:alert(1)' }).web).toBeTruthy()
  })

  it('no exige slug: se genera solo al activar la tienda', () => {
    expect(validarTienda({ nombre: 'Taller' })).toEqual({})
    expect(validarTienda({ nombre: 'Taller', slug: '' })).toEqual({})
  })
})

describe('urlTienda', () => {
  it('construye la ruta pública', () => {
    expect(urlTienda('furgocamper-valencia')).toBe('/tienda/furgocamper-valencia')
  })
})
