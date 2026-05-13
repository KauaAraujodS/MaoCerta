'use client'

import { useState, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function FormularioNovaSenha() {
  const params = useSearchParams()
  const router = useRouter()
  const email = params.get('email') || ''

  const [codigo, setCodigo] = useState(['', '', '', '', '', '', '', ''])
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function handleDigito(index: number, valor: string) {
    if (!/^\d*$/.test(valor)) return
    const novo = [...codigo]
    novo[index] = valor.slice(-1)
    setCodigo(novo)
    if (valor && index < 7) inputs.current[index + 1]?.focus()
  }

  function handleBackspace(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  function handleColar(e: React.ClipboardEvent) {
    const texto = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (texto.length === 8) {
      setCodigo(texto.split(''))
      inputs.current[7]?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const token = codigo.join('')
    if (token.length < 8) {
      setErro('Digite o código completo')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem')
      return
    }

    setCarregando(true)
    const supabase = createClient()

    const { error: erroVerificacao } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    })

    if (erroVerificacao) {
      setErro('Código inválido ou expirado')
      setCarregando(false)
      return
    }

    const { error: erroAtualizacao } = await supabase.auth.updateUser({ password: senha })

    if (erroAtualizacao) {
      setErro(erroAtualizacao.message)
      setCarregando(false)
      return
    }

    setSucesso('Senha redefinida com sucesso!')
    setTimeout(() => router.push('/entrar'), 1500)
  }

  async function reenviarCodigo() {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email)
    setSucesso('Novo código enviado para o seu e-mail')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-700 via-indigo-600 to-blue-400 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-5">

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto text-3xl">
            🔑
          </div>
          <h1 className="text-xl font-bold text-white">Nova senha</h1>
          <p className="text-white/60 text-sm">
            Código enviado para{' '}
            <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-white/80 text-xs font-medium">Código de 8 dígitos</label>
            <div className="flex gap-1.5 justify-center">
              {codigo.map((digito, i) => (
                <input
                  key={i}
                  ref={el => { inputs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digito}
                  onChange={(e) => handleDigito(i, e.target.value)}
                  onKeyDown={(e) => handleBackspace(i, e)}
                  onPaste={handleColar}
                  className="w-9 h-12 bg-white/20 text-white text-lg font-bold text-center rounded-xl outline-none focus:bg-white/35 transition-colors caret-transparent"
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-white/80 text-xs font-medium">Nova senha</label>
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

          <div className="space-y-1">
            <label className="text-white/80 text-xs font-medium">Confirmar nova senha</label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/25 transition-colors"
            />
          </div>

          {erro && (
            <p className="text-red-300 text-xs text-center">{erro}</p>
          )}
          {sucesso && (
            <p className="text-green-300 text-xs text-center">{sucesso}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-white dark:bg-slate-900 text-purple-700 font-semibold py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>

        <p className="text-white/50 text-xs text-center">
          Não recebeu?{' '}
          <button onClick={reenviarCodigo} className="text-white font-medium hover:underline">
            Reenviar código
          </button>
        </p>

      </div>
    </main>
  )
}

export default function NovaSenhaScreen() {
  return (
    <Suspense>
      <FormularioNovaSenha />
    </Suspense>
  )
}
