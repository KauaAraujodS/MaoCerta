import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Rotas liberadas para demonstração (remover em produção)
  const rotasDemo = ['/cliente/', '/profissional/', '/admin/']
  const acessandoRotaDemo = rotasDemo.some(rota =>
    request.nextUrl.pathname.startsWith(rota)
  )

  // Rotas protegidas — redireciona para login se não estiver logado
  const rotasProtegidas = ['/cliente/', '/profissional/', '/admin/']
  const acessandoRotaProtegida = rotasProtegidas.some(rota =>
    request.nextUrl.pathname.startsWith(rota)
  )

  if (acessandoRotaProtegida && !acessandoRotaDemo && !user) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  // Se já está logado, redireciona login/cadastro para a área do tipo do usuário
  const rotasDeAuth = ['/entrar', '/cadastro']
  const acessandoRotaDeAuth = rotasDeAuth.some(rota =>
    request.nextUrl.pathname.startsWith(rota)
  )

  if (acessandoRotaDeAuth && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tipo')
      .eq('id', user.id)
      .single()

    const destino =
      profile?.tipo === 'administrador' ? '/admin/inicio'
      : profile?.tipo === 'profissional' ? '/profissional/inicio'
      : '/cliente/inicio'

    return NextResponse.redirect(new URL(destino, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
