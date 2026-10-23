'use client'

/**
 * Importación de stock desde CSV (plan Profesional).
 *
 * Es la función que hace que un compraventa con 14 furgonetas pueda pasar de
 * Excel a publicado en dos minutos. Por eso la vista previa es obligatoria:
 * primero se enseña exactamente qué se va a crear, qué filas fallan y por qué,
 * y solo entonces se escribe en la base de datos.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Lock,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { plantillaCsv } from '@/lib/importar-csv'

type Fila = {
  linea: number
  titulo: string
  precio: number | null
  subcategoria: string | null
  ubicacion_estado: string | null
  ubicacion_ciudad: string | null
  imagenes: string[]
  errores: string[]
  avisos: string[]
}

type Previa = {
  ok: boolean
  previa: true
  total: number
  validas: number
  invalidas: number
  recortadas: number
  importables: number
  sinCupo: number
  restantes: number | null
  cupo: number | null
  fotosMax: number
  desconocidas: string[]
  filas: Fila[]
}

type Resultado = {
  ok: boolean
  previa: false
  importados: number
  omitidos: number
  sinCupo: number
  invalidas: number
  restantes: number | null
  errores: { linea: number; error: string }[]
  avisos: string[]
  anuncios: { id: string; slug: string; titulo: string }[]
}

export default function TabImportar() {
  const [plan, setPlan] = useState<string | null>(null)
  const [cargandoPlan, setCargandoPlan] = useState(true)

  const [texto, setTexto] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [importando, setImportando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/planes/estado', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setPlan(d.plan)
      })
      .catch(() => {})
      .finally(() => setCargandoPlan(false))
  }, [])

  const permitido = plan === 'plus'

  const analizar = useCallback(async () => {
    setError('')
    setResultado(null)
    setPrevia(null)
    setAnalizando(true)
    try {
      const res = await fetch('/api/productos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: texto }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo analizar el archivo.')
        return
      }
      setPrevia(data)
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setAnalizando(false)
    }
  }, [texto])

  async function importar() {
    setError('')
    setImportando(true)
    try {
      const res = await fetch('/api/productos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: texto, confirmar: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo importar.')
        return
      }
      setResultado(data)
      setPrevia(null)
      setTexto('')
      setNombreArchivo('')
      // La franja del plan y la lista de anuncios se actualizan sin recargar.
      window.dispatchEvent(new Event('plan-actualizado'))
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.')
    } finally {
      setImportando(false)
    }
  }

  function leerArchivo(file: File) {
    setError('')
    setPrevia(null)
    setResultado(null)
    if (file.size > 300_000) {
      setError('El archivo supera los 300 KB. Divídelo en varios.')
      return
    }
    const lector = new FileReader()
    lector.onload = () => {
      setTexto(String(lector.result || ''))
      setNombreArchivo(file.name)
    }
    lector.onerror = () => setError('No se pudo leer el archivo.')
    lector.readAsText(file, 'utf-8')
  }

  function descargarPlantilla() {
    const blob = new Blob(['\uFEFF' + plantillaCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-camperocasion.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarInforme(r: Resultado) {
    if (!r.anuncios?.length) return
    const csv = ['Titulo;Slug', ...r.anuncios.map((a) => `"${a.titulo.replace(/"/g, '""')}";${a.slug}`)].join(
      '\r\n',
    )
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `importados-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (cargandoPlan) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Cargando…
      </div>
    )
  }

  if (!permitido) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <FileSpreadsheet size={20} className="text-brand-primary" /> Importar stock desde CSV
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Sube tu Excel o el export de tu DMS y publica todo el stock de una vez. Revisa una
            vista previa antes de crear nada: verás qué filas están bien, cuáles fallan y por qué.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg bg-white p-1.5 text-slate-400 shadow-sm">
                <Lock size={16} />
              </span>
              <div>
                <p className="font-bold text-slate-800">Disponible en el plan Profesional</p>
                <p className="mt-1 text-sm text-slate-600">
                  Con 15 anuncios activos, subir el stock a mano son 15 formularios. La importación
                  desde CSV los publica de una vez, con vista previa y errores por línea.
                </p>
                <LocalLink
                  href="/para-profesionales"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
                >
                  Ver Profesional, 19 €/mes <ArrowRight size={14} />
                </LocalLink>
              </div>
            </div>
          </div>
        </div>

        {/* Aun sin plan, la plantilla es pública: así se ve el formato exacto. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-bold text-slate-800">El formato que acepta</p>
          <p className="mt-1 text-sm text-slate-600">
            Doce columnas, separadas por punto y coma o coma. Solo son obligatorias el título, el
            precio, el tipo y la comunidad.
          </p>
          <button
            type="button"
            onClick={descargarPlantilla}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Descargar plantilla
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <FileSpreadsheet size={20} className="text-brand-primary" /> Importar stock
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Publica todo tu stock de una vez. Primero verás una vista previa; nada se crea hasta que
            confirmes.
          </p>
        </div>
        <button
          type="button"
          onClick={descargarPlantilla}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download size={14} /> Plantilla
        </button>
      </div>

      {/* Entrada */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <UploadCloud size={15} /> Elegir archivo .csv
          </button>
          <span className="text-xs text-slate-500">
            {nombreArchivo || 'o pega el contenido abajo'}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) leerArchivo(f)
              e.currentTarget.value = ''
            }}
          />
        </div>

        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setPrevia(null)
            setResultado(null)
            setError('')
          }}
          rows={8}
          spellCheck={false}
          placeholder={'Titulo;Precio;Tipo;Comunidad;Ciudad;Marca;Modelo;Estado;Año;Kilómetros;Fotos;Descripción\nFiat Ducato L3H2;38500;Gran Volumen;Comunitat Valenciana;Valencia;Fiat;Ducato;Como nuevo;2019;145000;https://…jpg;Camper 4 plazas'}
          className="mt-3 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs text-slate-800 outline-none focus:border-brand-primary"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analizar}
            disabled={!texto.trim() || analizando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {analizando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Analizar sin publicar
          </button>
          <span className="text-xs text-slate-500">
            No se actualizan anuncios existentes: cada fila es un anuncio nuevo.
          </span>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="flex items-center gap-2 font-bold text-emerald-900">
            <CheckCircle2 size={18} /> {resultado.importados} anuncio
            {resultado.importados === 1 ? '' : 's'} publicado
            {resultado.importados === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {resultado.omitidos > 0
              ? `${resultado.omitidos} fila(s) no se han importado.`
              : 'Todas las filas del archivo se han importado.'}
            {resultado.restantes != null && ` Te quedan ${resultado.restantes} huecos de cupo.`}
          </p>
          {resultado.sinCupo > 0 && (
            <p className="mt-2 text-sm text-amber-800">
              {resultado.sinCupo} anuncio(s) válidos no caben en tu plan.{' '}
              <LocalLink href="/para-profesionales" className="font-semibold underline">
                Hazte Profesional
              </LocalLink>{' '}
              y vuelve a subir solo esas filas.
            </p>
          )}
          {resultado.errores?.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-800">
              {resultado.errores.map((e) => (
                <li key={`${e.linea}-${e.error}`}>
                  Línea {e.linea}: {e.error}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <LocalLink
              href="/dashboard?tab=productos"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Ver mis anuncios <ArrowRight size={14} />
            </LocalLink>
            <button
              type="button"
              onClick={() => descargarInforme(resultado)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3.5 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              <Download size={14} /> Descargar importados
            </button>
          </div>
        </section>
      )}

      {/* Vista previa */}
      {previa && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Filas leídas</p>
              <p className="text-2xl font-black text-slate-900">{previa.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Listas para publicar</p>
              <p className="text-2xl font-black text-emerald-800">{previa.importables}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700">Con errores</p>
              <p className="text-2xl font-black text-red-800">{previa.invalidas}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">Fuera de cupo</p>
              <p className="text-2xl font-black text-amber-800">{previa.sinCupo}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <p className="font-bold text-slate-800">
                {previa.importables > 0
                  ? `Se van a publicar ${previa.importables} anuncios`
                  : 'No hay filas válidas que publicar'}
              </p>
              <button
                type="button"
                onClick={importar}
                disabled={previa.importables === 0 || importando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {importando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                {importando ? 'Importando…' : `Importar ${previa.importables}`}
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Línea</th>
                    <th className="px-3 py-2 font-semibold">Título</th>
                    <th className="px-3 py-2 font-semibold">Precio</th>
                    <th className="px-3 py-2 font-semibold">Ubicación</th>
                    <th className="px-3 py-2 font-semibold">Fotos</th>
                    <th className="px-3 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => {
                    const ok = f.errores.length === 0
                    const fueraDeCupo =
                      ok && previa.filas.filter((x) => x.errores.length === 0).indexOf(f) >= previa.importables
                    return (
                      <tr key={f.linea} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2 text-slate-400">{f.linea}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-800">{f.titulo || '—'}</p>
                          {f.errores.map((e) => (
                            <p key={e} className="mt-0.5 text-red-700">
                              ✕ {e}
                            </p>
                          ))}
                          {f.avisos.map((a) => (
                            <p key={a} className="mt-0.5 text-amber-700">
                              ! {a}
                            </p>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {f.precio != null ? `${f.precio.toLocaleString('es-ES')} €` : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {[f.ubicacion_ciudad, f.ubicacion_estado].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{f.imagenes.length}</td>
                        <td className="px-3 py-2">
                          {!ok ? (
                            <span className="font-semibold text-red-700">Corregir</span>
                          ) : fueraDeCupo ? (
                            <span className="font-semibold text-amber-700">Sin cupo</span>
                          ) : (
                            <span className="font-semibold text-emerald-700">Se publica</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {previa.sinCupo > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                Tu plan permite {previa.cupo ?? '∞'} anuncios activos y te quedan{' '}
                {previa.restantes ?? '∞'}. Se importarán las primeras {previa.importables} filas
                válidas.{' '}
                <LocalLink href="/para-profesionales" className="font-semibold underline">
                  Ver Profesional
                </LocalLink>
              </span>
            </div>
          )}

          {previa.recortadas > 0 && (
            <p className="text-xs text-slate-500">
              Se han ignorado {previa.recortadas} filas: el máximo por archivo es de 100.
            </p>
          )}
          {previa.desconocidas?.length > 0 && (
            <p className="text-xs text-slate-500">
              Columnas ignoradas: {previa.desconocidas.join(', ')}.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
