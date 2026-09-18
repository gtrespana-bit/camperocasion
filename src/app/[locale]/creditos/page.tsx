'use client'

import LocalLink from '@/components/LocalLink'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, Zap, Star, X, Copy, Upload, Loader2, Banknote, Landmark, Wallet
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { PAQUETES_CREDITO } from '@/lib/creditos'
import { formatPrecioObligatorio as formatPrecio } from '@/lib/precio'

const paquetesCredito = PAQUETES_CREDITO

interface MetodoPago {
  id: string
  nombre: string
  emoji: string
  icono: 'banknote' | 'landmark' | 'wallet'
  instrucciones: Record<string, string>
}

// Los datos bancarios llegan del servidor (/api/datos-pago).
let metodosPago: MetodoPago[] = [
  {
    id: 'bizum',
    nombre: 'Bizum',
    emoji: '📱',
    icono: 'banknote',
    instrucciones: {},
  },
  {
    id: 'transferencia',
    nombre: 'Transferencia',
    emoji: '🏦',
    icono: 'landmark',
    instrucciones: {},
  },
  {
    id: 'paypal',
    nombre: 'PayPal',
    emoji: '💙',
    icono: 'wallet',
    instrucciones: {},
  },
]

function ModalPago({
  paquete,
  metodos,
  configurado,
  onClose,
}: {
  paquete: any
  metodos: MetodoPago[]
  configurado: Record<string, boolean> | null
  onClose: () => void
}) {
  const t = useTranslations('creditos')
  const router = useRouter()
  const [metodo, setMetodo] = useState('')
  const [copiado, setCopiado] = useState('')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const selectedMetodo = metodos.find(m => m.id === metodo)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiado(label)
    setTimeout(() => setCopiado(''), 2000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setComprobanteFile(file)
    setComprobantePreview(URL.createObjectURL(file))
  }

  const procesarCompra = async () => {
    if (!metodo) { alert('Selecciona un método de pago'); return }
    if (!comprobanteFile) { alert('Sube el comprobante'); return }

    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/login?redirect=/creditos`); return }

      const fileExt = comprobanteFile.name.split('.').pop()
      const fileName = `${user.id}/comprobante_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(fileName, comprobanteFile, { contentType: comprobanteFile.type })
      if (uploadError) { alert('Error subiendo: ' + uploadError.message); setEnviando(false); return }

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
      } else {
        alert('Error: ' + (data.error || 'Error procesando'))
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Error desconocido'))
    }
    setEnviando(false)
  }

  if (enviado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
        <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-brand-accent" />
          </div>
          <h3 className="text-xl font-bold text-brand-primary mb-2">{t('receiptSent')}</h3>
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
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{paquete.creditos} {t('credits')} — {formatPrecio(paquete.precio)}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Método de pago */}
          <div>
            <h4 className="font-bold text-gray-800 mb-3">{t('choosePayment')}</h4>
            {configurado && metodos.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                Estamos terminando de configurar los pagos con Bizum, transferencia y PayPal.
                Escríbenos y te damos los datos para comprar créditos ahora mismo:{' '}
                <LocalLink href="/contacto" className="font-semibold underline">contacto</LocalLink>.
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
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-primary transition cursor-pointer"
                onClick={() => document.getElementById('comprobante-input')?.click()}>
                <input type="file" accept="image/*" id="comprobante-input" onChange={handleFileChange} className="hidden" />
                {comprobantePreview ? (
                  <div>
                    <Image src={comprobantePreview} alt="Comprobante" className="max-h-48 mx-auto rounded-lg mb-3" width={400} height={300} unoptimized />
                    <button onClick={(e) => { e.stopPropagation(); setComprobanteFile(null); setComprobantePreview('') }} className="text-sm text-red-500 hover:underline">{t('removeImage')}</button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500">{t('tapUpload')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('maxFile')}</p>
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

export default function CreditosPage() {
  const t = useTranslations('creditos')
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<any>(null)
  // Métodos de pago con datos REALES del servidor. Si una variable de entorno
  // falta, ese método no se ofrece: antes la web mostraba un IBAN y un Bizum de
  // ejemplo (dineros a una cuenta inexistente) porque el endpoint rellenaba los
  // huecos con valores ficticios.
  const [metodos, setMetodos] = useState<MetodoPago[]>(metodosPago)
  const [configurado, setConfigurado] = useState<Record<string, boolean> | null>(null)

  // Cargar datos de pago reales del servidor (IBAN, teléfono Bizum, PayPal…)
  useEffect(() => {
    fetch('/api/datos-pago')
      .then(r => r.json())
      .then(d => {
        const conDatos = metodosPago
          .map(m => (d?.[m.id] && typeof d[m.id] === 'object' ? { ...m, instrucciones: d[m.id] } : m))
          .filter(m => (d?.configurado ? d.configurado[m.id] !== false : true))
        setMetodos(conDatos)
        setConfigurado(d?.configurado ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-4">{t('title1')} <span className="text-brand-accent">{t('title2')}</span></h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          {t.rich('subtitle', { strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('whatFor')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-50 text-brand-accent"><Zap size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('boostTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t.rich('boostDesc', { strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
                <span className="text-brand-primary font-bold text-2xl">{t('boostPrice')}</span>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-brand-primary"><Star size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('featureTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t.rich('featureDesc', { strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
                <div className="space-y-1 text-sm">
                  <p className="text-brand-primary font-bold">4 créditos → 12h</p>
                  <p className="text-brand-primary font-bold">6 créditos → 24h</p>
                  <p className="text-brand-primary font-bold">10 créditos → 48h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Paquetes */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">{t('choosePackage')}</h2>
        <p className="text-center text-sm text-gray-500 mb-4">{t('eurNote')}</p>

        <div className="creditos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {paquetesCredito.map((pkg) => {
            const porCredito = pkg.precio / pkg.creditos
            return (
              <div key={pkg.creditos} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${pkg.popular ? 'border-brand-accent' : 'border-transparent'}`}>
                {pkg.popular && <div className="bg-brand-accent text-white text-center py-1.5 text-xs font-bold">{t('mostPopular')}</div>}
                <div className="bg-gradient-to-br from-brand-primary to-brand-dark p-6 text-white text-center">
                  <p className="text-5xl font-black">{pkg.creditos}</p>
                  <p className="text-sm opacity-80">{t('credits')}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-black text-gray-800 mb-1">{formatPrecio(pkg.precio)}</p>
                  <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">{formatPrecio(porCredito)} {t('perCredit')}</p>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" /><strong>{pkg.creditos}</strong> {t('boosts')}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('orFeatured', { count: Math.floor(pkg.creditos / 4) })}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('noExpiration')}</li>
                  </ul>
                  <button onClick={() => setPaqueteSeleccionado(pkg)} className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition cursor-pointer">{t('buy')}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métodos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('paymentMethods')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { nombre: 'Bizum', emoji: '📱', Icono: Banknote },
            { nombre: 'Transferencia', emoji: '🏦', Icono: Landmark },
            { nombre: 'PayPal', emoji: '💙', Icono: Wallet },
          ].map((m) => (
            <div key={m.nombre} className="rounded-xl p-4 text-center bg-gray-50">
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <h3 className="font-bold text-brand-primary text-sm mb-2">{t('howItWorks')}</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>
        </div>
      </div>

      {paqueteSeleccionado && (
        <ModalPago
          paquete={paqueteSeleccionado}
          metodos={metodos}
          configurado={configurado}
          onClose={() => setPaqueteSeleccionado(null)}
        />
      )}
    </div>
  )
}
