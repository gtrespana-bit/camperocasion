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
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
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

  const conversationParam = searchParams?.get('conversation')
  const openedLinkRef = useRef('')
  // No cachear conversaciones sin aislarlas por usuario: filtra datos al cambiar de cuenta.
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const loadingRef = useRef(false)
  const [busqueda, setBusqueda] = useState('')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [reabrirChat, setReabrirChat] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)

  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const userRef = useRef(user)
  const authIdRef = useRef(user?.id)
  const convIdRef = useRef(convId)
  userRef.current = user
  if (authIdRef.current !== user?.id) {
    authIdRef.current = user?.id
    openedLinkRef.current = ''
  }
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

  // ─── Auto-scroll + focus input when conversation opens ───
  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes])

  // Focus input automatically when a conversation is selected / opened
  useEffect(() => {
    if (convId) {
      const tm = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(tm)
    }
  }, [convId])

  // Scroll instantly when conversation changes so input is visible immediately
  useEffect(() => {
    if (convId && chatContainerRef.current) {
      // instant scroll, then smooth will take over for new messages
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [convId])

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

    if (userRef.current?.id !== uid) return
    setConversaciones(enriched)
    const linkKey = `${uid}:${conversationParam || ''}:${productoId || ''}:${vendedorId || ''}`
    if (openedLinkRef.current === linkKey) return
    openedLinkRef.current = linkKey
    if (conversationParam) {
      const requested = enriched.find(c => c.id === conversationParam)
      if (requested) {
        setMensajes([])
        setConvId(requested.id)
        setShowMobileChat(true)
      }
      return
    }

    // If URL has producto_id + vendedor_id, try to find or create conv
    if (productoId && vendedorId && vendedorId !== uid) {
      // La API decide el destinatario actual, también si existía un chat ficticio.
      try {
        const response = await fetch('/api/crear-conversacion', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendedorId, productoId }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result?.id) {
          setToastMsg(result.error || 'No se pudo abrir la conversación')
          openedLinkRef.current = ''
          return
        }
        const recipientId = result.user1_id === uid ? result.user2_id : result.user1_id
        if (!perfilMap.has(recipientId)) {
          const resp = await fetch(`/api/user-bulk?ids=${encodeURIComponent(recipientId)}`)
          const data = await resp.json()
          for (const p of data.profiles || []) {
            perfilMap.set(p.id, { nombre: p.nombre || 'Usuario', foto: p.foto_perfil_url || null, email: null })
          }
        }
        if (userRef.current?.id !== uid) return
        const perfil = perfilMap.get(recipientId)
        setConversaciones(prev => [{
          ...result,
          otro_nombre: perfil?.nombre || 'Usuario',
          otro_foto: perfil?.foto || null,
          otro_email: null,
          producto_titulo: prodMap.get(productoId) || null,
          no_leidos: 0,
        }, ...prev.filter(c => c.id !== result.id)])
        setConvId(result.id)
        setShowMobileChat(true)
      } catch {
        openedLinkRef.current = ''
        setToastMsg('No hay conexión. Vuelve a intentarlo.')
      }
    }
  }, [productoId, vendedorId, conversationParam])

  useEffect(() => {
    setConversaciones([])
    setMensajes([])
    setConvId(null)
    setReabrirChat(null)
    setToastMsg(null)
    setTexto('')
  }, [user?.id])

  // Load once
  useEffect(() => {
    if (authLoading || !user) return
    loadingRef.current = true
    setLoadingConvs(true)
    loadConversaciones().catch(() => { openedLinkRef.current = ''; setToastMsg('No se pudieron cargar las conversaciones') }).finally(() => { loadingRef.current = false; setLoadingConvs(false) })
  }, [user, authLoading, loadConversaciones])

  // ─── Cargar mensajes ───
  const loadMensajes = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('mensajes')
      .select('id, remitente_id, destinatario_id, contenido, leido, creado_en, conversacion_id')
      .eq('conversacion_id', id)
      .order('creado_en', { ascending: true })

    if (error) { console.error('Error loading msgs:', error); return }
    if (convIdRef.current !== id) return
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

  // También INSERT: una conversación nueva debe aparecer sin recargar la página.
  useEffect(() => {
    if (!user) return
    const sub = supabase.channel('chat-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        loadConversaciones().catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [user, loadConversaciones])

  // Deep links y mensajes recibidos con el chat abierto también cuentan como leídos.
  useEffect(() => {
    if (!convId || !user) return
    fetch('/api/mensajes-leidos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacion_id: convId }),
    }).then(r => {
      if (!r.ok) return
      setConversaciones(prev => prev.map(c => c.id === convId ? { ...c, no_leidos: 0 } : c))
      bcRef.current?.postMessage({ action: 'refresh-unread' })
    }).catch(() => {})
  }, [convId, user, mensajes.length])

  // ─── Seleccionar conversacion ───
  const seleccionarConv = async (id: string) => {
    setConvId(id)
    setMensajes([])
    setReabrirChat(null)
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

    try {
      const response = await fetch('/api/enviar-mensaje', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: convId, destinatario_id: destinatarioId, contenido: msg }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.code === 'CONVERSACION_SEMILLA_CERRADA') setReabrirChat(result.reabrir)
        setToastMsg(result.error || 'No se pudo enviar. Inténtalo de nuevo.')
        return
      }
      setTexto('')
      await loadMensajes(convId)
      // keep focus on input after sending
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch {
      setToastMsg('No hay conexión. Tu mensaje no se ha borrado; puedes reintentarlo.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Loading ───
  if (authLoading || !user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-3 md:gap-4 h-[calc(100dvh-56px-4rem)] md:h-[calc(100dvh-100px)] md:max-h-[820px]">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 shrink-0 tracking-tight">💬 Mensajes</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 min-h-0 flex items-center justify-center">
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
    <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-3 h-[calc(100dvh-56px-4rem)] md:h-[calc(100dvh-100px)] md:max-h-[820px]">
      {toastMsg && (
        <div role="alert" className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-center justify-between">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="ml-3 underline font-medium shrink-0">Cerrar</button>
        </div>
      )}
      {reabrirChat && (
        <div className="shrink-0 rounded-xl border bg-gray-50 p-3 text-sm">
          El historial se conserva aquí. Las nuevas consultas las atiende CamperOcasión.
          <LocalLink href={reabrirChat} className="ml-2 font-semibold underline">Abrir chat con el equipo</LocalLink>
        </div>
      )}
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 shrink-0 tracking-tight">💬 Mensajes</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* ─── Sidebar ─── */}
          <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-100 min-h-0 bg-white`}>
            <div className="p-3 border-b shrink-0 bg-white">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar conversacion..."
                  className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
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
                <div className="flex flex-col items-center justify-center h-full px-6 text-center py-12">
                  <User size={48} className="text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium">{conversaciones.length === 0 ? 'No hay conversaciones' : 'Sin resultados'}</p>
                  <p className="text-sm text-gray-400 mt-1">Envia un mensaje a un vendedor desde cualquier producto</p>
                </div>
              ) : (
                filtradas.map(c => (
                  <div
                    key={c.id}
                    className={`group w-full flex items-start gap-3 p-3 border-b border-gray-50 transition text-left relative ${convId === c.id ? 'bg-blue-50 border-l-2 border-l-brand-primary' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <button
                      onClick={(e) => eliminarConv(c.id, e)}
                      className="absolute top-1 right-1 p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => seleccionarConv(c.id)}
                      className="flex items-start gap-3 w-full cursor-pointer text-left"
                    >
                      <Avatar nombre={c.otro_nombre} fotoUrl={c.otro_foto} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-gray-800 text-sm truncate">{c.otro_nombre}</p>
                          {c.ultimo_mensaje_en && (
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatTime(c.ultimo_mensaje_en)}</span>
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
          <div className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-h-0 bg-[#f8fafc]`}>
            {!convId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                <div className="w-20 h-20 bg-white border border-gray-100 shadow-sm rounded-full flex items-center justify-center mb-4">
                  <svg width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="font-semibold text-gray-700">Selecciona una conversacion</p>
                <p className="text-sm mt-1 text-gray-400 text-center">O escribe a un vendedor desde un producto</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 p-3 md:p-4 border-b bg-white shrink-0">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={20} className="text-gray-600" />
                  </button>
                  {convActual && (
                    <>
                      <Avatar nombre={convActual.otro_nombre} fotoUrl={convActual.otro_foto} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">{convActual.otro_nombre}</p>
                        {convActual.producto_titulo && convActual.producto_id && (
                          <LocalLink
                            href={`/producto/${convActual.producto_id}`}
                            className="text-xs text-blue-600 truncate hover:underline flex items-center gap-0.5"
                          >
                            <span className="truncate">{convActual.producto_titulo}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </LocalLink>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Mensajes - flex-1 scrollable */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-[#f8fafc] min-h-0">
                  {mensajes.map(m => {
                    const esMio = m.remitente_id === user?.id
                    return (
                      <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl shadow-sm ${
                          esMio ? 'bg-brand-primary text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                        }`}>
                          <p className="text-[14px] leading-[1.4] break-words whitespace-pre-wrap">{m.contenido}</p>
                          <p className={`text-[10px] mt-1 ${esMio ? 'text-blue-100' : 'text-gray-400'}`}>
                            {formatHora(m.creado_en)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {puedeResenar && (
                    <div className="flex justify-center pt-2">
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
                      <div className="bg-blue-100 text-blue-800 px-4 py-2.5 rounded-2xl rounded-br-md text-sm">
                        Enviando...
                      </div>
                    </div>
                  )}
                  <div ref={mensajesEndRef} />
                </div>

                {/* Input - ALWAYS VISIBLE, shrink-0, prominent */}
                <div className="shrink-0 border-t bg-white p-3 md:p-3.5 flex items-end gap-2 md:gap-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)] z-10">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje() } }}
                      placeholder={t('typeMessage')}
                      className="w-full border border-gray-200 rounded-2xl md:rounded-full px-4 py-3 pr-4 text-[15px] outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition bg-gray-50 focus:bg-white disabled:opacity-50 placeholder:text-gray-400"
                      disabled={enviando}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={enviarMensaje}
                    disabled={!texto.trim() || enviando}
                    className="w-12 h-12 md:w-11 md:h-11 bg-brand-primary text-white rounded-full flex items-center justify-center hover:bg-brand-dark active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md"
                    aria-label="Enviar mensaje"
                  >
                    {enviando ? (
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={20} className="ml-[1px]" />
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

                      <div className="flex justify-center gap-1 mb-4">
                        {[1,2,3,4,5].map(i => (
                          <button key={i} type="button" onClick={() => setRatingResena(i)} className="transition hover:scale-110">
                            <Star size={32} className={i <= ratingResena ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={comentarioResena}
                        onChange={e => setComentarioResena(e.target.value)}
                        maxLength={500}
                        placeholder={t('reviewPlaceholder')}
                        className="w-full border rounded-xl p-3 text-sm resize-none h-24 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 mb-4"
                      />
                      <p className="text-xs text-gray-400 text-right -mt-3 mb-4">{comentarioResena.length}/500</p>

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
