'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { Send, ArrowLeft, Search, User, Trash2, ExternalLink, Star } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { useTranslations } from 'next-intl'

type Conversacion = {
  id: string
  user1_id: string
  user2_id: string
  producto_id: string | null
  ultimo_mensaje: string | null
  ultimo_mensaje_en: string | null
  creado_en: string
  otro_nombre: string
  otro_foto: string | null
  otro_email: string | null
  producto_titulo: string | null
  no_leidos: number
}

type Mensaje = {
  id: string
  conversacion_id: string
  remitente_id: string
  destinatario_id: string | null
  contenido: string
  leido: boolean
  creado_en: string
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d`
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function slugProducto(titulo: string, id: string): string {
  return titulo.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/(^\-|-$)/g, '') + '-' + id.substring(0, 8)
}

export default function ChatPageClient() {
  const t = useTranslations('chat')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const productoId = searchParams?.get('producto_id')
  const vendedorId = searchParams?.get('vendedor_id')

  const [conversaciones, setConversaciones] = useState<Conversacion[]>(() => {
    // Restore cached conversations for instant render
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('camperocasion_chat_convs')
        if (cached) return JSON.parse(cached)
      } catch {}
    }
    return []
  })
  const [convId, setConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const loadingRef = useRef(false)
  const [busqueda, setBusqueda] = useState('')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)

  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const userRef = useRef(user)
  const convIdRef = useRef(convId)
  userRef.current = user
  convIdRef.current = convId

  // ─── Estados reseña comprador ───
  const [mostrarResena, setMostrarResena] = useState(false)
  const [ratingResena, setRatingResena] = useState(5)
  const [comentarioResena, setComentarioResena] = useState('')
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [puedeResenar, setPuedeResenar] = useState(false)
  const [productoOwnerId, setProductoOwnerId] = useState<string | null>(null)
  const [yaDejoResena, setYaDejoResena] = useState(false)

  // BroadcastChannel para sincronizar badge con Header
  useEffect(() => {
    if (typeof window === 'undefined') return
    const bc = new BroadcastChannel('camperocasion_unread_sync')
    bcRef.current = bc
    return () => bc.close()
  }, [])

  // ─── Auth guard ───
  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/login')
  }, [user, authLoading, router])

  // ─── Auto-scroll ───
  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes])

  // ─── Cargar owner del producto y verificar reseña comprador ───
  useEffect(() => {
    if (!convId || !user) return
    setProductoOwnerId(null)
    setPuedeResenar(false)
    setYaDejoResena(false)

    fetch('/api/chat/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ convId, userId: user.id }),
    })
    .then(async r => {
      const data = await r.json()
      setProductoOwnerId(data.productoOwnerId)
      setPuedeResenar(data.puedeResenar)
      setYaDejoResena(data.yaDejoResena)
    })
    .catch(err => console.error('[REVIEW-STATUS] error:', err))
  }, [convId, user])

  // ─── Cargar conversaciones ───
  const loadConversaciones = useCallback(async () => {
    const uid = userRef.current?.id
    if (!uid) { loadingRef.current = false; return }

    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id, ultimo_mensaje_en, ultimo_mensaje')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('ultimo_mensaje_en', { ascending: false })

    if (error) { console.error('Error loading convs:', error); return }

    const otroIds = [...new Set(convs?.map((c: any) => c.user1_id === uid ? c.user2_id : c.user1_id).filter(Boolean) || [])]
    const prodIds = [...new Set(convs?.filter((c: any) => c.producto_id).map((c: any) => c.producto_id as string) || [])]

    // Also fetch profiles/products for URL params if they exist
    if (vendedorId && !otroIds.includes(vendedorId)) otroIds.push(vendedorId)
    if (productoId && !prodIds.includes(productoId)) prodIds.push(productoId)

    // Fetch perfiles via API server-side (bypass RLS) / productos via supabase client
    let perfilMap = new Map<string, { nombre: string; foto: string | null; email: string | null }>()
    if (otroIds.length) {
      try {
        const resp = await fetch(`/api/user-bulk?ids=${encodeURIComponent(otroIds.join(','))}`)
        const json = await resp.json()
        json.profiles?.forEach((p: { id: string; nombre: string; foto_perfil_url: string | null }) => {
          perfilMap.set(p.id, { nombre: p.nombre || 'Usuario', foto: p.foto_perfil_url || null, email: null })
        })
      } catch (e) { console.error('Error fetching user-bulk:', e) }
    }
    const [, productosRes] = await Promise.all([
      Promise.resolve(null),
      prodIds.length ? supabase.from('productos').select('id, titulo').in('id', prodIds) : Promise.resolve({ data: [] }),
    ])

    const prodMap = new Map<string, string>()
    productosRes.data?.forEach((p: any) => prodMap.set(p.id, p.titulo || ''))

    // Unread count
    const unreadMap = new Map<string, number>()
    if (convs && convs.length > 0) {
      const { data: unreadData } = await supabase
        .from('mensajes')
        .select('conversacion_id')
        .eq('destinatario_id', uid)
        .eq('leido', false)
        .in('conversacion_id', convs.map((c: any) => c.id))
      unreadData?.forEach((m: { conversacion_id: string }) => {
        const count = unreadMap.get(m.conversacion_id) || 0
        unreadMap.set(m.conversacion_id, count + 1)
      })
    }

    const enriched: Conversacion[] = (convs || []).map((c: any) => {
      const otroId = c.user1_id === uid ? c.user2_id : c.user1_id
      const p = perfilMap.get(otroId)
      return {
        ...c,
        otro_nombre: p?.nombre || 'Usuario',
        otro_foto: p?.foto || null,
        otro_email: p?.email || null,
        producto_titulo: c.producto_id ? (prodMap.get(c.producto_id) || null) : null,
        no_leidos: unreadMap.get(c.id) || 0,
      }
    })

    setConversaciones(enriched)

    // Cache en sessionStorage para carga instantánea la próxima vez
    try {
      sessionStorage.setItem('camperocasion_chat_convs', JSON.stringify(enriched))
    } catch {}

    // If URL has producto_id + vendedor_id, try to find or create conv
    if (productoId && vendedorId && vendedorId !== uid) {
      const match = enriched.find(c =>
        c.producto_id === productoId &&
        ((c.user1_id === uid && c.user2_id === vendedorId) ||
         (c.user1_id === vendedorId && c.user2_id === uid))
      )
      if (match) {
        setConvId(match.id)
        setShowMobileChat(true)
      } else {
        const response = await fetch('/api/crear-conversacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendedorId, productoId }),
        })
        const result = await response.json().catch(() => ({}))
        const newConv = result?.id ? result : null

        if (!response.ok || !newConv) {
          console.error('Error creating conversation:', result.error || response.status)
        } else {
          const perfil = perfilMap.get(vendedorId)
          setConversaciones(prev => [{
            ...newConv,
            otro_nombre: perfil?.nombre || 'Usuario',
            otro_foto: perfil?.foto || null,
            otro_email: null,
            producto_titulo: prodMap.get(productoId) || null,
            no_leidos: 0,
          }, ...prev])
          setConvId(newConv.id)
          setShowMobileChat(true)
        }
      }
    }
  }, [productoId, vendedorId])

  // Load once
  useEffect(() => {
    if (authLoading || !user) return
    loadingRef.current = true
    setLoadingConvs(true)
    loadConversaciones().then(() => { loadingRef.current = false; setLoadingConvs(false) })
  }, [user, authLoading, loadConversaciones])

  // ─── Cargar mensajes ───
  const loadMensajes = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('mensajes')
      .select('id, remitente_id, destinatario_id, contenido, leido, creado_en, conversacion_id')
      .eq('conversacion_id', id)
      .order('creado_en', { ascending: true })

    if (error) { console.error('Error loading msgs:', error); return }
    setMensajes(data || [])
  }, [])

  // Load messages on mount/conv change (realtime handles live updates)
  useEffect(() => {
    if (!convId) return
    loadMensajes(convId)
  }, [convId, loadMensajes])

  // ─── Realtime: listen for new inserts en mensajes ───
  useEffect(() => {
    if (!user) return
    const sub = supabase
      .channel('chat-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload: any) => {
        const nuevo = payload.new as any
        if (nuevo.conversacion_id === convIdRef.current) {
          setMensajes(prev => {
            if (prev.some(m => m.id === nuevo.id)) return prev
            return [...prev, nuevo]
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [user])

  // ─── Realtime: actualizar sidebar ───
  useEffect(() => {
    if (!user) return
    const sub = supabase
      .channel('chat-convs')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones' }, (payload: any) => {
        const updated = payload.new as any
        if (updated.user1_id !== user.id && updated.user2_id !== user.id) return
        setConversaciones(prev => {
          const idx = prev.findIndex(c => c.id === updated.id)
          if (idx < 0) return prev
          const arr = [...prev]
          arr[idx] = { ...arr[idx], ultimo_mensaje: updated.ultimo_mensaje, ultimo_mensaje_en: updated.ultimo_mensaje_en }
          return arr.sort((a, b) => (b.ultimo_mensaje_en || '').localeCompare(a.ultimo_mensaje_en || ''))
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [user])

  // ─── Seleccionar conversacion ───
  const seleccionarConv = async (id: string) => {
    setConvId(id)
    setShowMobileChat(true)
    // Marcar como leido via API server-side (evita RLS bloqueante)
    try {
      const resp = await fetch('/api/mensajes-leidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: id, destinatario_id: user!.id })
      })
      if (resp.ok) {
        // Señal al Header para refrescar badge
        bcRef.current?.postMessage({ action: 'refresh-unread' })
        localStorage.setItem('camperocasion_unread_refresh', Date.now().toString())
      }
    } catch (e) {
      console.error('Error marcando leidos:', e)
    }
    setConversaciones(prev => prev.map(c => c.id === id ? { ...c, no_leidos: 0 } : c))
    await loadMensajes(id)
  }

  // ─── Eliminar conversacion ───
  const eliminarConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('deleteConversation'))) return
    const response = await fetch('/api/eliminar-conversacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacionId: id }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      setToastMsg(result.error || 'No se pudo eliminar la conversación')
      setTimeout(() => setToastMsg(null), 4000)
      return
    }
    setConversaciones(prev => prev.filter(c => c.id !== id))
    if (convId === id) {
      setConvId(null)
      setShowMobileChat(false)
      setMensajes([])
    }
  }

  // ─── Enviar reseña comprador → vendedor ───
  const enviarResenaComprador = async () => {
    if (!convId || !user || enviandoResena || !productoOwnerId) return
    const conv = conversaciones.find(c => c.id === convId)
    if (!conv || !conv.producto_id) return

    setEnviandoResena(true)
    try {
      const resp = await fetch('/api/admin/enviar-resena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluador_id: user.id,
          evaluado_id: productoOwnerId,
          producto_id: conv.producto_id,
          puntuacion: ratingResena,
          comentario: comentarioResena.trim() || null,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        console.error('Error enviando reseña:', json)
        alert(t('reviewError') + (json.error || json._error || ''))
        setEnviandoResena(false)
        return
      }
      setMostrarResena(false)
      setYaDejoResena(true)
      setComentarioResena('')
      setRatingResena(5)
    } catch (e) {
      console.error('Error enviando reseña:', e)
      alert(t('connectionError'))
    }
    setEnviandoResena(false)
  }

  // ─── Enviar mensaje ───
  const enviarMensaje = async () => {
    const msg = texto.trim()
    if (!msg || !convId || !user || enviando) return
    setEnviando(true)

    // Get conversation to find recipient
    const conv = conversaciones.find(c => c.id === convId)
    if (!conv) { console.error('ChatPage: conversacion no encontrada', convId); setEnviando(false); return }
    const destinatarioId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id

    const response = await fetch('/api/enviar-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversacion_id: convId,
        destinatario_id: destinatarioId,
        contenido: msg,
      }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('Error enviando mensaje:', result.error)
      setToastMsg('Error al enviar: ' + (result.error || 'inténtalo de nuevo'))
      setTimeout(() => setToastMsg(null), 4000)
      setEnviando(false)
      return
    }

    setTexto('')
    await loadMensajes(convId)
    setEnviando(false)
  }

  // ─── Loading ───
  if (authLoading || !user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">💬 Mensajes</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[600px] md:h-auto flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-brand-primary rounded-full animate-spin mx-auto mb-3" />
            <p>Cargando mensajes...</p>
          </div>
        </div>
      </div>
    )
  }

  const filtradas = conversaciones.filter(c =>
    c.otro_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.producto_titulo?.toLowerCase() ?? '').includes(busqueda.toLowerCase())
  )
  const convActual = conversaciones.find(c => c.id === convId)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">💬 Mensajes</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row md:h-[600px] max-h-[calc(100dvh-140px)]">
          {/* ─── Sidebar ─── */}
          <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-100`}>
            <div className="p-3 border-b">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar conversacion..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-brand-accent outline-none transition"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConvs && conversaciones.length === 0 ? (
                <div className="p-4 space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <User size={48} className="text-gray-500 mb-3" />
                  <p className="text-gray-500 font-medium">{conversaciones.length === 0 ? 'No hay conversaciones' : 'Sin resultados'}</p>
                  <p className="text-sm text-gray-500 mt-1">Envia un mensaje a un vendedor desde cualquier producto</p>
                </div>
              ) : (
                filtradas.map(c => (
                  <div
                    key={c.id}
                    className={`group w-full flex items-start gap-3 p-3 border-b border-gray-50 transition text-left relative ${convId === c.id ? 'bg-blue-50 border-l-2 border-l-brand-primary' : 'bg-white hover:bg-gray-50'}`}
                  >
                    {/* Eliminar */}
                    <button
                      onClick={(e) => eliminarConv(c.id, e)}
                      className="absolute top-1 right-1 p-1 rounded text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                    {/* Contenido: zona clickeable solo nombre+avatar */}
                    <button
                      onClick={() => seleccionarConv(c.id)}
                      className="flex items-start gap-3 w-full cursor-pointer text-left"
                    >
                      <Avatar nombre={c.otro_nombre} fotoUrl={c.otro_foto} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-gray-800 text-sm truncate">{c.otro_nombre}</p>
                          {c.ultimo_mensaje_en && (
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatTime(c.ultimo_mensaje_en)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-0.5">{c.ultimo_mensaje || 'Sin mensajes'}</p>
                        {c.producto_titulo && c.producto_id && (
                          <a
                            href={`/producto/${c.producto_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-500 mt-0.5 inline-flex items-center gap-0.5 hover:underline max-w-[90%] truncate"
                            onClick={(e) => e.stopPropagation()}
                            title={t('viewProductNewTab')}
                          >
                            📦 {c.producto_titulo}
                          </a>
                        )}
                      </div>
                      {c.no_leidos > 0 && (
                        <span className="bg-brand-dark text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{c.no_leidos}</span>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── Chat ─── */}
          <div className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
            {!convId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="font-medium">Selecciona una conversacion</p>
                <p className="text-sm mt-1">O escribe a un vendedor desde un producto</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b bg-white">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1">
                    <ArrowLeft size={20} className="text-gray-600" />
                  </button>
                  {convActual && (
                    <>
                      <Avatar nombre={convActual.otro_nombre} fotoUrl={convActual.otro_foto} size="sm" />
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{convActual.otro_nombre}</p>
                        {convActual.producto_titulo && convActual.producto_id && (
                          <LocalLink
                            href={`/producto/${convActual.producto_id}`}
                            className="text-xs text-blue-600 truncate hover:underline flex items-center gap-0.5"
                          >
                            {convActual.producto_titulo}
                            <ExternalLink size={9} />
                          </LocalLink>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Mensajes */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
                  {mensajes.map(m => {
                    const esMio = m.remitente_id === user?.id
                    const isCompraExitosa = m.contenido?.includes('compra exitosa') || m.contenido?.includes('fue exitosa')
                    return (
                      <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                          esMio ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                        }`}>
                          <p className="text-sm break-words">{m.contenido}</p>
                          <p className={`text-[10px] mt-1 ${esMio ? 'text-blue-200' : 'text-gray-500'}`}>
                            {formatHora(m.creado_en)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {puedeResenar && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => setMostrarResena(true)}
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:brightness-105 transition shadow-lg flex items-center gap-2"
                      >
                        ⭐ Deja tu reseña al vendedor
                      </button>
                    </div>
                  )}
                  {enviando && (
                    <div className="flex justify-end">
                      <div className="bg-blue-200 text-blue-800 px-4 py-2.5 rounded-2xl rounded-br-sm text-sm">
                        Enviando...
                      </div>
                    </div>
                  )}
                  <div ref={mensajesEndRef} />
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 p-3 border-t bg-white">
                  <input
                    type="text"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje() } }}
                    placeholder={t('typeMessage')}
                    className="flex-1 border rounded-full px-4 py-2.5 text-sm outline-none focus:border-brand-accent transition disabled:opacity-50"
                    disabled={enviando}
                  />
                  <button
                    onClick={enviarMensaje}
                    disabled={!texto.trim() || enviando}
                    className="w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enviando ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>

                {/* ─── Modal reseña comprador ─── */}
                {mostrarResena && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="resena-titulo"
                    tabIndex={-1}
                    onKeyDown={(e) => { if (e.key === 'Escape') setMostrarResena(false) }}
                    onClick={() => setMostrarResena(false)}
                  >
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                      <h3 id="resena-titulo" className="text-lg font-bold text-gray-800 mb-1">⭐ Deja tu reseña</h3>
                      <p className="text-sm text-gray-500 mb-4">¿Cómo fue tu experiencia con {convActual?.otro_nombre}?</p>

                      {/* Estrellas */}
                      <div className="flex justify-center gap-1 mb-4">
                        {[1,2,3,4,5].map(i => (
                          <button key={i} type="button" onClick={() => setRatingResena(i)} className="transition hover:scale-110">
                            <Star size={32} className={i <= ratingResena ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} />
                          </button>
                        ))}
                      </div>

                      {/* Comentario */}
                      <textarea
                        value={comentarioResena}
                        onChange={e => setComentarioResena(e.target.value)}
                        maxLength={500}
                        placeholder={t('reviewPlaceholder')}
                        className="w-full border rounded-xl p-3 text-sm resize-none h-24 outline-none focus:border-brand-accent mb-4"
                      />
                      <p className="text-xs text-gray-500 text-right -mt-3 mb-4">{comentarioResena.length}/500</p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setMostrarResena(false)}
                          className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={enviarResenaComprador}
                          disabled={enviandoResena}
                          className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition disabled:opacity-50"
                        >
                          {enviandoResena ? t('sending') : t('sendReview')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
