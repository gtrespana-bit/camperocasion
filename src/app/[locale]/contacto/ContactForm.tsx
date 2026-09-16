'use client'

import { useState } from 'react'
import { Mail, MessageCircle, Phone, CheckCircle, AlertCircle, Send, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
const ASUNTOS = [
  'Pregunta general',
  'Reportar un anuncio',
  'Problema con mi cuenta',
  'Sugerencia',
  'Otro',
]

export default function ContactPage() {
  const t = useTranslations('contact')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [asunto, setAsunto] = useState(ASUNTOS[0])
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setEstado('idle')
    setErrorText('')

    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, asunto, mensaje }),
      })
      const data = await res.json()

      if (!res.ok) {
        setEstado('error')
        setErrorText(data.error || t('sendError'))
        return
      }

      setEstado('success')
      setNombre('')
      setEmail('')
      setAsunto(ASUNTOS[0])
      setMensaje('')
    } catch {
      setEstado('error')
      setErrorText(t('connectError'))
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'success') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md mx-auto text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('sent')}</h2>
          <p className="text-gray-500 mb-6">
            {t('sentDesc', { email })}
          </p>
          <button
            onClick={() => setEstado('idle')}
            className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition"
          >
            Enviar otro mensaje
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-black text-gray-800 mb-2 text-center">{t('title')}</h1>
      <p className="text-center text-gray-500 mb-10 max-w-lg mx-auto">
        {t('desc')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">{t('sendMessage')}</h2>

          {estado === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                placeholder={t('namePlaceholder')}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subject')}</label>
              <select
                value={asunto}
                onChange={e => setAsunto(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                {ASUNTOS.map(a => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('message')}</label>
              <textarea
                rows={5}
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                required
                placeholder={t('messagePlaceholder')}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {enviando ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enviar mensaje
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info de contacto */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4">{t('otherContact')}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Email</p>
                  <p className="text-sm text-gray-500">soporte@camperocasion.es</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">WhatsApp / Telegram</p>
                  <p className="text-sm text-gray-500">@CamperOcasión</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-accent/20 rounded-lg flex items-center justify-center text-brand-accent">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Teléfono</p>
                  <p className="text-sm text-gray-500">+58 412 XXX XXXX</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-accent rounded-2xl p-6 text-center">
            <h3 className="font-bold text-brand-primary text-lg">{t('schedule')}</h3>
            <p className="text-brand-primary/80 mt-2">
              Lunes a sábado<br />
              8:00 AM – 10:00 PM (hora España)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
