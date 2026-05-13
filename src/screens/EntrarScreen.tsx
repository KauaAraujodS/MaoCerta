'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EntrarScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

      if (error) {
        const codigo = (error as { code?: string }).code
        if (
          codigo === 'email_not_confirmed' ||
          /email not confirmed|not confirmed/i.test(error.message)
        ) {
          setErro(
            'Este e-mail ainda não foi confirmado. Abra o link que enviamos ao criar a conta (verifique também o spam).'
          )
          return
        }
        setErro(error.message || 'E-mail ou senha incorretos.')
        return
      }

      // Garante persistência da sessão em cookies antes de consultar o perfil / navegar.
      await supabase.auth.getSession()

      const { data: profile, error: erroPerfil } = await supabase
        .from('profiles')
        .select('tipo')
        .eq('id', data.user.id)
        .maybeSingle()

      if (erroPerfil) {
        console.error(erroPerfil)
        setErro('Conta sem perfil. Entre em contato com o suporte.')
        await supabase.auth.signOut()
        return
      }

      if (!profile) {
        setErro('Conta sem perfil. Entre em contato com o suporte.')
        await supabase.auth.signOut()
        return
      }

      // Atualiza cookies no servidor (middleware lê sessão daqui)
      router.refresh()

      if (profile?.tipo === 'administrador') {
        router.push('/admin/inicio')
      } else if (profile?.tipo === 'profissional') {
        router.push('/profissional/inicio')
      } else {
        router.push('/cliente/inicio')
      }
    } catch (err) {
      console.error(err)
      setErro('Falha de conexão. Verifique a internet ou as configurações do Supabase.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-700 via-indigo-600 to-blue-400 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-6">

        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl transition-colors">
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Entrar</h1>
            <p className="text-white/60 text-xs">Bem-vindo de volta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-white/80 text-xs font-medium">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-white/80 text-xs font-medium">Senha</label>
                <Link href="/recuperar-senha" className="text-white/60 text-xs hover:text-white transition-colors">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 text-xs transition-colors"
                >
                  {mostrarSenha ? 'ocultar' : 'ver'}
                </button>
              </div>
            </div>
          </div>

          {erro && (
            <p className="text-red-300 text-xs text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-white dark:bg-slate-900 text-purple-700 font-semibold py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-white/50 text-xs text-center">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-white font-medium hover:underline">
            Criar conta
          </Link>
        </p>

      </div>
    </main>
  )
}
