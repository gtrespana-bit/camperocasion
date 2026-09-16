'use client'

import { useEffect } from 'react'

// El layout raíz es estático (para no desactivar el caching ISR/SSG de todas
// las rutas con cookies()/headers()). El atributo <html lang> depende del
// locale, que aquí ya conocemos desde el segmento [locale]. Este componente,
// diminuto y sin render propio, sincroniza `document.documentElement.lang`
// tras la hidratación para accesibilidad y SEO. El valor por defecto "es" del
// HTML servido es correcto para la gran mayoría del contenido.
export default function HtmlLangSetter({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}
