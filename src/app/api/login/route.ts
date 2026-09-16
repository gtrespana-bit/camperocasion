import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateLoginData } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Validar datos de login
    const validation = validateLoginData({ email, password })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Rate limit por IP (anti brute force)
    const rl = await checkRateLimit('auth:login', ip, { ip })
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${Math.ceil(rl.resetIn / 60000)} min`, resetIn: rl.resetIn },
        { status: 429 }
      )
    }

    // ✅ In Next.js 14 Route Handlers, cookies() is read-only.
    // We must collect cookies via setAll and write them to the response manually.
    let responseCookies: Array<{ name: string; value: string; options?: Record<string, any> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            responseCookies = cookiesToSet
          },
        },
      }
    )

    const { data: result, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // ✅ Build response and set auth cookies on it
    const response = NextResponse.json({
      ok: true,
      user: result.user,
      session: {
        access_token: result.session?.access_token,
        refresh_token: result.session?.refresh_token,
      },
    })

    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
