import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  try {
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
            // Expire all auth cookies by setting maxAge=0
            responseCookies = cookiesToSet.map(c => ({
              ...c,
              options: { ...c.options, maxAge: 0 },
            }))
          },
        },
      }
    )

    await supabase.auth.signOut()

    // ✅ Build response and set expired cookies on it to delete them
    const response = NextResponse.json({ ok: true })

    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value ?? '', options)
    })

    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
