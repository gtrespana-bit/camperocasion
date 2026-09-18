import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import DocumentoLegal from '@/components/DocumentoLegal'
import { AVISO_LEGAL, type IdiomaLegal } from '@/lib/textos-legales'
import { datosTitular, hayDatosTitular } from '@/lib/datos-legales'

/**
 * Aviso legal (LSSI art. 10).
 *
 * Los datos del titular NO están en el código: se leen del entorno
 * (`src/lib/datos-legales.ts`) para poder rellenarlos en Vercel sin publicar
 * datos fiscales en el repositorio. Mientras falten, la página no se indexa y
 * el pie no la enlaza, de modo que una web en producción nunca muestra un aviso
 * legal incompleto.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'
  return {
    title: AVISO_LEGAL[idioma].titulo,
    // Sin los datos del titular, esta página no debe aparecer en Google.
    robots: hayDatosTitular() ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function AvisoLegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'
  const documento = AVISO_LEGAL[idioma]
  const titular = datosTitular()
  const esIngles = idioma === 'en'

  const etiquetas = esIngles
    ? { nombre: 'Name', nif: 'Tax ID', domicilio: 'Address', email: 'Email', telefono: 'Phone', registro: 'Registry details', pendiente: 'Pending completion' }
    : { nombre: 'Nombre o razón social', nif: 'NIF/CIF', domicilio: 'Domicilio', email: 'Correo electrónico', telefono: 'Teléfono', registro: 'Datos registrales', pendiente: 'Pendiente de completar' }

  const filas: Array<[string, string]> = [
    [etiquetas.nombre, titular.nombre],
    [etiquetas.nif, titular.nif],
    [etiquetas.domicilio, titular.domicilio],
    [etiquetas.email, titular.email],
  ]
  if (titular.telefono) filas.push([etiquetas.telefono, titular.telefono])
  if (titular.registro) filas.push([etiquetas.registro, titular.registro])

  return (
    <DocumentoLegal
      documento={documento}
      bloqueInicial={
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-8">
          <dl className="space-y-2 text-sm">
            {filas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="font-semibold text-gray-700 sm:w-56 shrink-0">{etiqueta}</dt>
                <dd className="text-gray-700">
                  {valor || <span className="text-gray-400 italic">{etiquetas.pendiente}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {!hayDatosTitular() && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-4">
              {esIngles
                ? 'This page is not yet linked from the footer or indexed by search engines: the owner’s identification details are being completed.'
                : 'Esta página aún no se enlaza desde el pie ni se indexa en buscadores: se están completando los datos identificativos del titular.'}
            </p>
          )}
        </div>
      }
    />
  )
}
