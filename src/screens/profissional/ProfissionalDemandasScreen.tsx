'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { iconeCategoria } from '@/lib/categorias-ui'
import { DEMANDAS_DEMONSTRACAO } from '@/lib/demo-marketplace'
import { formatarRelativoPt } from '@/lib/formatar-data'
import { nomePlano, obterLimitesPlano } from '@/lib/plano-limites'

type Demanda = {
  id: string
  titulo: string
  descricao: string
  categoria_id: number
  status: string
  created_at: string
  categorias: { nome: string } | null
}

export default function ProfissionalDemandasScreen() {
  const [plano, setPlano] = useState('free')
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('')
  const [demandaSelecionada, setDemandaSelecionada] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const limites = useMemo(() => obterLimitesPlano(plano), [plano])

  const demandasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return demandas
    return demandas.filter((d) => {
      const cat = d.categorias?.nome?.toLowerCase() || ''
      return (
        d.titulo.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q) ||
        cat.includes(q)
      )
    })
  }, [demandas, busca])

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user

      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('plano').eq('id', user.id).maybeSingle()
        setPlano(perfil?.plano || 'free')
      }

      const { data } = await supabase
        .from('demandas')
        .select('id, titulo, descricao, categoria_id, status, created_at, categorias ( nome )')
        .eq('status', 'aberta')
        .order('created_at', { ascending: false })
        .limit(limites.maxDemandasAtivas)

      setDemandas((data as Demanda[] | null) || [])
      setCarregando(false)
    }
    carregar()
  }, [limites.maxDemandasAtivas])

  async function enviarProposta(e: FormEvent) {
    e.preventDefault()
    if (!demandaSelecionada) return
    if (!mensagem.trim() || !valor.trim() || !prazo.trim()) return

    setAviso(null)
    setEnviandoId(demandaSelecionada)
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setAviso('Faça login para enviar proposta.')
      setEnviandoId(null)
      return
    }

    const { count } = await supabase
      .from('propostas')
      .select('*', { count: 'exact', head: true })
      .eq('demanda_id', demandaSelecionada)
      .eq('profissional_id', user.id)

    if ((count || 0) >= limites.maxPropostasPorDemanda) {
      setAviso(`Seu plano ${nomePlano(plano)} permite até ${limites.maxPropostasPorDemanda} proposta(s) por demanda.`)
      setEnviandoId(null)
      return
    }

    const { error } = await supabase.from('propostas').insert({
      demanda_id: demandaSelecionada,
      profissional_id: user.id,
      mensagem: mensagem.trim(),
      valor_proposto: Number(valor.replace(',', '.')),
      prazo: prazo.trim(),
    })

    setEnviandoId(null)
    if (error) {
      setAviso('Falha ao enviar proposta.')
      return
    }

    setMensagem('')
    setValor('')
    setPrazo('')
    setDemandaSelecionada(null)
    setAviso('Proposta enviada com sucesso.')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 pb-10">
      <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-700 text-white px-4 pt-8 pb-10 rounded-b-[2rem] shadow-lg">
        <div className="max-w-lg mx-auto space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Marketplace</p>
          <h1 className="text-2xl font-bold leading-tight">Demandas públicas</h1>
          <p className="text-sm text-white/85 leading-relaxed">
            Pedidos abertos de clientes na sua região e em todo o Brasil. Plano{' '}
            <span className="font-semibold text-white">{nomePlano(plano)}</span>: até{' '}
            {limites.maxDemandasAtivas} demanda(s) reais listadas por vez — abaixo há exemplos para inspiração.
          </p>
          <div className="relative pt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">🔎</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, descrição ou categoria..."
              className="w-full rounded-xl bg-white/15 border border-white/25 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 relative z-10">
        {carregando && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Carregando demandas reais...</p>
          </div>
        )}

        {!carregando && demandasFiltradas.length === 0 && demandas.length > 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Nenhuma demanda combina com a busca. Limpe o filtro para ver todas.
          </p>
        )}

        {!carregando &&
          demandasFiltradas.map((d) => {
            const catNome = d.categorias?.nome || 'Categoria'
            return (
              <article
                key={d.id}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {iconeCategoria(catNome)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {catNome}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-auto">{formatarRelativoPt(d.created_at)}</span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 leading-snug">{d.titulo}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{d.descricao}</p>
                  <button
                    type="button"
                    onClick={() => setDemandaSelecionada((atual) => (atual === d.id ? null : d.id))}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    {demandaSelecionada === d.id ? 'Cancelar proposta' : 'Quero me candidatar'}
                  </button>

                  {demandaSelecionada === d.id && (
                    <form onSubmit={enviarProposta} className="space-y-3 pt-2 border-t border-gray-100">
                      <textarea
                        rows={3}
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Como você executaria o serviço, materiais e disponibilidade"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          placeholder="Valor (R$)"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                        />
                        <input
                          value={prazo}
                          onChange={(e) => setPrazo(e.target.value)}
                          placeholder="Prazo"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={enviandoId === d.id}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 rounded-xl text-sm shadow-md disabled:opacity-50"
                      >
                        {enviandoId === d.id ? 'Enviando...' : 'Enviar proposta'}
                      </button>
                    </form>
                  )}
                </div>
              </article>
            )
          })}

        {!carregando && demandas.length === 0 && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-600 leading-relaxed">
              Ainda não há demandas reais abertas no banco. Peça a clientes de teste que publiquem na área{' '}
              <strong>Cliente → Demandas</strong>, ou rode a migração de categorias e crie demandas pelo app.
            </p>
          </section>
        )}

        {!carregando && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Exemplos inspiradores</h2>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>
            <p className="text-[11px] text-gray-500 px-1">
              Personagens fictícios — servem só para visualizar como seu perfil pode aparecer no fluxo real.
            </p>
            {DEMANDAS_DEMONSTRACAO.map((d) => (
              <article
                key={d.id}
                className="rounded-2xl border border-dashed border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-4 space-y-2 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{iconeCategoria(d.categoriaNome)}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-amber-900/80 bg-amber-100 px-2.5 py-1 rounded-full">
                    {d.categoriaNome}
                  </span>
                  <span className="text-[11px] text-gray-400 ml-auto">{formatarRelativoPt(d.publicadoEm)}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">{d.titulo}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{d.descricao}</p>
                <p className="text-xs text-gray-500 pt-1">
                  <span className="font-semibold text-gray-700">{d.clienteNome}</span>
                  <span className="text-gray-300"> · </span>
                  {d.cidade}
                </p>
              </article>
            ))}
          </section>
        )}

        {aviso && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl p-3 font-medium">{aviso}</p>
        )}
      </div>
    </main>
  )
}
