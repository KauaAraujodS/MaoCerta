'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEMO_PROPOSTAS,
  DEMO_SOLICITACOES,
  formatarData,
  formatarMoeda,
  type PropostaProfissional,
  type SolicitacaoProfissional,
} from '@/lib/profissional'

type Compromisso = {
  id: string
  titulo: string
  detalhe: string
  quando: string
  tipo: 'solicitacao' | 'proposta'
}

export default function ProfissionalAgendaScreen() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoProfissional[]>(DEMO_SOLICITACOES)
  const [propostas, setPropostas] = useState<PropostaProfissional[]>(DEMO_PROPOSTAS)
  const [carregando, setCarregando] = useState(true)
  const [modoDemo, setModoDemo] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setCarregando(false)
        return
      }

      setModoDemo(false)

      const [solicitacoesRes, propostasRes, demandasRes] = await Promise.all([
        supabase
          .from('solicitacoes_profissionais')
          .select('id, titulo, descricao, status, data_preferida, orcamento_sugerido, created_at')
          .eq('profissional_id', user.id)
          .in('status', ['aceita', 'concluida'])
          .order('created_at', { ascending: false }),
        supabase
          .from('propostas')
          .select('id, demanda_id, mensagem, valor_proposto, prazo, status, created_at')
          .eq('profissional_id', user.id)
          .eq('status', 'aceita')
          .order('created_at', { ascending: false }),
        supabase
          .from('demandas')
          .select('id, titulo'),
      ])

      const mapaDemandas = new Map<string, string>()
      ;(demandasRes.data || []).forEach((item) => {
        mapaDemandas.set(item.id, item.titulo || 'Demanda')
      })

      setSolicitacoes(
        (solicitacoesRes.data || []).map((item) => ({
          id: item.id,
          titulo: item.titulo,
          descricao: item.descricao,
          status: item.status,
          categoriaId: null,
          categoriaNome: 'Solicitação direta',
          clienteNome: 'Cliente da plataforma',
          dataPreferida: item.data_preferida,
          orcamentoSugerido: typeof item.orcamento_sugerido === 'number' ? item.orcamento_sugerido : null,
          createdAt: item.created_at,
        })) as SolicitacaoProfissional[]
      )

      setPropostas(
        (propostasRes.data || []).map((item) => ({
          id: item.id,
          demandaId: item.demanda_id,
          tituloDemanda: mapaDemandas.get(item.demanda_id) || 'Demanda publicada',
          mensagem: item.mensagem,
          valorProposto: item.valor_proposto,
          prazo: item.prazo,
          status: item.status,
          createdAt: item.created_at,
        })) as PropostaProfissional[]
      )
      setCarregando(false)
    }

    carregar()
  }, [])

  const compromissos = useMemo<Compromisso[]>(() => {
    const listaSolicitacoes = solicitacoes
      .filter((item) => item.status === 'aceita')
      .map((item) => ({
        id: `sol-${item.id}`,
        titulo: item.titulo,
        detalhe: `Solicitação direta · ${formatarMoeda(item.orcamentoSugerido)}`,
        quando: item.dataPreferida ? formatarData(item.dataPreferida) : 'Sem data combinada',
        tipo: 'solicitacao' as const,
      }))

    const listaPropostas = propostas
      .filter((item) => item.status === 'aceita')
      .map((item) => ({
        id: `prop-${item.id}`,
        titulo: item.tituloDemanda,
        detalhe: `Proposta aceita · ${formatarMoeda(item.valorProposto)}`,
        quando: `Prazo ${item.prazo}`,
        tipo: 'proposta' as const,
      }))

    return [...listaSolicitacoes, ...listaPropostas]
  }, [propostas, solicitacoes])

  return (
    <main className="p-4 space-y-4">
      <section className="bg-gradient-to-br from-teal-700 via-emerald-600 to-lime-500 rounded-[28px] p-5 text-white space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-[0.25em]">Agenda</p>
            <h1 className="text-2xl font-bold mt-1">Compromissos do profissional</h1>
            <p className="text-sm text-white/80 mt-2">
              Um resumo do que já foi aceito para você não perder datas e negociações importantes.
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Resumo titulo="Solicitações aceitas" valor={String(solicitacoes.filter((item) => item.status === 'aceita').length)} />
          <Resumo titulo="Propostas ganhas" valor={String(propostas.filter((item) => item.status === 'aceita').length)} />
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gray-900">Próximos compromissos</h2>
          <p className="text-sm text-gray-500 mt-1">O que já saiu da fase de prospecção e entrou em execução.</p>
        </div>

        {carregando && <p className="text-sm text-gray-500">Carregando agenda...</p>}

        {!carregando && compromissos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Agenda vazia por enquanto</p>
            <p className="text-xs text-gray-500 mt-1">
              Assim que você aceitar solicitações ou tiver propostas aprovadas, os compromissos aparecem aqui.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {compromissos.map((compromisso) => (
            <article key={compromisso.id} className="rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{compromisso.titulo}</p>
                  <p className="text-xs text-gray-500 mt-1">{compromisso.detalhe}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    compromisso.tipo === 'solicitacao'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {compromisso.tipo === 'solicitacao' ? 'Solicitação' : 'Proposta'}
                </span>
              </div>
              <p className="text-sm text-gray-700">{compromisso.quando}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function Resumo(props: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3">
      <p className="text-white/65 text-[11px] uppercase tracking-wide">{props.titulo}</p>
      <p className="text-2xl font-bold mt-1">{props.valor}</p>
    </div>
  )
}
