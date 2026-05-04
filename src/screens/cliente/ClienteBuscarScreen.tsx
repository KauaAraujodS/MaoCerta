'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClienteBuscarScreen() {
  const [profissionalId, setProfissionalId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function enviarSolicitacao(e: FormEvent) {
    e.preventDefault()
    if (!profissionalId.trim() || !titulo.trim() || !descricao.trim()) return

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    setSalvando(true)
    setAviso(null)
    const { error } = await supabase.from('solicitacoes').insert({
      cliente_id: user.id,
      profissional_id: profissionalId.trim(),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
    })
    setSalvando(false)

    if (error) {
      setAviso('Falha ao enviar solicitação.')
      return
    }

    setProfissionalId('')
    setTitulo('')
    setDescricao('')
    setAviso('Solicitação enviada com sucesso.')
  }

  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Buscar e solicitar</h1>
        <p className="text-sm text-gray-500 mt-1">Envie uma solicitação direta para um profissional.</p>
      </header>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nova solicitação</p>
        <form onSubmit={enviarSolicitacao} className="space-y-2">
          <input
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            placeholder="ID do profissional"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o serviço que você precisa"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
          />
          <button type="submit" disabled={salvando} className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold">
            {salvando ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </form>
      </section>

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
    </main>
  )
}