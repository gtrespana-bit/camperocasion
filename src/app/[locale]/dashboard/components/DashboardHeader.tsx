"use client"

import Avatar from '@/components/Avatar'
import BadgeVerificado from '@/components/BadgeVerificado'
import { getMunicipiosNombres, ESTADOS } from '@/lib/ubicaciones'
import { Camera, Edit, Key, LogOut, X, Save, Phone, MapPin, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const ICONOS: Record<number, string> = { 0: '🥉', 1: '🥈', 2: '🥇', 3: '💎', 4: '💠', 5: '👑' }
const NIVELES: Record<number, { nombreKey: string; bg: string; text: string; border: string }> = {
  0: { nombreKey: 'levelBronze', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  1: { nombreKey: 'levelSilver', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  2: { nombreKey: 'levelGold', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300' },
  3: { nombreKey: 'levelPlatinum', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  4: { nombreKey: 'levelDiamond', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  5: { nombreKey: 'levelMaster', bg: 'bg-gradient-to-r from-yellow-50 to-purple-50', text: 'text-purple-900', border: 'border-purple-300' },
}

export default function DashboardHeader({
  user,
  nombre, setNombre, telefono, setTelefono, estado, setEstado, ciudad, setCiudad,
  fotoUrl, setFotoUrl,
  verificado, nivelConfianza, resenasCount, promedioResenas,
  setToast, setGuardando, onPassword, onLogout, onFotoChange,
}: {
  user: any
  nombre: string; setNombre: (s: string) => void
  telefono: string; setTelefono: (s: string) => void
  estado: string; setEstado: (s: string) => void
  ciudad: string; setCiudad: (s: string) => void
  fotoUrl: string | null; setFotoUrl: (s: string | null) => void
  verificado: boolean
  nivelConfianza: number
  resenasCount: number
  promedioResenas: number
  setToast: (msg: string | null) => void
  setGuardando: (b: boolean) => void
  onPassword: () => void
  onLogout: () => void

  onFotoChange: (e: any) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const [editando, setEditando] = useState(false)
  const municipiosDisponibles = estado ? getMunicipiosNombres(estado) : []

  async function handleGuardar() {
    if (!nombre.trim() || !user) return
    setGuardando(true)
    try {
      const response = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, estado, ciudad }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setToast(t('saveError') + (result.error || 'Error desconocido'))
      } else {
        setEditando(false)
        setToast(t('profileSaved'))
      }
    } catch {
      setToast(t('saveError') + 'Error de conexión')
    }
    setGuardando(false)
    setTimeout(() => setToast(null), 4000)
  }

  const n = Math.min(nivelConfianza, 5)
  const cfg = NIVELES[n]

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <label className="relative group cursor-pointer flex-shrink-0">
          <Avatar nombre={nombre} fotoUrl={fotoUrl} size="lg" />
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Camera size={18} className="text-white" />
          </div>
          <input type="file" accept="image/*" onChange={onFotoChange} className="hidden" />
        </label>
        <div className="flex-1 min-w-0">
          {editando ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('name')}</label>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t('namePlaceholder')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Phone size={12} /> {t('phone')}</label>
                  <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+58 412 1234567" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><MapPin size={12} /> {t('state')}</label>
                  <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">{t('selectType')}</option>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('municipality')}</label>
                  <select value={ciudad} onChange={e => setCiudad(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" disabled={!estado}>
                    <option value="">{t('selectType')}</option>
                    {municipiosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleGuardar} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
                  <Save size={14} /> {t('save')}
                </button>
                <button onClick={() => setEditando(false)} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  <X size={14} /> {t('cancelEdit')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {nombre || <button onClick={() => setEditando(true)} className="text-sm font-medium text-brand-primary hover:underline">{t('addName')}</button>}
                </h2>
                {user?.email && <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Mail size={12} /> {user.email}</p>}
                {(ciudad || estado) && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={12} /> {[ciudad, estado].filter(Boolean).join(', ')}</p>}
                {/* Badges */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {verificado && <BadgeVerificado size="sm" />}
                  <div className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border}`}>
                      <span className="text-sm leading-none">{ICONOS[n]}</span>
                      <span className={`font-semibold ${cfg.text}`}>{t(cfg.nombreKey)}</span>
                    </span>
                    {resenasCount > 0 && (
                      <span className="text-gray-500">{t('reviewsSummary', { rating: promedioResenas.toFixed(1), count: resenasCount })}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setEditando(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1 border px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                  <Edit size={14} /> {t('editProfile')}
                </button>
                <button onClick={onPassword} className="flex items-center gap-1 text-brand-primary hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition">
                  <Key size={14} /> {t('password')}
                </button>
                <button onClick={onLogout} className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition">
                  <LogOut size={14} /> {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
