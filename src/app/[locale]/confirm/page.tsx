'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

type Estado = 'loading' | 'success' | 'error'
type Parametro = (clave: string) => string | null

export default function ConfirmEmailPage() {
  const t = useTranslations('confirmEmail')
  const router = useRouter()
  const [status, setStatus] = useState<Estado>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [yaLogueado, setYaLogueado] = useState(false)

  useEffect(() => {
    let cancelled = false

    const terminarExito = () => {
      if (cancelled) return
      setStatus('success')
      setTimeout(() => {
        if (cancelled) return
        router.push('/dashboard')
      }, 3000)
    }

    const terminarError = (msg: string) => {
      if (cancelled) return
      setStatus('error')
      setErrorMsg(msg)
    }

    async function confirmAccount() {
      try {
        // ── 1. Leer parámetros de la URL ─────────────────────────────────
        // El email de confirmación puede traer el token de varias formas:
        //   a) ?token_hash=…&type=signup  (token para verificar con verifyOtp)
        //   b) #access_token=…&type=signup (Supabase ya validó el token y
        //      redirige con una sesión implícita en el fragmento)
        //   c) ?code=…&flow_id=…          (callback PKCE)
        //   d) sin parámetros              (Supabase ya la procesó al cargar)
        const query = new URLSearchParams(window.location.search)
        const hash = window.location.hash
        const hashParams = hash && hash.length > 1 ? new URLSearchParams(hash.substring(1)) : null
        const get: Parametro = (k) => hashParams?.get(k) ?? query.get(k)

        const type = get('type')
        const tokenHash = get('token_hash') || get('token')
        const accessToken = get('access_token')
        const refreshToken = get('refresh_token')
        const code = get('code')
        const errorUrl = get('error') || query.get('error_description')

        // Si Supabase devolvió error en la URL pero la sesión ya existe y está
        // confirmada, el clic SÍ funcionó (p. ej. enlace reutilizado).
        if (errorUrl) {
          const { data: sesionExistente } = await supabase.auth.getSession()
          if (sesionExistente.session?.user?.email_confirmed_at) {
            setYaLogueado(true)
            terminarExito()
            return
          }
        }

        // ── 2. Sesión implícita ya emitida por Supabase ──────────────────
        // (Enlace verificado por GET /verify → redirect con #access_token…)
        if (accessToken && refreshToken) {
          const { error: errorSet } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!errorSet) {
            setYaLogueado(true)
            terminarExito()
            return
          }
          // Si falla, seguir e intentar verifyOtp por si el token viene aparte.
        }

        // ── 3. Token de verificación (token_hash / token + type) ─────────
        if (tokenHash && type) {
          // El tipo 'email' que a veces llega en el enlace equivale a 'signup'.
          const tipoOtp = type === 'email' ? 'signup' : type
          const { data: dataOtp, error: errorOtp } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tipoOtp as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change',
          })
          if (errorOtp) {
            // Token inválido/expirado: quizá el usuario YA confirmó antes y
            // reutilizó el enlace. Comprobar sesión antes de rendirse.
            const { data: sesionExistente } = await supabase.auth.getSession()
            if (sesionExistente.session?.user?.email_confirmed_at) {
              setYaLogueado(true)
              terminarExito()
            } else {
              terminarError(errorOtp.message || t('confirmError'))
            }
            return
          }
          if (dataOtp.session?.user?.email_confirmed_at) setYaLogueado(true)
          terminarExito()
          return
        }

        // ── 4. Callback PKCE (?code=…): intercambiar por sesión ─────────
        if (code) {
          const { error: errorCode } = await supabase.auth.exchangeCodeForSession(code)
          if (errorCode) {
            terminarError(errorCode.message || t('confirmError'))
            return
          }
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.email_confirmed_at) setYaLogueado(true)
          terminarExito()
          return
        }

        // ── 5. Sin parámetros: ver si supabase-js ya procesó la sesión ───
        const { data: sessionData, error } = await supabase.auth.getSession()
        if (sessionData.session?.user?.email_confirmed_at) {
          setYaLogueado(true)
          terminarExito()
        } else {
          terminarError((error as any)?.message || t('noToken'))
        }
      } catch (e: any) {
        terminarError(e?.message || t('confirmError'))
      }
    }

    confirmAccount()
    return () => {
      cancelled = true
    }
  }, [router, t])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LocalLink href="/" className="text-brand-primary font-black text-3xl">
            Vende<span className="text-brand-accent">T</span><span className="text-sm ml-1 text-gray-500">-España</span>
          </LocalLink>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <Loader2 className="text-brand-primary animate-spin" size={48} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                {t('loading')}
              </h2>
              <p className="text-gray-500 text-center">{t('loadingDesc')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="text-green-600" size={48} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                {t('success')}
              </h2>
              <p className="text-green-700 text-center mb-6">
                {yaLogueado ? t('successDescDashboard') : t('successDesc')}
              </p>
              <LocalLink
                href={yaLogueado ? '/dashboard' : '/login'}
                className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
              >
                {yaLogueado ? t('goDashboard') : t('goLogin')}
              </LocalLink>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-red-100 rounded-full p-4">
                  <XCircle className="text-red-600" size={48} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                {t('error')}
              </h2>
              <p className="text-red-600 text-center mb-6 text-sm">
                {errorMsg || t('errorDefault')}
              </p>
              <LocalLink
                href="/login"
                className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
              >
                {t('resendLogin')}
              </LocalLink>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
