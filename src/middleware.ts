import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function copiarCookies(origem: NextResponse, destino: NextResponse) {
  origem.cookies.getAll().forEach(({ name, value }) => {
    destino.cookies.set(name, value)
  })
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next()

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next()
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Rotas protegidas
    const rotasProtegidas = ['/cliente/', '/profissional/', '/admin/']
    const acessandoRotaProtegida = rotasProtegidas.some((rota) =>
      request.nextUrl.pathname.startsWith(rota)
    )

    if (acessandoRotaProtegida && !user) {
      return NextResponse.redirect(new URL('/entrar', request.url))
    }

    // Evita acessar login estando logado
    const rotasDeAuth = ['/entrar', '/cadastro']
    const acessandoRotaDeAuth = rotasDeAuth.some((rota) =>
      request.nextUrl.pathname.startsWith(rota)
    )

    if (acessandoRotaDeAuth && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tipo')
        .eq('id', user.id)
        .maybeSingle()

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
    return NextResponse.next()
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}