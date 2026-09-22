'use client'

import { useState } from 'react'
import { CalendarClock, ClipboardCheck } from 'lucide-react'
import TabReservas from './TabReservas'
import TabInspecciones from './TabInspecciones'

export default function TabTratos({
  userId,
  inicial,
}: {
  userId: string
  inicial?: 'reservas' | 'inspecciones'
}) {
  const [ver, setVer] = useState<'reservas' | 'inspecciones'>(inicial || 'reservas')

  return (
    <div>
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5" role="tablist" aria-label="Tipo de trato">
        <button
          type="button"
          role="tab"
          aria-selected={ver === 'reservas'}
          onClick={() => setVer('reservas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            ver === 'reservas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarClock size={16} aria-hidden="true" />
          Reservas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ver === 'inspecciones'}
          onClick={() => setVer('inspecciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            ver === 'inspecciones' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck size={16} aria-hidden="true" />
          Inspecciones
        </button>
      </div>
      {ver === 'reservas' ? <TabReservas userId={userId} /> : <TabInspecciones />}
    </div>
  )
}
