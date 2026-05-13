'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tipo = 'cliente' | 'profissional'

function FormularioCadastro() {
  const params = useSearchParams()
  const router = useRouter()
  const tipoParam = params.get('tipo') as Tipo | null

  const [tipo, setTipo] = useState<Tipo | null>(tipoParam)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tipo) return

    setErro('')
    setCarregando(true)

    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, telefone, tipo },
        },
      })

      if (error) {
        setErro(error.message)
        return
      }

      if (data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            nome,
            telefone,
            tipo,
          },
          { onConflict: 'id' }
        )
      }

      router.refresh()
      router.push(`/verificar?email=${encodeURIComponent(email)}`)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-700 via-indigo-600 to-blue-400 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-5">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors">
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Criar conta</h1>
            <p className="text-white/60 text-xs">Rápido, leva menos de 1 minuto</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Escolha do tipo */}
          <div className="space-y-2">
            <p className="text-white/80 text-xs font-medium">Como você quer usar o app?</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setTipo('cliente')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  tipo === 'cliente' ? 'bg-white shadow-lg' : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  tipo === 'cliente' ? 'bg-purple-100' : 'bg-white/20'
                }`}>
                  👤
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-semibold text-sm ${tipo === 'cliente' ? 'text-gray-900' : 'text-white'}`}>
                    Cliente
                  </p>
                  <p className={`text-xs ${tipo === 'cliente' ? 'text-gray-500' : 'text-white/70'}`}>
                    Buscar e contratar profissionais
                  </p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  tipo === 'cliente' ? 'border-blue-500 bg-blue-500' : 'border-white/40'
                }`}>
                  {tipo === 'cliente' && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipo('profissional')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  tipo === 'profissional' ? 'bg-white shadow-lg' : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  tipo === 'profissional' ? 'bg-purple-100' : 'bg-white/20'
                }`}>
                  💼
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-semibold text-sm ${tipo === 'profissional' ? 'text-gray-900' : 'text-white'}`}>
                    Profissional
                  </p>
                  <p className={`text-xs ${tipo === 'profissional' ? 'text-gray-500' : 'text-white/70'}`}>
                    Quero oferecer meus serviços
                  </p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  tipo === 'profissional' ? 'border-blue-500 bg-blue-500' : 'border-white/40'
                }`}>
                  {tipo === 'profissional' && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              </button>
            </div>
          </div>

          {/* Campos */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-white/80 text-xs font-medium">Nome completo</label>
              <input
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-white/80 text-xs font-medium">Telefone</label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
                className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors"
              />
            </div>

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
              <label className="text-white/80 text-xs font-medium">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
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
            disabled={!tipo || carregando}
            className="w-full bg-white text-purple-700 font-semibold py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Criando conta...' : 'Criar minha conta'}
          </button>
        </form>

        <p className="text-white/50 text-xs text-center">
          Já tem conta?{' '}
          <Link href="/entrar" className="text-white font-medium hover:underline">
            Entrar
          </Link>
        </p>

      </div>
    </main>
  )
}

export default function CadastroScreen() {
  return (
    <Suspense>
      <FormularioCadastro />
    </Suspense>
  )
}
