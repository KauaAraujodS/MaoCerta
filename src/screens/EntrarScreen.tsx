'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // lógica de login vai aqui
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-700 via-indigo-600 to-blue-400 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-6">

        {/* Cabeçalho */}
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

          <button
            type="submit"
            className="w-full bg-white text-purple-700 font-semibold py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors"
          >
            Entrar
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
