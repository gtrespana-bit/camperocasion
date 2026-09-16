'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'

// Cooldown de 6 horas antes de volver a mostrar el banner tras un "No, gracias"
const COOLDOWN_MS = 6 * 60 * 60 * 1000
// Marca de instalación aceptada (no volver a preguntar nunca)
const INSTALLED_FLAG = 'installed'
const INSTALL_KEY = 'pwa_install_dismissed'
const IOS_KEY = 'pwa_ios_dismissed'

export default function PWAInstallBanner() {
  const t = useTranslations()
  const [mounted, setMounted] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ya instalada: la app se está viendo en modo standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // iOS: instrucciones manuales para agregar a pantalla de inicio
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      const dismissed = localStorage.getItem(IOS_KEY)
      if (!dismissed) {
        const timer = setTimeout(() => setShowIOS(true), 3000)
        return () => clearTimeout(timer)
      }
      return
    }

    // Migrar valor legacy: antes la instalación aceptada se guardaba como '1'
    if (localStorage.getItem(INSTALL_KEY) === '1') {
      localStorage.setItem(INSTALL_KEY, INSTALLED_FLAG)
    }

    const isInstalled = () => localStorage.getItem(INSTALL_KEY) === INSTALLED_FLAG

    const isInCooldown = () => {
      const flag = localStorage.getItem(INSTALL_KEY)
      if (!flag || flag === INSTALLED_FLAG) return false
      const ts = parseInt(flag, 10)
      return !isNaN(ts) && Date.now() - ts < COOLDOWN_MS
    }

    // Android/Desktop: capturar beforeinstallprompt SOLO cuando vamos a mostrar
    // nuestro propio banner. Si el usuario ya instaló o está en cooldown, no
    // interceptamos el evento → Chrome no registra el aviso
    // "Banner not shown: beforeinstallpromptevent.preventDefault() called".
    const handler = (e: Event) => {
      if (isInstalled() || isInCooldown()) return
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    setMounted(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  // Limpiar cooldowns expirados (instalación e iOS) con un único timer por clave.
  // Cuando expira, el banner vuelve a mostrarse en el próximo beforeinstallprompt
  // (siguiente visita), sin necesidad de re-mostrar con un evento obsoleto.
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    const clearWhenExpired = (key: string) => {
      const flag = localStorage.getItem(key)
      if (!flag || flag === INSTALLED_FLAG || flag === '1') return
      const ts = parseInt(flag, 10)
      if (isNaN(ts) || Date.now() - ts >= COOLDOWN_MS) {
        localStorage.removeItem(key)
        return
      }
      timers.push(
        setTimeout(() => localStorage.removeItem(key), COOLDOWN_MS - (Date.now() - ts))
      )
    }

    clearWhenExpired(INSTALL_KEY)
    clearWhenExpired(IOS_KEY)

    return () => timers.forEach(clearTimeout)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(INSTALL_KEY, INSTALLED_FLAG)
      setShowBanner(false)
      setDeferredPrompt(null)
    } else {
      // Cerró el diálogo de Chrome sin instalar: respetar cooldown
      localStorage.setItem(INSTALL_KEY, Date.now().toString())
      setShowBanner(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowIOS(false)
    const now = Date.now().toString()
    localStorage.setItem(INSTALL_KEY, now)
    localStorage.setItem(IOS_KEY, now)
  }

  return (
    <>
      {mounted && showBanner && (
        <div className="fixed bottom-4 inset-x-4 z-[60] md:inset-x-auto md:left-4 md:bottom-4 md:max-w-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
            <button onClick={handleDismiss} aria-label={t('pwa.closeBanner')} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-lg">TA</span>
              </div>
              <div className="flex-1 pr-6">
                <p className="font-bold text-gray-900 text-sm">{t('pwa.installTitle')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('pwa.installDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleInstall}
              className="w-full mt-3 bg-brand-primary text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-dark transition"
            >
              <Download size={16} /> {t('pwa.installButton')}
            </button>
          </div>
        </div>
      )}

      {showIOS && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 animate-slideUp relative">
            <button onClick={handleDismiss} aria-label={t('pwa.close')} className="absolute top-4 right-4 text-gray-500 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-brand-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-black text-xl">TA</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900">{t('pwa.iosTitle')}</h3>
            </div>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3 text-sm">
                <Smartphone size={18} className="text-brand-primary flex-shrink-0" />
                <p>{t('pwa.iosStep1Plain')} <Share size={14} className="inline" /></p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-primary flex-shrink-0">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
                <p>{t('pwa.iosStep2Plain')}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-full mt-4 bg-brand-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark transition"
            >
              {t('pwa.iosDone')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
