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
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-black text-gray-800 mb-2">{documento.titulo}</h1>
      <p className="text-gray-500 mb-6">{documento.actualizado}</p>
      <p className="text-gray-600 mb-8 leading-relaxed">{documento.entradilla}</p>

      {bloqueInicial}

      <div className="space-y-8 text-gray-600">
        {documento.secciones.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="text-xl font-bold text-gray-800 mb-3">{seccion.titulo}</h2>
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
  )
}
