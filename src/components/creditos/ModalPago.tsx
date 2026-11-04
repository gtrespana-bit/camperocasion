'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle, X, Upload, Loader2, CreditCard } from 'lucide-react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { supabase } from '@/lib/supabase'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'

export interface MetodoPago {
  id: string
  nombre: string
  emoji: string
  instrucciones: Record<string, string>
}

export default function ModalPago({
  paquete,
  metodos,
  configurado,
  stripeDisponible,
  onClose,
  onCompraExitosa,
}: {
  paquete: any
  metodos: MetodoPago[]
  configurado: Record<string, boolean> | null
  stripeDisponible: boolean
  onClose: () => void
  onCompraExitosa?: () => void
}) {
  const t = useTranslations('creditos')
  const locale = useLocale()
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    dialogRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      )).filter(element => element.getClientRects().length > 0)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])
  const [metodo, setMetodo] = useState('')
  const [yendoAStripe, setYendoAStripe] = useState(false)
  const [errorStripe, setErrorStripe] = useState('')

  /**
   * Pago inmediato con Stripe (tarjeta o Bizum). No se sube comprobante ni hay
   * espera: el webhook acredita los créditos en cuanto Stripe confirma el
   * cobro, así que el usuario vuelve con el saldo ya sumado.
   */
  const pagarConStripe = async () => {
    setErrorStripe('')
    setYendoAStripe(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`${locale === 'en' ? '/en' : ''}/login?redirect=/creditos`); return }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditos: paquete.creditos, locale }),
      })
      const data = await res.json()
      if (data?.ok && data.url) {
        window.location.href = data.url
        return
      }
      setErrorStripe(locale === 'en' ? t('stripeError') : (data?.error || t('stripeError')))
    } catch {
      setErrorStripe(t('stripeConnectionError'))
    }
    setYendoAStripe(false)
  }
  const [copiado, setCopiado] = useState('')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  useEffect(() => {
    return () => { if (comprobantePreview.startsWith('blob:')) URL.revokeObjectURL(comprobantePreview) }
  }, [comprobantePreview])
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  useEffect(() => { if (enviado) dialogRef.current?.focus() }, [enviado])

  const selectedMetodo = metodos.find(m => m.id === metodo)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiado(label)
    setTimeout(() => setCopiado(''), 2000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setPaymentError(t('imageOnly')); return }
    if (file.size > 5 * 1024 * 1024) { setPaymentError(t('maxImageSize')); return }
    setPaymentError('')
    setComprobanteFile(file)
    setComprobantePreview(URL.createObjectURL(file))
  }

  const procesarCompra = async () => {
    if (!metodo) { setPaymentError(t('choosePaymentError')); return }
    if (!comprobanteFile) { setPaymentError(t('receiptRequired')); return }

    setPaymentError('')
    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`${locale === 'en' ? '/en' : ''}/login?redirect=/creditos`); return }

      const fileExt = comprobanteFile.name.split('.').pop()
      const fileName = `${user.id}/comprobante_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(fileName, comprobanteFile, { contentType: comprobanteFile.type })
      if (uploadError) { setPaymentError(t('uploadError') + uploadError.message); setEnviando(false); return }

      const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(fileName)

      const res = await fetch('/api/comprar-creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditos: paquete.creditos,
          metodoPago: selectedMetodo?.nombre || metodo,
          comprobanteUrl: publicUrl,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setEnviado(true)
        onCompraExitosa?.()
      } else {
        setPaymentError(locale === 'en' ? t('processingError') : (data.error || t('processingError')))
      }
    } catch (err: any) {
      setPaymentError(err.message || t('processingError'))
    }
    setEnviando(false)
  }

  if (enviado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="credit-payment-success" tabIndex={-1} className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-brand-accent" />
          </div>
          <h3 id="credit-payment-success" className="text-xl font-bold text-brand-primary mb-2">{t('receiptSent')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t.rich('receiptDesc', {
              count: paquete.creditos,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <button onClick={onClose} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition">{t('closeBtn')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="credit-payment-title" tabIndex={-1} className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 id="credit-payment-title" className="text-lg font-bold text-gray-900">{paquete.creditos} {t('credits')} — {formatPrecio(paquete.precio)}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('closeBtn')} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {paymentError && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{paymentError}</p>}
          {/* Pago inmediato con Stripe (tarjeta o Bizum) */}
          {stripeDisponible && (
            <div className="rounded-xl border-2 border-brand-accent bg-green-50/60 p-5">
              <div className="flex items-start gap-3 mb-3">
                <CreditCard size={22} className="text-brand-accent flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900">{t('payNowTitle')}</h4>
                  <p className="text-sm text-gray-600">
                    {t('payNowDesc')}
                  </p>
                </div>
              </div>
              {errorStripe && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                  {errorStripe}
                </p>
              )}
              <button
                onClick={pagarConStripe}
                disabled={yendoAStripe}
                className="w-full bg-brand-accent text-white py-3 rounded-xl font-bold hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {yendoAStripe
                  ? <><Loader2 size={18} className="animate-spin" /> {t('connectingStripe')}</>
                  : <>{t('payNowButton', { price: formatPrecio(paquete.precio) })}</>}
              </button>
              <p className="text-[11px] text-gray-500 text-center mt-2">
                {t('stripeSecure')}
              </p>
            </div>
          )}

          {stripeDisponible && metodos.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400 font-medium">{t('orPayManually')}</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
          )}

          {/* Método de pago */}
          <div>
            <h4 className="font-bold text-gray-800 mb-3">{t('choosePayment')}</h4>
            {configurado && metodos.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                {t('paymentUnavailable')}{' '}
                <LocalLink href="/contacto" className="font-semibold underline">{t('contactUs')}</LocalLink>.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {metodos.map(m => (
                <button key={m.id} onClick={() => setMetodo(m.id)}
                  className={`p-4 rounded-xl border-2 text-center transition ${metodo === m.id ? 'border-brand-accent bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-3xl block">{m.emoji}</span>
                  <span className="text-sm font-medium text-gray-700 mt-1 block">{m.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monto a pagar */}
          <div className="bg-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1 text-center">{t('amountPay')}</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-3xl font-black text-brand-primary">{formatPrecio(paquete.precio)}</p>
              <button
                onClick={() => copyToClipboard(String(paquete.precio), 'precio')}
                className="flex items-center gap-1 bg-white border border-brand-primary/30 rounded-lg px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 transition"
              >
                {copiado === 'precio' ? '✓' : t('copy')}
              </button>
            </div>
          </div>

          {/* Datos de pago */}
          {selectedMetodo && Object.keys(selectedMetodo.instrucciones).length > 0 && (
            <div>
              <h4 className="font-bold text-gray-800 mb-3">{t('paymentData')}</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {Object.entries(selectedMetodo.instrucciones).map(([key, value]) => {
                  const labelMap: Record<string, string> = {
                    telefono: t('phone'),
                    iban: 'IBAN',
                    banco: t('bank'),
                    receptor: t('holder'),
                    titular: t('holder'),
                    email: 'PayPal (email)',
                  }
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500">{labelMap[key] || key}</span>
                        <p className="text-sm font-medium text-gray-800">{value}</p>
                      </div>
                      <button onClick={() => copyToClipboard(value, key)} className="text-xs bg-white border rounded-md px-2 py-1 hover:bg-gray-100 transition ml-2">
                        {copiado === key ? t('copied') : t('copy')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Comprobante */}
          {selectedMetodo && (
            <div>
              <h4 className="font-bold text-gray-800 mb-3">{t('uploadReceipt')}</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-primary transition">
                <input type="file" accept="image/*" id="comprobante-input" onChange={handleFileChange} className="hidden" />
                {comprobantePreview ? (
                  <div>
                    <Image src={comprobantePreview} alt="Comprobante" className="max-h-48 mx-auto rounded-lg mb-3" width={400} height={300} unoptimized />
                    <button onClick={(e) => { e.stopPropagation(); setComprobanteFile(null); setComprobantePreview('') }} className="text-sm text-red-500 hover:underline">{t('removeImage')}</button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => document.getElementById('comprobante-input')?.click()} className="w-full focus-visible:outline-2 focus-visible:outline-brand-accent">
                      <Upload size={32} className="mx-auto text-gray-500 mb-2" aria-hidden="true" />
                      <span className="block text-sm text-gray-700 font-semibold">{t('tapUpload')}</span>
                      <span className="block text-xs text-gray-500 mt-1">{t('maxFile')}</span>
                    </button>
                  </>
                )}
              </div>
              <button onClick={procesarCompra} disabled={enviando || !comprobanteFile}
                className="w-full mt-4 bg-brand-primary text-white py-3.5 rounded-xl font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? <><Loader2 size={18} className="animate-spin" /> {t('sending')}</> : <><Upload size={18} /> {t('sendReceipt')}</>}
              </button>
            </div>
          )}

          {!metodo && (
            <div className="text-center py-4 text-sm text-gray-500">
              {t('selectPayment')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
