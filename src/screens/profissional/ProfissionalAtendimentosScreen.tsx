'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEMO_SOLICITACOES,
  formatarData,
  formatarMoeda,
  statusSolicitacaoMeta,
  type CategoriaOption,
  type SolicitacaoProfissional,
} from '@/lib/profissional'

export default function ProfissionalAtendimentosScreen() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoProfissional[]>(DEMO_SOLICITACOES)
  const [carregando, setCarregando] = useState(true)
  const [modoDemo, setModoDemo] = useState(true)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setCarregando(false)
        return
      }

      setModoDemo(false)

      const [categoriasRes, solicitacoesRes] = await Promise.all([
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase
          .from('solicitacoes_profissionais')
          .select('id, cliente_id, categoria_id, titulo, descricao, data_preferida, orcamento_sugerido, status, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (categoriasRes.error || solicitacoesRes.error) {
        setAviso({
          tipo: 'erro',
          texto: 'As solicitações diretas dependem da migration 007 aplicada no Supabase. Enquanto isso, o fluxo pode ser visto em modo de demonstração.',
        })
        setCarregando(false)
        return
      }

      const mapaCategorias = new Map<number, string>()
      ;((categoriasRes.data as CategoriaOption[] | null) || []).forEach((item) => {
        mapaCategorias.set(item.id, item.nome)
      })

      const clienteIds = Array.from(
        new Set((solicitacoesRes.data || []).map((item) => item.cliente_id).filter(Boolean))
      )
      const nomesClientes = new Map<string, string>()

      if (clienteIds.length > 0) {
        const clientesRes = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', clienteIds)

        ;(clientesRes.data || []).forEach((item) => {
          nomesClientes.set(item.id, item.nome || 'Cliente')
        })
      }

      setSolicitacoes(
        (solicitacoesRes.data || []).map((item) => ({
          id: item.id,
          titulo: item.titulo,
          descricao: item.descricao,
          status: item.status,
          categoriaId: item.categoria_id,
          categoriaNome: item.categoria_id ? mapaCategorias.get(item.categoria_id) || 'Categoria' : 'Sem categoria',
          clienteNome: nomesClientes.get(item.cliente_id) || 'Cliente da plataforma',
          dataPreferida: item.data_preferida,
          orcamentoSugerido: typeof item.orcamento_sugerido === 'number' ? item.orcamento_sugerido : null,
          createdAt: item.created_at,
        })) as SolicitacaoProfissional[]
      )
      setCarregando(false)
    }

    carregar()
  }, [])

  const pendentes = useMemo(
    () => solicitacoes.filter((item) => item.status === 'pendente').length,
    [solicitacoes]
  )
  const aceitas = useMemo(
    () => solicitacoes.filter((item) => item.status === 'aceita').length,
    [solicitacoes]
  )

  async function atualizarStatus(id: string, status: SolicitacaoProfissional['status']) {
    setAviso(null)

    if (modoDemo) {
      setSolicitacoes((atual) =>
        atual.map((item) => (item.id === id ? { ...item, status } : item))
      )
      setAviso({ tipo: 'ok', texto: 'Status atualizado na demonstração.' })
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('solicitacoes_profissionais')
      .update({ status })
      .eq('id', id)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Atualizar solicitação: ${error.message}` })
      return
    }

    setSolicitacoes((atual) =>
      atual.map((item) => (item.id === id ? { ...item, status } : item))
    )
    setAviso({ tipo: 'ok', texto: 'Solicitação atualizada.' })
  }

  return (
    <main className="p-4 space-y-4">
      <section className="bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 rounded-[28px] p-5 text-white space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-[0.25em]">RF12</p>
            <h1 className="text-2xl font-bold mt-1">Solicitações de clientes</h1>
            <p className="text-sm text-white/80 mt-2">
              Pedidos diretos enviados ao seu perfil, com orçamento sugerido e data preferida.
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Resumo titulo="Pendentes" valor={String(pendentes)} descricao="Aguardando resposta" />
          <Resumo titulo="Aceitas" valor={String(aceitas)} descricao="Em andamento" />
        </div>
      </section>

      {aviso && (
        <section
          className={`rounded-2xl p-3 text-sm font-medium ${
            aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {aviso.texto}
        </section>
      )}

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Caixa de entrada do profissional</h2>
            <p className="text-sm text-gray-500 mt-1">
              Responda rapidamente para aumentar sua taxa de conversão e reputação.
            </p>
          </div>
          <Link
            href="/profissional/demandas"
            className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Ver mural
          </Link>
        </div>

        {carregando && <p className="text-sm text-gray-500">Carregando solicitações...</p>}

        {!carregando && solicitacoes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Nenhuma solicitação recebida</p>
            <p className="text-xs text-gray-500 mt-1">
              Quando um cliente pedir atendimento direto pelo seu perfil, ela aparecerá aqui.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const meta = statusSolicitacaoMeta(solicitacao.status)

            return (
              <article key={solicitacao.id} className="rounded-3xl border border-gray-100 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{solicitacao.titulo}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {solicitacao.clienteNome} · {solicitacao.categoriaNome}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.classe}`}>
                    {meta.texto}
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{solicitacao.descricao}</p>

                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="rounded-full bg-gray-100 px-3 py-1.5">
                    Data sugerida: {solicitacao.dataPreferida ? formatarData(solicitacao.dataPreferida) : 'A combinar'}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1.5">
                    Orçamento: {formatarMoeda(solicitacao.orcamentoSugerido)}
                  </span>
                </div>

                <p className="text-xs text-gray-400">Recebida em {formatarData(solicitacao.createdAt)}</p>

                {solicitacao.status === 'pendente' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => atualizarStatus(solicitacao.id, 'aceita')}
                      className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Aceitar solicitação
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizarStatus(solicitacao.id, 'recusada')}
                      className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      Recusar
                    </button>
                  </div>
                )}

                {solicitacao.status === 'aceita' && (
                  <button
                    type="button"
                    onClick={() => atualizarStatus(solicitacao.id, 'concluida')}
                    className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    Marcar como concluída
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function Resumo(props: { titulo: string; valor: string; descricao: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3">
      <p className="text-white/65 text-[11px] uppercase tracking-wide">{props.titulo}</p>
      <p className="text-2xl font-bold mt-1">{props.valor}</p>
      <p className="text-white/75 text-xs mt-1">{props.descricao}</p>
    </div>
  )
}
