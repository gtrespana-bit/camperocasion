"use client"

import { useEffect, useRef } from 'react'
import { X, Star } from 'lucide-react'
import LocalLink from '@/components/LocalLink'

export default function DestacadoModal({
  titulo,
  creditos,
  onDestacar,
  onClose,
}: {
  titulo: string
  creditos: number
  onDestacar: (horas: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    dialogRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="destacado-modal-title"
        tabIndex={-1}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="destacado-modal-title" className="text-xl font-bold text-gray-800">
            ⭐ Destacar publicación
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{titulo}</strong>
        </p>
        <p className="text-sm text-gray-600 mb-4">Tu publicación aparecerá:</p>
        <ul className="text-sm text-gray-600 space-y-1 mb-6" role="list">
          <li className="flex items-center gap-2">
            <Star size={14} className="text-brand-accent" aria-hidden="true" /> En la <strong>página principal</strong> como destacado
          </li>
          <li className="flex items-center gap-2">
            <Star size={14} className="text-brand-accent" aria-hidden="true" /> Con <strong>prioridad</strong> en resultados de búsqueda
          </li>
        </ul>
        <div className="space-y-2 mb-6">
          {[
            { horas: 12, creditos: 4 },
            { horas: 24, creditos: 6 },
            { horas: 48, creditos: 10 },
          ].map(op => (
            <button
              key={op.horas}
              onClick={() => onDestacar(op.horas)}
              disabled={creditos < op.creditos}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                creditos >= op.creditos
                  ? 'border-gray-200 hover:border-brand-accent hover:bg-yellow-50'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
              aria-label={`Destacar ${op.horas} horas por ${op.creditos} créditos`}
            >
              <span className="font-bold text-gray-800">{op.horas} horas</span>
              <span className="text-sm font-bold text-brand-primary">{op.creditos} créditos</span>
              {creditos < op.creditos && <span className="text-[10px] text-red-500">insuficiente</span>}
            </button>
          ))}
        </div>
        <LocalLink
          href="/creditos"
          className="block text-center text-sm text-brand-primary hover:underline focus:outline-none focus:ring-2 focus:ring-brand-accent rounded"
        >
          ¿Necesitas más créditos? Comprar →
        </LocalLink>
      </div>
    </div>
  )
}
