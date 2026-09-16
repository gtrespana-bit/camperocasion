import { Suspense } from 'react'
import LoginClient from './LoginClient'

/**
 * Wrapper server-side: LoginClient usa useSearchParams() y debe quedar dentro
 * de un <Suspense> para permitir prerender (antes lo cubría el loading.tsx
 * del segmento [locale], que se eliminó para que notFound() devuelva 404 real).
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="inline-block w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginClient />
    </Suspense>
  )
}
