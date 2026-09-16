import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const { searchParams, pathname } = new URL(request.url)

  // Preserve locale from the request URL (e.g., /en/api/confirm-email -> /en/confirmacion)
  const localeMatch = pathname.match(/^\/([a-z]{2})\/api\/confirm-email/)
  const locale = localeMatch ? `/${localeMatch[1]}` : ''
  const confirmPath = locale ? `${locale}/confirmacion` : '/confirmacion'

  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const email = searchParams.get('email')

  if (!token || type !== 'email' || !email) {
    return NextResponse.redirect(new URL(confirmPath, request.url))
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar el token de confirmación
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return NextResponse.redirect(new URL(confirmPath, request.url))
    }

    // Si tiene éxito, redirigir a la página de confirmación
    return NextResponse.redirect(new URL(confirmPath, request.url))
  } catch {
    return NextResponse.redirect(new URL(confirmPath, request.url))
  }
}
