'use client'

import { useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter, usePathname } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import { TIPOS_VENDEDOR, type TipoVendedor } from '@/components/BadgeTipoVendedor'

const ICONOS_TIPO: Record<TipoVendedor, string> = {
  particular: '👤',
  camperizador: '🔧',
  profesional: '🏢',
}

export default function RegisterPage() {
  const t = useTranslations('auth')
  const tTipos = useTranslations('tiposVendedor')
  const router = useRouter()
  const pathname = usePathname()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [tipoVendedor, setTipoVendedor] = useState<TipoVendedor>('particular')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Ingresa un email válido')
      return
    }

    // Validación de nombre
    if (!nombre || nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }

    // Validación de contraseña — NIST 800-63B: longitud mínima, sin reglas
    // de composición obligatoria (las reglas de mayúscula/número generan
    // contraseñas que se olvidan y usuarios que no vuelven).
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== repeatPassword) {
      setError(t('register.password_mismatch'))
      return
    }

    setLoading(true)

    // Nota: teléfono y ubicación NO se piden aquí. Se piden en contexto
    // (ubicación al publicar, teléfono al configurar contacto) para no
    // frenar el registro.
    //
    // El registro se hace en el servidor (POST /api/register) en vez de
    // `supabase.auth.signUp()` directo: así el email de confirmación lo envía
    // la propia app por su SMTP (src/lib/confirmacion-email.ts) y no depende
    // del SMTP del Dashboard de Supabase (que dejó de enviar cuando la cuenta
    // Zoho se degradó al plan gratuito, sin acceso SMTP).
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, tipo: tipoVendedor }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Error al crear la cuenta. Inténtalo de nuevo.')
        setLoading(false)
        return
      }

      // Mostrar mensaje de confirmación y redirigir a pantalla de confirmación
      sessionStorage.setItem('tempEmail', email)
      // Redirect with locale prefix
      const locale = (() => {
        for (const l of routing.locales) {
          if (l === routing.defaultLocale) continue
          if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l
        }
        return routing.defaultLocale
      })()
      const confirmPath = locale === routing.defaultLocale ? '/confirmacion' : `/${locale}/confirmacion`
      router.push(confirmPath)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LocalLink href="/" className="text-brand-primary font-black text-3xl">
            Vende<span className="text-brand-accent">T</span><span className="text-sm ml-1 text-gray-500">-España</span>
          </LocalLink>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">{t('register.title')}</h1>
          <p className="text-gray-500 mt-1">{t('register.subtitle')}</p>

          {/* Banner: credito gratis */}
          <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <span className="text-3xl">🎁</span>
            <div>
              <p className="font-bold text-green-800 text-sm">1 crédito GRATIS al registrarte</p>
              <p className="text-green-600 text-xs">Publica 10 anuncios y recibe 5 créditos más. ¡Así de simple!</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('register.name')}</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('register.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('register.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('register.repeat_password')}</label>
              <input
                type="password"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-gray-900"
              />
            </div>

            {/* Tipo de vendedor: se muestra junto a sus anuncios (Fase 2).
                Por defecto "particular" — registrarse sigue siendo rápido. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('register.sellerTypeLabel')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TIPOS_VENDEDOR.map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoVendedor(tipo)}
                    aria-pressed={tipoVendedor === tipo}
                    className={`text-left rounded-xl border px-3 py-2.5 transition ${
                      tipoVendedor === tipo
                        ? 'border-brand-primary ring-1 ring-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">
                      <span aria-hidden="true">{ICONOS_TIPO[tipo]}</span> {tTipos(tipo)}
                    </span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      {tTipos(`${tipo}Desc`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50"
            >
              {loading ? t('register.creating') : t('register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('register.has_account')}{' '}
            <LocalLink href="/login" className="text-brand-primary font-semibold hover:underline">
              {t('register.login')}
            </LocalLink>
          </p>
        </div>
      </div>
    </div>
  )
}
