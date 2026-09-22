'use client'

import { useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import {
  Store, Check, Loader2, ExternalLink, Copy, AlertTriangle, Globe,
} from 'lucide-react'
import { LIMITES_TIENDA, slugify, validarTienda, puedeTenerTienda } from '@/lib/tiendas'

/**
 * Pestaña «Mi tienda»: el escaparate del camperizador o profesional.
 *
 * El objetivo de negocio es que el vendedor recurrente tenga una URL propia
 * que pueda pegar en su web y en su Instagram. Por eso la dirección se enseña
 * en grande y con botón de copiar: es el activo que le damos a cambio de que
 * suba aquí su inventario.
 */
export default function TabTienda() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [noDisponible, setNoDisponible] = useState(false)
  const [puedeAbrir, setPuedeAbrir] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    web: '',
    horario: '',
    direccion: '',
    tienda_activa: false,
  })

  useEffect(() => {
    fetch('/api/tienda')
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok || !body?.ok) {
          if (body?.migracionPendiente) setNoDisponible(true)
          return
        }
        const t = body.tienda || {}
        setPuedeAbrir(Boolean(body.puedeAbrir))
        setForm({
          nombre: t.nombre || '',
          slug: t.slug || '',
          descripcion: t.descripcion || '',
          web: t.web || '',
          horario: t.horario || '',
          direccion: t.direccion || '',
          tienda_activa: Boolean(t.tienda_activa),
        })
      })
      .catch(() => setNoDisponible(true))
      .finally(() => setCargando(false))
  }, [])

  const set = (campo: string, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setMensaje('')
  }

  // Vista previa de la URL: el mismo slugify que usa la base, para que lo que
  // ve aquí sea exactamente la dirección que va a quedar publicada.
  const slugPrevio = slugify(form.slug || form.nombre)
  const urlPublica = `camperocasion.online/tienda/${slugPrevio || 'tu-tienda'}`

  const copiarEnlace = async () => {
    await navigator.clipboard.writeText(`https://${urlPublica}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const guardar = async () => {
    const errs = validarTienda({ ...form, slug: form.slug || null })
    setErrores(errs)
    if (Object.keys(errs).length > 0) return

    setGuardando(true)
    setMensaje('')
    try {
      const res = await fetch('/api/tienda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slug: form.slug || slugPrevio }),
      })
      const data = await res.json()
      if (data?.ok) {
        setForm(f => ({ ...f, slug: data.tienda?.slug || f.slug }))
        setMensaje('Tienda guardada correctamente.')
      } else {
        setMensaje(data?.error || 'No se pudo guardar.')
      }
    } catch {
      setMensaje('Error de conexión.')
    }
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
        <Loader2 className="animate-spin mx-auto mb-2" size={22} /> Cargando tu tienda…
      </div>
    )
  }

  if (noDisponible) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-3">
        <AlertTriangle className="text-amber-600 shrink-0" size={20} />
        <div>
          <p className="font-semibold text-amber-900">La tienda todavía no está activada</p>
          <p className="text-sm text-amber-800">
            Falta aplicar la migración <code>202609220002_tiendas_profesionales.sql</code> en la
            base de datos.
          </p>
        </div>
      </div>
    )
  }

  if (!puedeAbrir) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <Store size={36} className="mx-auto text-gray-300 mb-3" />
        <h3 className="font-bold text-gray-900 mb-1">La tienda es para vendedores profesionales</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
          Si eres camperizador o vendes vehículos de forma profesional, cambia tu tipo de vendedor
          en tu perfil y podrás abrir una página propia con todo tu stock.
        </p>
        <LocalLink
          href="/mi-perfil"
          className="inline-block bg-brand-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-brand-dark transition"
        >
          Ir a mi perfil
        </LocalLink>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estado y URL */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Store size={18} className="text-brand-accent" /> Mi tienda
            </h3>
            <p className="text-sm text-gray-500">
              Una página propia con tu logo, tu stock y tu dirección web.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span className="text-sm font-medium text-gray-700">
              {form.tienda_activa ? 'Publicada' : 'Oculta'}
            </span>
            <span className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.tienda_activa}
                onChange={e => set('tienda_activa', e.target.checked)}
              />
              <span className="block w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-brand-accent transition" />
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
            </span>
          </label>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            La dirección de tu tienda
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm md:text-base font-bold text-brand-primary break-all">
              {urlPublica}
            </code>
            <button
              onClick={copiarEnlace}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
            >
              {copiado ? <Check size={13} className="text-brand-accent" /> : <Copy size={13} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
            {form.tienda_activa && slugPrevio && (
              <LocalLink
                href={`/tienda/${slugPrevio}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
              >
                <ExternalLink size={13} /> Ver
              </LocalLink>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pégala en tu web o en la biografía de tu Instagram: lleva directo a todo tu stock.
          </p>
        </div>
      </div>

      {/* Datos */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <Campo
          etiqueta="Nombre de la tienda"
          error={errores.nombre}
          hint="Como quieres que te vean los compradores."
        >
          <input
            type="text"
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
            maxLength={120}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            placeholder="Furgocamper Valencia"
          />
        </Campo>

        <Campo
          etiqueta="Dirección web (slug)"
          error={errores.slug}
          hint="Solo letras, números y guiones. Si la cambias, los enlaces antiguos dejarán de funcionar."
        >
          <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand-accent/40">
            <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r border-gray-200 whitespace-nowrap">
              /tienda/
            </span>
            <input
              type="text"
              value={form.slug}
              onChange={e => set('slug', e.target.value)}
              maxLength={LIMITES_TIENDA.slugMax}
              className="flex-1 px-3 py-2.5 focus:outline-none min-w-0"
              placeholder={slugify(form.nombre) || 'mi-taller'}
            />
          </div>
        </Campo>

        <Campo
          etiqueta="Descripción"
          error={errores.descripcion}
          hint={`${form.descripcion.length}/${LIMITES_TIENDA.descripcion} caracteres. Cuenta desde cuándo trabajas, en qué te especializas y qué garantía ofreces.`}
        >
          <textarea
            value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            maxLength={LIMITES_TIENDA.descripcion}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            placeholder="Camperizamos furgonetas desde 2011 en Valencia. Homologación incluida y 2 años de garantía en la instalación eléctrica."
          />
        </Campo>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Campo etiqueta="Tu web" error={errores.web} hint="Opcional.">
            <div className="relative">
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.web}
                onChange={e => set('web', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                placeholder="furgocamper.es"
              />
            </div>
          </Campo>

          <Campo etiqueta="Horario" error={errores.horario} hint="Opcional.">
            <input
              type="text"
              value={form.horario}
              onChange={e => set('horario', e.target.value)}
              maxLength={LIMITES_TIENDA.horario}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              placeholder="L-V 9:00-14:00 y 16:00-19:00"
            />
          </Campo>
        </div>

        <Campo
          etiqueta="Dirección del taller"
          error={errores.direccion}
          hint="Opcional. Ayuda a que Google te muestre como negocio local."
        >
          <input
            type="text"
            value={form.direccion}
            onChange={e => set('direccion', e.target.value)}
            maxLength={LIMITES_TIENDA.direccion}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            placeholder="Pol. Ind. Norte, nave 12"
          />
        </Campo>

        {mensaje && (
          <p
            className={`text-sm rounded-xl p-3 ${
              mensaje.includes('correctamente')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {mensaje}
          </p>
        )}

        <button
          onClick={guardar}
          disabled={guardando}
          className="w-full sm:w-auto bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {guardando ? <><Loader2 size={17} className="animate-spin" /> Guardando…</> : 'Guardar tienda'}
        </button>
      </div>
    </div>
  )
}

function Campo({
  etiqueta,
  hint,
  error,
  children,
}: {
  etiqueta: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">{etiqueta}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      ) : null}
    </div>
  )
}
