'use client'

import { useEffect, useState } from 'react'
import { X, Link2 } from 'lucide-react'

type Announcement = {
  id: string
  titulo: string
  mensaje: string
  emoji: string | null
  enlace: string | null
  enlace_texto: string | null
}

/**
 * Banner global administrable desde el panel admin.
 *
 * Lee `/api/anuncios/active` y se oculta si no hay un anuncio activo o si la
 * tabla todavía no fue creada en Supabase (permitiendo despliegues graduales).
 */
export default function SiteAnnouncement() {
  const [anuncio, setAnuncio] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/anuncios/active')
      .then((r) => (r.ok ? r.json() : { anuncio: null }))
      .then((d) => { if (!cancelled) setAnuncio(d?.anuncio || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!anuncio || dismissed) return null

  return (
    <div className="border-b border-brand-primary/10 bg-gradient-to-r from-brand-primary/95 via-brand-dark to-brand-primary px-4 py-2 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-1 sm:px-2">
        <span className="text-base leading-none sm:text-lg" aria-hidden="true">{anuncio.emoji || '📢'}</span>
        <div className="min-w-0 flex-1 text-center text-xs font-medium sm:text-sm">
          <span className="mr-1.5 font-black text-brand-accent">{anuncio.titulo}</span>
          <span className="opacity-90">{anuncio.mensaje}</span>
          {anuncio.enlace && (
            <a
              href={anuncio.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 font-bold text-brand-accent underline-offset-2 hover:underline"
            >
              <Link2 size={12} /> {anuncio.enlace_texto || 'Ver más'}
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar anuncio"
          className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
