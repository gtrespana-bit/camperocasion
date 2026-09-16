'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function MiPerfilRedirect() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.replace('/dashboard?tab=perfil')
    } else {
      router.replace('/dashboard')
    }
  }, [user, router])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-500">Redirigiendo al panel...</p>
    </div>
  )
}
