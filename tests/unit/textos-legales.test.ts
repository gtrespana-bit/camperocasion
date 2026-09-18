/**
 * Guardas de los textos legales.
 *
 * Los documentos legales son los únicos textos del sitio que no viven en los
 * diccionarios de i18n (ver `src/lib/textos-legales.ts`), así que un descuido al
 * editar uno de los dos idiomas no lo detectaría ninguna herramienta. Estas
 * pruebas fijan lo mínimo imprescindible: que las dos versiones existan, que
 * tengan la misma estructura y que estén los datos que la normativa obliga a
 * publicar.
 */

import {
  AVISO_LEGAL,
  POLITICA_COOKIES,
  POLITICA_PRIVACIDAD,
  TERMINOS,
  type DocumentoLegal,
} from '@/lib/textos-legales'
import { datosTitular, hayDatosTitular } from '@/lib/datos-legales'

const DOCUMENTOS: Array<[string, Record<'es' | 'en', DocumentoLegal>]> = [
  ['aviso legal', AVISO_LEGAL],
  ['privacidad', POLITICA_PRIVACIDAD],
  ['cookies', POLITICA_COOKIES],
  ['términos', TERMINOS],
]

describe.each(DOCUMENTOS)('%s', (_nombre, documento) => {
  it('existe en español y en inglés', () => {
    for (const idioma of ['es', 'en'] as const) {
      expect(documento[idioma].titulo.length).toBeGreaterThan(3)
      expect(documento[idioma].actualizado).toMatch(/2026/)
      expect(documento[idioma].secciones.length).toBeGreaterThan(2)
    }
  })

  it('las dos versiones tienen las mismas secciones (nada a medio traducir)', () => {
    expect(documento.en.secciones.length).toBe(documento.es.secciones.length)
  })

  it('cada sección tiene título y contenido', () => {
    for (const idioma of ['es', 'en'] as const) {
      for (const seccion of documento[idioma].secciones) {
        expect(seccion.titulo.trim().length).toBeGreaterThan(3)
        const contenido = (seccion.parrafos?.length || 0) + (seccion.lista?.length || 0)
        expect(contenido).toBeGreaterThan(0)
      }
    }
  })
})

describe('contenido que la normativa obliga a publicar', () => {
  it('la privacidad nombra al responsable, la base jurídica, la conservación y la AEPD', () => {
    const texto = JSON.stringify(POLITICA_PRIVACIDAD.es)
    expect(texto).toContain('Responsable del tratamiento')
    expect(texto).toContain('base jurídica')
    expect(texto).toContain('conservamos')
    expect(texto).toContain('aepd.es')
  })

  it('la privacidad describe los encargados reales del servicio', () => {
    const texto = JSON.stringify(POLITICA_PRIVACIDAD.es)
    for (const proveedor of ['Supabase', 'Vercel', 'Resend']) {
      expect(texto).toContain(proveedor)
    }
  })

  it('la privacidad no afirma que no se comparten datos (sería falso)', () => {
    const texto = JSON.stringify(POLITICA_PRIVACIDAD.es).toLowerCase()
    expect(texto).not.toContain('no compartimos tus datos personales con terceros')
    expect(texto).not.toContain('no vendemos ni compartimos')
  })

  it('las cookies explican la medición y cómo retirar el consentimiento', () => {
    const es = JSON.stringify(POLITICA_COOKIES.es)
    expect(es).toContain('cookie-consent')
    expect(es).toContain('Vercel Analytics')
    expect(es.toLowerCase()).toContain('cambiar tu decisión')
  })

  it('los términos informan de la condición de intermediario y del desistimiento', () => {
    const es = JSON.stringify(TERMINOS.es)
    expect(es).toContain('intermediario')
    expect(es).toContain('Desistimiento')
    expect(es).toContain('7 días')
  })

  it('el aviso legal avisa de que la plataforma no vende los vehículos', () => {
    const es = JSON.stringify(AVISO_LEGAL.es)
    expect(es).toContain('no es el vendedor')
    expect(es).toContain('intermediario')
  })
})

describe('datos del titular', () => {
  const CLAVES = [
    'NEXT_PUBLIC_TITULAR_NOMBRE',
    'NEXT_PUBLIC_TITULAR_NIF',
    'NEXT_PUBLIC_TITULAR_DOMICILIO',
    'NEXT_PUBLIC_TITULAR_EMAIL',
    'NEXT_PUBLIC_TITULAR_TELEFONO',
    'NEXT_PUBLIC_TITULAR_REGISTRO',
  ] as const

  afterEach(() => {
    for (const clave of CLAVES) delete process.env[clave]
  })

  it('sin configurar: no se publica el aviso legal en el pie ni se indexa', () => {
    expect(hayDatosTitular()).toBe(false)
  })

  it('con nombre, NIF y domicilio: el aviso legal ya se puede publicar', () => {
    process.env.NEXT_PUBLIC_TITULAR_NOMBRE = 'CamperOcasión SL'
    process.env.NEXT_PUBLIC_TITULAR_NIF = 'B12345678'
    expect(hayDatosTitular()).toBe(false) // falta el domicilio

    process.env.NEXT_PUBLIC_TITULAR_DOMICILIO = 'Calle Mayor 1, 46001 Valencia'
    expect(hayDatosTitular()).toBe(true)
  })

  it('sin email propio se usa el buzón de privacidad (la LSSI lo exige)', () => {
    delete process.env.NEXT_PUBLIC_TITULAR_EMAIL
    delete process.env.NEXT_PUBLIC_EMAIL_CONTACTO
    expect(datosTitular().email).toBe('privacidad@camperocasion.online')
  })
})
