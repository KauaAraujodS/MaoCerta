'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { iconeCategoria } from '@/lib/categorias-ui'
import { formatarDataPt, formatarRelativoPt } from '@/lib/formatar-data'
import { obterLimitesPlano, nomePlano } from '@/lib/plano-limites'
import PerfilModal from '@/screens/perfil/PerfilModal'

type Demanda = {
  id: string
  titulo: string
  descricao: string
  status: string
  created_at: string
  cliente_id: string
  categorias: { nome: string } | null
}

type Proposta = {
  id: string
  profissional_id: string
  mensagem: string
  valor_proposto: number
  prazo: string
  status: string
  created_at: string
  profissional: {
    id: string
    nome: string
    avatar_url: string | null
    cidade: string | null
    estado: string | null
    experiencia_anos: number | null
  } | null
}

function formatarValor(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function badgeStatusProposta(status: string) {
  switch (status) {
    case 'aceita':
      return { label: '✓ Escolhido', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    case 'suplente':
      return { label: 'Suplente', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'recusada':
      return { label: 'Recusada', className: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return { label: 'Aguardando escolha', className: 'bg-amber-50 text-amber-900 border-amber-200' }
  }
}

export default function ClienteDemandaDetalheScreen({ id }: { id: string }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [demanda, setDemanda] = useState<Demanda | null>(null)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [plano, setPlano] = useState<string>('free')
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null)

  const limites = useMemo(() => obterLimitesPlano(plano), [plano])
  const propostasVisiveis = useMemo(
    () => propostas.slice(0, limites.maxPropostasPorDemanda),
    [propostas, limites.maxPropostasPorDemanda],
  )
  const escondidasPorPlano = propostas.length - propostasVisiveis.length
  const propostaAceita = useMemo(() => propostas.find((p) => p.status === 'aceita'), [propostas])

  useEffect(() => {
    carregar()
  }, [id])

  async function carregar() {
    setCarregando(true)
    setAviso(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para ver esta demanda.' })
      setCarregando(false)
      return
    }

    const [demRes, propRes, perfilRes] = await Promise.all([
      supabase
        .from('demandas')
        .select(`id, titulo, descricao, status, created_at, cliente_id, categorias ( nome )`)
        .eq('id', id)
        .eq('cliente_id', user.id)
        .maybeSingle(),
      supabase
        .from('propostas')
        .select(`
          id, profissional_id, mensagem, valor_proposto, prazo, status, created_at,
          profissional:profissional_id ( id, nome, avatar_url, cidade, estado, experiencia_anos )
        `)
        .eq('demanda_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('plano').eq('id', user.id).maybeSingle(),
    ])

    if (demRes.error || !demRes.data) {
      setAviso({ tipo: 'erro', texto: demRes.error?.message || 'Demanda não encontrada.' })
    } else {
      setDemanda(demRes.data as unknown as Demanda)
    }

    setPropostas((propRes.data as unknown as Proposta[]) || [])
    setPlano((perfilRes.data?.plano as string) || 'free')
    setCarregando(false)
  }

  async function escolherProposta(proposta: Proposta) {
    if (!demanda) return

    setAcaoEmCurso(proposta.id)
    setAviso(null)
    const supabase = createClient()

    // RF28 — limite de serviços simultâneos aceitos pelo cliente
    const { count } = await supabase
      .from('solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', demanda.cliente_id)
      .in('status', ['aceita', 'em_andamento'])
    if ((count ?? 0) >= limites.maxServicosSimultaneosCliente) {
      setAcaoEmCurso(null)
      setAviso({
        tipo: 'erro',
        texto: `Você já tem ${count} serviço(s) ativo(s). Limite do plano ${nomePlano(plano)}: ${limites.maxServicosSimultaneosCliente}. Conclua algum ou faça upgrade.`,
      })
      return
    }

    if (!confirm(`Escolher ${proposta.profissional?.nome || 'este prestador'} por ${formatarValor(Number(proposta.valor_proposto))}?\n\nIsso abre um atendimento e marca as outras propostas como suplentes.`)) {
      setAcaoEmCurso(null)
      return
    }

    // 1) Cria solicitação aceita ligada à demanda + proposta
    const { data: solCriada, error: erroSol } = await supabase
      .from('solicitacoes')
      .insert({
        cliente_id: demanda.cliente_id,
        profissional_id: proposta.profissional_id,
        titulo: demanda.titulo,
        descricao: demanda.descricao,
        status: 'aceita',
        demanda_origem_id: demanda.id,
        proposta_origem_id: proposta.id,
      })
      .select('id')
      .single()
    if (erroSol || !solCriada) {
      setAcaoEmCurso(null)
      setAviso({ tipo: 'erro', texto: `Falha ao abrir atendimento: ${erroSol?.message || 'sem id'}` })
      return
    }

    // 1b) Copia o valor da proposta pro atendimento — dispara a divisão entre etapas.
    // O prestador foi quem definiu o valor na proposta; o cliente apenas concordou ao escolher.
    await supabase
      .from('solicitacoes')
      .update({ valor_total_servico: Number(proposta.valor_proposto) })
      .eq('id', solCriada.id)

    // 2) Marca proposta como aceita (trigger faz as outras virarem suplente)
    const { error: erroProp } = await supabase
      .from('propostas')
      .update({ status: 'aceita' })
      .eq('id', proposta.id)

    setAcaoEmCurso(null)

    if (erroProp) {
      setAviso({ tipo: 'erro', texto: `Atendimento criado, mas falhou ao marcar proposta: ${erroProp.message}` })
      return
    }

    setAviso({ tipo: 'ok', texto: 'Prestador escolhido. Indo para o chat...' })
    setTimeout(() => router.push('/cliente/atendimentos'), 1000)
  }

  const cat = demanda?.categorias?.nome || 'Categoria'

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white pb-10">
      <header className="min-h-[200px] flex items-end bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-600 text-white px-4 pt-8 pb-12 rounded-b-[2rem] shadow-lg">
        <div className="max-w-lg mx-auto w-full space-y-3">
          <Link
            href="/cliente/demandas"
            className="inline-flex items-center gap-1 text-white/85 text-sm font-medium hover:text-white"
          >
            <span className="text-base">‹</span> Voltar para minhas demandas
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">Sua demanda</p>
          <h1 className="text-2xl font-bold">{demanda?.titulo || (carregando ? 'Carregando...' : 'Demanda')}</h1>
          {demanda && (
            <p className="text-sm text-white/85 leading-relaxed">
              {iconeCategoria(cat)} {cat} · publicada {formatarRelativoPt(demanda.created_at)}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 relative z-10">
        {aviso && (
          <p
            className={`text-xs rounded-2xl p-3 font-medium ${
              aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {carregando && (
          <div className="bg-white rounded-3xl p-6 shadow border border-gray-100 flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Carregando...</p>
          </div>
        )}

        {!carregando && demanda && (
          <>
            <section className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Descrição</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{demanda.descricao}</p>
              <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                Aberta em {formatarDataPt(demanda.created_at)} · status:{' '}
                <span className="font-semibold text-gray-600">{demanda.status.replace(/_/g, ' ')}</span>
              </p>
            </section>

            {propostaAceita && (
              <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Prestador escolhido</p>
                <p className="text-sm text-emerald-900">
                  {propostaAceita.profissional?.nome || '—'} ·{' '}
                  {formatarValor(Number(propostaAceita.valor_proposto))} · {propostaAceita.prazo}
                </p>
                <Link
                  href="/cliente/atendimentos"
                  className="inline-block text-xs font-bold text-emerald-700 hover:text-emerald-900 mt-1"
                >
                  Abrir conversa ›
                </Link>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Propostas recebidas ({propostas.length})
                </h2>
                <span className="text-[11px] text-gray-400">
                  Plano {nomePlano(plano)}: até {limites.maxPropostasPorDemanda}/demanda
                </span>
              </div>

              {propostas.length === 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center space-y-1">
                  <p className="text-3xl">⏳</p>
                  <p className="text-sm font-semibold text-gray-800">Nenhuma proposta ainda</p>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                    Aguarde — prestadores compatíveis com sua categoria vão enviar propostas com valor e prazo.
                  </p>
                </div>
              )}

              {propostasVisiveis.map((p) => {
                const badge = badgeStatusProposta(p.status)
                const prest = p.profissional
                const local = [prest?.cidade, prest?.estado].filter(Boolean).join(' - ')
                const podeEscolher = !propostaAceita && p.status === 'pendente'
                const acao = acaoEmCurso === p.id

                return (
                  <article
                    key={p.id}
                    className={`bg-white rounded-2xl border-2 p-4 space-y-3 ${
                      p.status === 'aceita' ? 'border-emerald-300' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => prest && setPerfilAberto(prest.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-gray-50 rounded-xl p-1 -m-1"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-200 to-indigo-200 flex items-center justify-center text-base font-bold text-purple-900 overflow-hidden shrink-0">
                          {prest?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={prest.avatar_url} alt={prest.nome} className="w-full h-full object-cover" />
                          ) : (
                            (prest?.nome || '?').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{prest?.nome || 'Prestador'}</p>
                          {(local || prest?.experiencia_anos) && (
                            <p className="text-[11px] text-gray-500 truncate">
                              {local && <>📍 {local}</>}
                              {prest?.experiencia_anos != null && <> · {prest.experiencia_anos}a exp.</>}
                            </p>
                          )}
                        </div>
                      </button>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border whitespace-nowrap ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-purple-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Valor</p>
                        <p className="text-base font-bold text-gray-900 mt-0.5">
                          {formatarValor(Number(p.valor_proposto))}
                        </p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Prazo</p>
                        <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{p.prazo}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mensagem</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{p.mensagem}</p>
                    </div>

                    <p className="text-[10px] text-gray-400">{formatarRelativoPt(p.created_at)}</p>

                    {podeEscolher && (
                      <button
                        type="button"
                        onClick={() => escolherProposta(p)}
                        disabled={acao}
                        className="w-full bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-purple-800 disabled:opacity-50"
                      >
                        {acao ? 'Escolhendo...' : 'Escolher este prestador'}
                      </button>
                    )}
                  </article>
                )
              })}

              {escondidasPorPlano > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  +{escondidasPorPlano} proposta(s) ocultas pelo plano {nomePlano(plano)}.{' '}
                  <Link href="/cliente/configuracoes/plano" className="font-bold hover:underline">
                    Faça upgrade
                  </Link>{' '}
                  para ver todas.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <PerfilModal
        perfilId={perfilAberto || ''}
        aberto={!!perfilAberto}
        onFechar={() => setPerfilAberto(null)}
        rotulo="Prestador"
      />
    </main>
  )
}
