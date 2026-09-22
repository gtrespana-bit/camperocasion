'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Eye, MessageCircle, BarChart3, Plus, Package, Calculator, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import type { DashboardTab } from './DashboardNav'

export default function TabResumen({
  userId,
  onIr,
}: {
  userId: string
  onIr?: (tab: DashboardTab) => void
}) {
  const t = useTranslations('dashboard')
  const [stats, setStats] = useState<any>(null)
  // Preferencia de avisos por email. `null` mientras se carga, para no
  // enseñar el interruptor en la posición equivocada durante un instante.
  const [avisosEmail, setAvisosEmail] = useState<boolean | null>(null)
  const [guardandoAvisos, setGuardandoAvisos] = useState(false)

  useEffect(() => {
    async function loadStats() {
      const uid = userId

      const { count: activos } = await supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('activo', true)

      const { data: productos } = await supabase
        .from('productos')
        .select('visitas')
        .eq('user_id', uid)
        .eq('activo', true)

      const totalVisitas = productos?.reduce((sum: number, p: any) => sum + (p.visitas || 0), 0) || 0

      const { count: mensajesNoLeidos } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', uid)
        .eq('leido', false)

      const { count: favoritos } = await supabase
        .from('favoritos')
        .select('id', { count: 'exact', head: true })
        .in('producto_id',
          (await supabase.from('productos').select('id').eq('user_id', uid).eq('activo', true))
            ?.data?.map((p: any) => p.id) || []
        )

      const { count: vendidos } = await supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('activo', false)

      setStats({
        activos: activos || 0,
        totalVisitas,
        mensajesNoLeidos: mensajesNoLeidos || 0,
        favoritos,
        vendidos: vendidos || 0,
      })
    }
    loadStats()
  }, [userId])

  // Se lee y escribe por /api/perfil: la tabla `perfiles` tiene permisos por
  // columna y esta preferencia no está expuesta al navegador a propósito.
  useEffect(() => {
    let vivo = true
    fetch('/api/perfil')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return
        // Sin dato todavía: el valor por defecto es avisar.
        setAvisosEmail(d?.profile?.email_avisos_mensajes !== false)
      })
      .catch(() => { if (vivo) setAvisosEmail(null) })
    return () => { vivo = false }
  }, [userId])

  async function cambiarAvisos(valor: boolean) {
    const previo = avisosEmail
    setAvisosEmail(valor)       // respuesta inmediata
    setGuardandoAvisos(true)
    try {
      const r = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_avisos_mensajes: valor }),
      })
      if (!r.ok) setAvisosEmail(previo)   // revertir si el servidor lo rechaza
    } catch {
      setAvisosEmail(previo)
    } finally {
      setGuardandoAvisos(false)
    }
  }

  if (!stats) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const tarjetas = [
    { label: t('activeListings'), value: stats.activos, icon: BarChart3, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
    { label: t('totalVisits'), value: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(stats.totalVisitas)), icon: Eye, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
    { label: t('unreadMessages'), value: stats.mensajesNoLeidos, icon: MessageCircle, color: stats.mensajesNoLeidos > 0 ? 'text-red-500' : 'text-gray-500', bg: stats.mensajesNoLeidos > 0 ? 'bg-red-50' : 'bg-gray-50' },
    { label: t('savedFavorites'), value: stats.favoritos || 0, icon: TrendingUp, color: 'text-brand-accent', bg: 'bg-brand-accent/10' },
  ]

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">{t('summaryTitle')}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tarjetas.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
              <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon size={20} className={item.color} />
              </div>
              <p className="text-2xl font-black text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          )
        })}
      </div>

      {avisosEmail !== null && (
        <div className="mt-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Avisarme por email de mensajes nuevos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Solo si no los has leído en unos minutos. Quien responde antes, vende.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={avisosEmail}
            aria-label="Avisarme por email de mensajes nuevos"
            disabled={guardandoAvisos}
            onClick={() => cambiarAvisos(!avisosEmail)}
            className={`relative w-12 h-7 rounded-full transition flex-shrink-0 disabled:opacity-50 ${avisosEmail ? 'bg-brand-primary' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${avisosEmail ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      )}

      {stats.vendidos > 0 && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-green-600 text-lg">🎉</span>
          <p className="text-sm text-green-700 font-medium">
            <strong>{stats.vendidos}</strong> {stats.vendidos === 1 ? 'listing sold' : 'listings sold'}
          </p>
        </div>
      )}
    </div>
  )
}
