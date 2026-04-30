'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Solicitacao = {
  id: string
  titulo: string
  descricao: string
  status: string
  created_at: string
}

export default function ProfissionalSolicitacoesScreen() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        setCarregando(false)
        return
      }

      const { data, error } = await supabase
        .from('solicitacoes')
        .select('id, titulo, descricao, status, created_at')
        .eq('profissional_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setAviso('Não foi possível carregar solicitações. A migration do RF12 pode não ter sido aplicada.')
      }
      setSolicitacoes((data as Solicitacao[] | null) || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function atualizarStatus(id: string, status: 'aceita' | 'recusada') {
    const supabase = createClient()
    const { error } = await supabase.from('solicitacoes').update({ status }).eq('id', id)
    if (error) {
      setAviso('Falha ao atualizar solicitação.')
      return
    }
    setSolicitacoes((atual) => atual.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Solicitações recebidas</h1>
        <p className="text-sm text-gray-500 mt-1">Pedidos diretos enviados por clientes ao seu perfil.</p>
      </header>

      {carregando && <p className="text-sm text-gray-500">Carregando...</p>}

      {!carregando && solicitacoes.length === 0 && (
        <section className="bg-white rounded-2xl p-4">
          <p className="text-sm text-gray-500">Você ainda não recebeu solicitações.</p>
        </section>
      )}

      {solicitacoes.map((item) => (
        <section key={item.id} className="bg-white rounded-2xl p-4 space-y-3">
          <div>
            <p className="font-semibold text-gray-900">{item.titulo}</p>
            <p className="text-sm text-gray-600 mt-1">{item.descricao}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status: {item.status}</span>
            {item.status === 'pendente' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => atualizarStatus(item.id, 'aceita')}
                  className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full"
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  onClick={() => atualizarStatus(item.id, 'recusada')}
                  className="text-xs font-semibold bg-red-100 text-red-700 px-3 py-1.5 rounded-full"
                >
                  Recusar
                </button>
              </div>
            )}
          </div>
        </section>
      ))}

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
    </main>
  )
}
