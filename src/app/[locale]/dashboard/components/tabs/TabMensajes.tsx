'use client'

import LocalLink from '@/components/LocalLink'
import { MessageSquare, ArrowRight } from 'lucide-react'

export default function TabMensajes() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10">
      <div className="max-w-md">
        <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center mb-4">
          <MessageSquare size={22} className="text-brand-accent" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Conversaciones</h3>
        <p className="text-slate-500 text-sm leading-relaxed">
          El chat es en tiempo real. Ábrelo para responder a compradores: quien contesta antes, vende.
        </p>
        <LocalLink
          href="/chat"
          className="inline-flex items-center gap-2 mt-6 bg-brand-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-dark transition"
        >
          Abrir chat
          <ArrowRight size={16} aria-hidden="true" />
        </LocalLink>
      </div>
    </div>
  )
}
