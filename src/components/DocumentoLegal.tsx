import PublicHero from '@/components/editorial/PublicHero'
import type { ReactNode } from 'react'
import type { DocumentoLegal as Doc } from '@/lib/textos-legales'

/**
 * Plantilla común de las páginas legales (aviso legal, privacidad, cookies y
 * términos). Las cuatro comparten estructura —título, fecha, entradilla y
 * secciones— así que el formato vive en un solo sitio: si mañana cambia la
 * tipografía o el ancho de lectura, cambia en las cuatro a la vez.
 *
 * `children` permite insertar bloques propios de una página (los datos del
 * titular en el aviso legal, el botón de preferencias en cookies).
 */
export default function DocumentoLegal({
  documento,
  children,
  bloqueInicial,
}: {
  documento: Doc
  children?: ReactNode
  /** Se pinta justo debajo de la entradilla (sección 1 del aviso legal). */
  bloqueInicial?: ReactNode
}) {
  return (
    <div className="public-page min-h-screen">
      <PublicHero compact eyebrow="CamperOcasión · Legal" title={documento.titulo} description={documento.entradilla} />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="mb-8 text-sm font-medium text-slate-600">{documento.actualizado}</p>

      {bloqueInicial}

      <div className="space-y-12 text-slate-700 leading-[1.75]">
        {documento.secciones.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="public-section-title mb-4">{seccion.titulo}</h2>
            {seccion.parrafos?.map((parrafo) => (
              <p key={parrafo.slice(0, 40)} className="mb-3 leading-relaxed">
                {parrafo}
              </p>
            ))}
            {seccion.lista && (
              <ul className="list-disc list-inside space-y-1.5">
                {seccion.lista.map((item) => (
                  <li key={item.slice(0, 40)} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {children}
      </div>
    </div>
  )
}
