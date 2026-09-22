'use client'

import { useState } from 'react'
import { ShieldCheck, Star, UserRound } from 'lucide-react'
import dynamic from 'next/dynamic'
import TabReputacion from './TabReputacion'

const SolicitarVerificacion = dynamic(() => import('@/components/SolicitarVerificacion'), { ssr: false })

type Props = {
  verificado: boolean
  nivelConfianza: number
  badgesAuto: string[]
  resenas: any[]
  promedioResenas: number
  numPubsActivas: number
  numPubsVendidas: number
  creadoEn: string | null
  ultimaActividad: string | null
  onEditarPerfil: () => void
  onPassword: () => void
}

export default function TabCuenta(props: Props) {
  const [ver, setVer] = useState<'reputacion' | 'verificacion'>('reputacion')

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <UserRound size={18} className="text-brand-accent" aria-hidden="true" />
            Tu perfil público
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Nombre, foto, teléfono y tipo de vendedor se editan arriba, en la cabecera.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onEditarPerfil}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-dark"
          >
            Editar perfil
          </button>
          <button
            type="button"
            onClick={props.onPassword}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Contraseña
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit" role="tablist" aria-label="Confianza">
        <button
          type="button"
          role="tab"
          aria-selected={ver === 'reputacion'}
          onClick={() => setVer('reputacion')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            ver === 'reputacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Star size={16} aria-hidden="true" />
          Reputación
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ver === 'verificacion'}
          onClick={() => setVer('verificacion')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            ver === 'verificacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          Verificación
        </button>
      </div>

      {ver === 'reputacion' ? (
        <TabReputacion
          verificado={props.verificado}
          nivelConfianza={props.nivelConfianza}
          badgesAuto={props.badgesAuto}
          resenas={props.resenas}
          promedioResenas={props.promedioResenas}
          numPubsActivas={props.numPubsActivas}
          numPubsVendidas={props.numPubsVendidas}
          creadoEn={props.creadoEn}
          ultimaActividad={props.ultimaActividad}
        />
      ) : (
        <SolicitarVerificacion />
      )}
    </div>
  )
}
