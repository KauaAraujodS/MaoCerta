'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RecuperarSenhaScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    router.push(`/nova-senha?email=${encodeURIComponent(email)}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-700 via-indigo-600 to-blue-400 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-6">

        <div className="flex items-center gap-3">
          <Link href="/entrar" className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl transition-colors">
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Recuperar acesso</h1>
            <p className="text-white/60 text-xs">Enviaremos um código para o seu e-mail</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-white/80 text-xs font-medium">E-mail da conta</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors"
            />
          </div>

          {erro && (
            <p className="text-red-300 text-xs text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-white dark:bg-slate-900 text-purple-700 font-semibold py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Enviando...' : 'Enviar código'}
          </button>
        </form>

        <p className="text-white/50 text-xs text-center">
          Lembrou a senha?{' '}
          <Link href="/entrar" className="text-white font-medium hover:underline">
            Entrar
          </Link>
        </p>

      </div>
    </main>
  )
}
