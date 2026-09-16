'use client'

import dynamic from 'next/dynamic'

// ServiceWorkerRegistration es 100% client-side (devuelve null y solo corre
// en useEffect), así que no hace falta incluirlo en el render del servidor:
// lo cargamos dinámicamente solo en el cliente. Este wrapper existe porque
// `next/dynamic` con `ssr: false` NO se puede usar directamente en un Server
// Component (como layout.tsx): hay que invocarlo desde un Client Component.
const ServiceWorkerRegistration = dynamic(
  () => import('@/components/ServiceWorkerRegistration').then((m) => m.ServiceWorkerRegistration),
  { ssr: false }
)

export function ServiceWorkerRegistrationClient() {
  return <ServiceWorkerRegistration />
}
