import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Copia cookies da resposta do Supabase (refresh de sessão) para redirects. */
function copiarCookies(origem: NextResponse, destino: NextResponse) {
  origem.cookies.getAll().forEach(({ name, value }) => {
    destino.cookies.set(name, value)
  })
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[middleware] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no painel da Vercel (Settings → Environment Variables).'
    )
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, responseHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          if (responseHeaders) {
            Object.entries(responseHeaders).forEach(([key, value]) => {
              if (typeof value === 'string') supabaseResponse.headers.set(key, value)
            })
          }
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const rotasDemo = ['/cliente/', '/profissional/', '/admin/']
    const acessandoRotaDemo = rotasDemo.some((rota) =>
      request.nextUrl.pathname.startsWith(rota)
    )

    const rotasProtegidas = ['/cliente/', '/profissional/', '/admin/']
    const acessandoRotaProtegida = rotasProtegidas.some((rota) =>
      request.nextUrl.pathname.startsWith(rota)
    )

    if (acessandoRotaProtegida && !acessandoRotaDemo && !user) {
      const redir = NextResponse.redirect(new URL('/entrar', request.url))
      copiarCookies(supabaseResponse, redir)
      return redir
    }

    const rotasDeAuth = ['/entrar', '/cadastro']
    const acessandoRotaDeAuth = rotasDeAuth.some((rota) =>
      request.nextUrl.pathname.startsWith(rota)
    )

    if (acessandoRotaDeAuth && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tipo')
        .eq('id', user.id)
        .single()

      const destino =
        profile?.tipo === 'administrador'
          ? '/admin/inicio'
          : profile?.tipo === 'profissional'
            ? '/profissional/inicio'
            : '/cliente/inicio'

      const redir = NextResponse.redirect(new URL(destino, request.url))
      copiarCookies(supabaseResponse, redir)
      return redir
    }
  } catch (e) {
    console.error('[middleware]', e)
    return NextResponse.next({ request })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
