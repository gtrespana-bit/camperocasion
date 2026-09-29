'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isAdminPath } from '@/lib/admin-path'

/**
 * Medición propia de audiencia (visitas del sitio).
 *
 * Reglas que cumple, en línea con lo que promete la política de cookies:
 *
 *  1. Solo se monta cuando el usuario ha pulsado «Aceptar» (lo decide
 *     `RootClientEffects`). Si rechaza, este código no se descarga.
 *  2. No guarda datos personales: el visitante es un id aleatorio generado en
 *     el navegador (`localStorage`) y la sesión dura 30 minutos de inactividad.
 *     No hay IP, ni user-agent, ni cookies de terceros.
 *  3. El panel /admin no se mide nunca (ni el tuyo ni el de nadie).
 *  4. La duración de cada página se manda con la página siguiente (o al cerrar
 *     la pestaña) porque al entrar todavía no se sabe: primero se registra la
 *     visita, después se completa con los segundos.
 */

const CLAVE_VISITANTE = 'camperocasion:vid'
const CLAVE_SESION = 'camperocasion:sid'
const SESION_MS = 30 * 60 * 1000
const ENDPOINT = '/api/analytics/visita'

interface PaginaAbierta {
  ruta: string
  ts: number
}

function idAleatorio(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    // Safari antiguo o contexto no seguro: se cae al generador manual.
  }
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

function leerAlmacen(storage: Storage | null, clave: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(clave)
  } catch {
    return null
  }
}

function guardarAlmacen(storage: Storage | null, clave: string, valor: string): void {
  if (!storage) return
  try {
    storage.setItem(clave, valor)
  } catch {
    // Modo privado: la medición simplemente no sobrevive a la navegación.
  }
}

function obtenerAlmacenes(): { local: Storage | null; sesion: Storage | null } {
  try {
    return { local: window.localStorage, sesion: window.sessionStorage }
  } catch {
    return { local: null, sesion: null }
  }
}

let visitanteCache: string | null = null

function visitanteId(): string {
  if (visitanteCache) return visitanteCache
  const { local } = obtenerAlmacenes()
  let id = leerAlmacen(local, CLAVE_VISITANTE)
  if (!id) {
    id = idAleatorio()
    guardarAlmacen(local, CLAVE_VISITANTE, id)
  }
  visitanteCache = id
  return id
}

function sesionId(): string {
  const { sesion } = obtenerAlmacenes()
  const crudo = leerAlmacen(sesion, CLAVE_SESION)
  if (crudo) {
    const [id, ts] = crudo.split('|')
    if (id && ts && Date.now() - Number(ts) < SESION_MS) {
      guardarAlmacen(sesion, CLAVE_SESION, `${id}|${Date.now()}`)
      return id
    }
  }
  const nuevo = idAleatorio()
  guardarAlmacen(sesion, CLAVE_SESION, `${nuevo}|${Date.now()}`)
  return nuevo
}

function enviar(payload: Record<string, unknown>): void {
  const cuerpo = JSON.stringify(payload)
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([cuerpo], { type: 'text/plain;charset=UTF-8' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
  } catch {
    // Sin sendBeacon (o bloqueado): se intenta con fetch keepalive.
  }
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      body: cuerpo,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  } catch {
    // Medición best-effort: nunca debe romper la navegación.
  }
}

function base() {
  return {
    vid: visitanteId(),
    sid: sesionId(),
    disp: window.innerWidth < 640 ? 'movil' : window.innerWidth < 1024 ? 'tablet' : 'escritorio',
    ancho: window.innerWidth,
  }
}

export default function AnaliticaVisitas() {
  const pathname = usePathname()
  const pagina = useRef<PaginaAbierta | null>(null)

  useEffect(() => {
    if (!pathname || isAdminPath(pathname)) return

    const anterior = pagina.current
    const ahora = Date.now()
    const segundos = anterior ? Math.round((ahora - anterior.ts) / 1000) : null

    enviar({
      ...base(),
      ruta: pathname,
      ref: document.referrer || '',
      ...(anterior && segundos && segundos >= 1 && segundos <= 86400
        ? { anterior: { ruta: anterior.ruta, ts: anterior.ts, segundos } }
        : {}),
    })

    pagina.current = { ruta: pathname, ts: ahora }
  }, [pathname])

  useEffect(() => {
    function cerrarPagina() {
      const abierta = pagina.current
      if (!abierta) return
      const segundos = Math.round((Date.now() - abierta.ts) / 1000)
      pagina.current = null
      if (segundos < 1 || segundos > 86400) return
      enviar({
        ...base(),
        ruta: abierta.ruta,
        soloDuracion: true,
        anterior: { ruta: abierta.ruta, ts: abierta.ts, segundos },
      })
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === 'hidden') {
        cerrarPagina()
        return
      }
      // Volvió a la pestaña: la página sigue abierta, se cuenta como una
      // visita nueva para poder medir el tiempo que ahora empieza.
      const ruta = pagina.current?.ruta || window.location.pathname
      if (isAdminPath(ruta)) return
      pagina.current = { ruta, ts: Date.now() }
      enviar({ ...base(), ruta })
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('pagehide', cerrarPagina)
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('pagehide', cerrarPagina)
    }
  }, [])

  return null
}
