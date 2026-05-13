'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'

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
    descricao: 'Para começar a receber demandas',
    destaques: [
      'Aparece nos resultados de busca',
      '1 demanda ativa por vez',
      'Receba avaliações dos clientes',
    ],
    limites: ['Sem destaque na busca', 'Sem suporte prioritário', 'Sem selo verificado'],
    cor: 'from-gray-700 to-gray-900',
  },
  {
    id: 'basico',
    nome: 'Pro',
    preco: 'R$ 29,90/mês',
    descricao: 'Para crescer com mais leads',
    destaques: [
      'Até 5 demandas ativas',
      'Posição melhor nos resultados',
      'Selo "Pro" no perfil',
      'Estatísticas semanais de visualização',
    ],
    limites: ['Sem destaque máximo', 'Sem suporte 24/7'],
    cor: 'from-emerald-600 to-teal-500',
  },
  {
    id: 'premium',
    nome: 'Premium Pro',
    preco: 'R$ 59,90/mês',
    descricao: 'Para quem vive da plataforma',
    destaques: [
      'Demandas ativas ilimitadas',
      'Topo da busca em sua categoria',
      'Selo verificado destacado',
      'Suporte 24/7 com prioridade',
      'Repasse mais rápido (24h)',
    ],
    limites: [],
    cor: 'from-purple-700 via-fuchsia-600 to-pink-500',
  },
]

export default function PlanoProfissionalScreen() {
  const [planoAtual, setPlanoAtual] = useState<PlanoId>('free')
  const [selecionado, setSelecionado] = useState<PlanoId>('free')

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
      <CabecalhoAjuste titulo="Plano" subtitulo="Veja seu plano atual e o que cada um oferece" voltarHref="/profissional/configuracoes" tema="prestador" />
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
                ativo ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
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

      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-xl">🔒</span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-900">Mudança de plano em breve</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            A troca de plano só será liberada após a confirmação do pagamento. Estamos finalizando a integração
            com Pix e cartão — até lá, todos os prestadores ficam no plano <strong>{PLANOS.find(p => p.id === planoAtual)?.nome}</strong>.
          </p>
        </div>
      </section>

      <button
        type="button"
        disabled
        className="w-full bg-gray-200 text-gray-500 font-semibold py-3 rounded-2xl text-sm cursor-not-allowed"
      >
        {ehAtual ? 'Você já está nesse plano' : `Assinar ${plano.nome} (em breve)`}
      </button>

      <p className="text-[11px] text-gray-400 text-center px-6">
        Cobrança via Pix ou cartão. Cancelamento sem multa a qualquer momento.
      </p>
      </div>
    </main>
  )
}
