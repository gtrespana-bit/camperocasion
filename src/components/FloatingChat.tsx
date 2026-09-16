'use client'

import { useState } from 'react'
import { X, Send, MessageCircle } from 'lucide-react'

export function FloatingChat() {
  const [open, setOpen] = useState(false)

  return (
    <div className="floating-chat">
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 mb-4 overflow-hidden animate-fadeIn">
          <div className="bg-brand-primary text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">TA</div>
              <div>
                <p className="font-bold text-sm">CamperOcasión Ayuda</p>
                <p className="text-xs text-blue-200 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                  En línea
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar chat de ayuda" className="p-1 hover:bg-white/20 rounded-lg transition"><X size={18} /></button>
          </div>
          <div className="p-4 h-52 overflow-y-auto bg-gray-50">
            <p className="bg-white text-gray-700 text-sm p-3 rounded-2xl rounded-tl-sm shadow-sm max-w-xs">
              ¡Hola! 👋 ¿Cómo podemos ayudarte? Puedes preguntar sobre cómo publicar, créditos o cualquier duda.
            </p>
          </div>
          <div className="p-3 border-t">
            <form className="flex gap-2">
              <input type="text" placeholder="Escribe un mensaje..." className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent" />
              <button type="submit" aria-label="Enviar mensaje" className="bg-brand-primary text-white w-10 h-10 rounded-full hover:bg-brand-dark transition flex items-center justify-center">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Cerrar chat de ayuda' : 'Abrir chat de ayuda'}
        className="w-14 h-14 bg-brand-primary text-white rounded-full shadow-lg hover:bg-brand-dark transition flex items-center justify-center"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  )
}
