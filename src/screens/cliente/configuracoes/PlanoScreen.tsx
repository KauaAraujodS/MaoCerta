'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'
import PagarPlanoModal from '@/components/financeiro/PagarPlanoModal'

type PlanoId = 'free' | 'basico' | 'premium'

type Plano = {
  id: PlanoId
  nome: string
  preco: string
  descricao: string
  destaques: string[]
  limites: string[]
  cor: string
}

const PLANOS: Plano[] = [
  {
    id: 'free',
    nome: 'Free',
    preco: 'Grátis',
    descricao: 'Para conhecer a plataforma',
    destaques: ['1 negociação ativa', 'Acesso ao chat com prestador', 'Avaliação após contratação'],
    limites: ['Não publica demanda', 'Sem suporte prioritário'],
    cor: 'from-gray-700 to-gray-900',
  },
  {
    id: 'basico',
    nome: 'Básico',
    preco: 'R$ 0,50/mês',
    descricao: 'Para quem contrata com frequência',
    destaques: [
      'Até 2 demandas ativas',
      '2 prestadores por demanda',
      '5 contatos fora da demanda',
      '2 serviços simultâneos',
    ],
    limites: ['Sem suporte 24/7'],
    cor: 'from-indigo-600 to-blue-500',
  },
  {
    id: 'premium',
    nome: 'Premium Plus',
    preco: 'R$ 1,00/mês',
    descricao: 'Para quem precisa de prioridade',
    destaques: [
      'Demandas ativas ilimitadas',
      '5 serviços simultâneos',
      'Suporte 24/7',
      'Selo de cliente verificado',
    ],
    limites: [],
    cor: 'from-purple-700 via-fuchsia-600 to-pink-500',
  },
]

export default function PlanoScreen() {
  const [planoAtual, setPlanoAtual] = useState<PlanoId>('free')
  const [selecionado, setSelecionado] = useState<PlanoId>('free')
  const [modalAberto, setModalAberto] = useState(false)

  async function recarregarPlano() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('plano').eq('id', user.id).maybeSingle()
    const p = (data?.plano as PlanoId) || 'free'
    setPlanoAtual(p)
    setSelecionado(p)
  }

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .maybeSingle()

      const plano = (data?.plano as PlanoId) || 'free'
      setPlanoAtual(plano)
      setSelecionado(plano)
    }
    carregar()
  }, [])

  const plano = PLANOS.find(p => p.id === selecionado)!
  const ehAtual = selecionado === planoAtual

  return (
    <main className="min-h-screen pb-10">
      <CabecalhoAjuste titulo="Plano" subtitulo="Veja seu plano atual e o que cada um oferece" voltarHref="/cliente/configuracoes" tema="cliente" />
      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 relative z-10">

      <section className={`bg-gradient-to-br ${plano.cor} rounded-3xl p-5 text-white space-y-3`}>
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">
            {ehAtual ? 'Plano atual' : 'Pré-visualização'}
          </span>
          {ehAtual && (
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              ATIVO
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold">{plano.nome}</p>
          <p className="text-white/80 text-sm">{plano.descricao}</p>
        </div>
        <p className="text-3xl font-bold">{plano.preco}</p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {PLANOS.map(p => {
          const ativo = p.id === selecionado
          return (
            <button
              key={p.id}
              onClick={() => setSelecionado(p.id)}
              className={`rounded-2xl py-3 px-2 text-xs font-semibold transition-colors ${
                ativo ? 'bg-purple-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p.nome}
              {p.id === planoAtual && (
                <span className="block text-[9px] mt-0.5 opacity-70">SEU PLANO</span>
              )}
            </button>
          )
        })}
      </div>

      <section className="bg-white rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Inclui</h2>
        <ul className="space-y-2">
          {plano.destaques.map(item => (
            <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {plano.limites.length > 0 && (
        <section className="bg-white rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Limitações</h2>
          <ul className="space-y-2">
            {plano.limites.map(item => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 text-xs font-bold">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ehAtual ? (
        <button
          type="button"
          disabled
          className="w-full bg-gray-200 text-gray-500 font-semibold py-3 rounded-2xl text-sm cursor-not-allowed"
        >
          Você já está nesse plano
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="w-full bg-purple-700 text-white font-semibold py-3 rounded-2xl text-sm hover:bg-purple-800"
        >
          Pagar com Pix · {plano.preco.replace('/mês', '')}
        </button>
      )}

      <p className="text-[11px] text-gray-400 text-center px-6">
        Cobrança única via Pix dentro da plataforma. Mensalidade automática vai chegar em uma próxima atualização.
      </p>
      </div>

      {selecionado !== 'free' && (
        <PagarPlanoModal
          aberto={modalAberto}
          plano={selecionado as 'basico' | 'premium'}
          nomePlano={plano.nome}
          tema="cliente"
          onFechar={() => setModalAberto(false)}
          onPago={recarregarPlano}
        />
      )}
    </main>
  )
}
