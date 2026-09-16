"use client"

import { Star, ShieldCheck, Activity } from 'lucide-react'
import BadgeVerificado from '@/components/BadgeVerificado'
import SellerReputation from '@/components/SellerReputation'
import { useTranslations } from 'next-intl'

export default function TabReputacion({
  verificado,
  nivelConfianza,
  badgesAuto,
  resenas,
  promedioResenas,
  numPubsActivas,
  numPubsVendidas,
  creadoEn,
  ultimaActividad,
}: {
  verificado: boolean
  nivelConfianza: number
  badgesAuto: string[]
  resenas: any[]
  promedioResenas: number
  numPubsActivas: number
  numPubsVendidas: number
  creadoEn: string | null
  ultimaActividad: string | null
}) {
  const t = useTranslations('dashboard')
  const antiguedadDias = creadoEn
    ? Math.floor((Date.now() - new Date(creadoEn).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const estrellasRender = (rating: number, size = 16) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={size}
        className={i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}
      />
    ))
  }

  return (
    <div className="space-y-6">
      {/* Resumen: lo que otros ven */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ShieldCheck size={20} className="text-brand-primary" />
          {t('yourReputation')}
        </h3>
        <SellerReputation
          nivel={nivelConfianza}
          numResenas={resenas.length}
          promedioResenas={promedioResenas}
          numPubsActivas={numPubsActivas}
          numPubsVendidas={numPubsVendidas}
          antiguedadDias={antiguedadDias}
          ultimaActividad={ultimaActividad}
          verificado={verificado}
          badges={badgesAuto}
          size="lg"
        />
      </div>

      {/* Reseñas recibidas */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Star size={20} className="text-yellow-400 fill-yellow-400" />
          {t('reviews')} ({resenas.length})
        </h3>
        {resenas.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">{t('noReviews')}</p>
        ) : (
          <div className="space-y-4">
            {resenas.map((r: any) => (
              <div key={r.id} className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {estrellasRender(r.puntuacion, 14)}
                    <span className="text-sm font-medium ml-2">{r.puntuacion}/5</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(r.creado_en).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comentario && <p className="text-sm text-gray-600">{r.comentario}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Activity size={20} className="text-brand-primary" />
          {t('stats')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-brand-primary">{numPubsActivas}</p>
            <p className="text-xs text-gray-500 mt-1">{t('activeListings')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-green-600">{numPubsVendidas}</p>
            <p className="text-xs text-gray-500 mt-1">{t('soldPaused')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-yellow-500">{antiguedadDias}</p>
            <p className="text-xs text-gray-500 mt-1">{t('daysOnPlatform')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-purple-600">{verificado ? '✅' : '⏳'}</p>
            <p className="text-xs text-gray-500 mt-1">{t('verification')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
