import type { Metadata } from 'next'
import { sbAdmin } from '@/lib/sb-admin'
import AceptarInvitacion from './AceptarInvitacion'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Invitación a un equipo',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ locale: string; token: string }> }

async function getInvitacion(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null
  try {
    const sb = sbAdmin()
    const { data, error } = await sb
      .from('equipo_miembros')
      .select('email, estado, titular_id')
      .eq('token', token)
      .maybeSingle()
    if (error || !data) return null

    const { data: titular } = await sb
      .from('perfiles')
      .select('nombre, slug')
      .eq('id', data.titular_id)
      .maybeSingle()

    return {
      email: data.email as string,
      estado: data.estado as string,
      titular: (titular?.nombre as string) || 'una cuenta de CamperOcasión',
      slug: (titular?.slug as string) || null,
    }
  } catch {
    return null
  }
}

export default async function InvitacionPage({ params }: Props) {
  const { token } = await params
  const invitacion = await getInvitacion(token)

  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-accent">CamperOcasión</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Invitación a un equipo Flota</h1>

        {!invitacion ? (
          <p className="mt-4 text-sm text-slate-600">
            Esta invitación no existe o se ha revocado. Pide al titular de la cuenta que te envíe una
            nueva desde <strong>Panel → Equipo</strong>.
          </p>
        ) : invitacion.estado === 'activo' ? (
          <p className="mt-4 text-sm text-slate-600">
            Esta invitación ya se ha usado. Si eres tú, entra en tu panel: verás el equipo en{' '}
            <strong>Panel → Equipo</strong>.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-600">
              <strong>{invitacion.titular}</strong> te ha añadido como comercial de su cuenta{' '}
              <strong>Unlimited Flota</strong>. Publicarás con tu propio usuario, dentro del cupo del
              equipo y sin pagar un pack.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              La invitación es para <strong>{invitacion.email}</strong>. Tienes que entrar con esa
              misma cuenta.
            </p>
            <AceptarInvitacion token={token} />
          </>
        )}
      </div>
    </main>
  )
}
