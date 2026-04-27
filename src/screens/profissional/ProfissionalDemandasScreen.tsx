'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  contarPendentes,
  DEMO_CATEGORIAS_ATUACAO,
  DEMO_DEMANDAS,
  DEMO_PROPOSTAS,
  formatarData,
  formatarMoeda,
  normalizarPlano,
  PLANOS_PROFISSIONAL,
  statusPropostaMeta,
  textoLimite,
  type CategoriaAtuacao,
  type CategoriaOption,
  type DemandaProfissional,
  type PlanoId,
  type PropostaProfissional,
} from '@/lib/profissional'

type FormProposta = {
  demandaId: string
  mensagem: string
  valor: string
  prazo: string
}

const FORM_VAZIO: FormProposta = {
  demandaId: '',
  mensagem: '',
  valor: '',
  prazo: '2 dias',
}

export default function ProfissionalDemandasScreen() {
  const [plano, setPlano] = useState<PlanoId>('basico')
  const [modoDemo, setModoDemo] = useState(true)
  const [categoriasAtuacao, setCategoriasAtuacao] = useState<CategoriaAtuacao[]>(DEMO_CATEGORIAS_ATUACAO)
  const [demandas, setDemandas] = useState<DemandaProfissional[]>(DEMO_DEMANDAS)
  const [propostas, setPropostas] = useState<PropostaProfissional[]>(DEMO_PROPOSTAS)
  const [formProposta, setFormProposta] = useState<FormProposta>(FORM_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
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

      const [profileRes, categoriasRes, categoriasAtuacaoRes, propostasRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase
          .from('profissional_categorias')
          .select('id, categoria_id, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('propostas')
          .select('id, demanda_id, mensagem, valor_proposto, prazo, status, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      const planoAtual = normalizarPlano(profileRes.data?.plano)
      setPlano(planoAtual)

      const mapaCategorias = new Map<number, string>()
      ;((categoriasRes.data as CategoriaOption[] | null) || []).forEach((item) => {
        mapaCategorias.set(item.id, item.nome)
      })

      const categoriasMapeadas = (categoriasAtuacaoRes.data || []).map((item) => ({
        id: item.id,
        categoriaId: item.categoria_id,
        nome: mapaCategorias.get(item.categoria_id) || 'Categoria',
        createdAt: item.created_at,
      }))
      setCategoriasAtuacao(categoriasMapeadas)

      const idsCategorias = categoriasMapeadas.map((item) => item.categoriaId)
      const limiteConsulta = planoAtual === 'premium' ? 200 : PLANOS_PROFISSIONAL[planoAtual].limites.demandasVisiveis

      let demandasQuery = supabase
        .from('demandas')
        .select('id, titulo, descricao, categoria_id, status, created_at')
        .eq('status', 'aberta')
        .order('created_at', { ascending: false })
        .limit(limiteConsulta)

      if (idsCategorias.length > 0) {
        demandasQuery = demandasQuery.in('categoria_id', idsCategorias)
      }

      const demandasRes = await demandasQuery

      if (profileRes.error || categoriasRes.error || categoriasAtuacaoRes.error || demandasRes.error || propostasRes.error) {
        setAviso({
          tipo: 'erro',
          texto: 'O mural completo depende da migration 007 no Supabase. Mesmo assim, você já consegue visualizar a estrutura da funcionalidade.',
        })
      }

      const demandasMapeadas = (demandasRes.data || []).map((item) => ({
        id: item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        categoriaId: item.categoria_id,
        categoriaNome: mapaCategorias.get(item.categoria_id) || 'Categoria',
        status: item.status,
        createdAt: item.created_at,
      })) as DemandaProfissional[]

      const titulosDemanda = new Map<string, string>()
      demandasMapeadas.forEach((item) => titulosDemanda.set(item.id, item.titulo))

      const demandasFaltantes = Array.from(
        new Set((propostasRes.data || []).map((item) => item.demanda_id).filter((id) => !titulosDemanda.has(id)))
      )

      if (demandasFaltantes.length > 0) {
        const demandasPropostasRes = await supabase
          .from('demandas')
          .select('id, titulo')
          .in('id', demandasFaltantes)

        ;(demandasPropostasRes.data || []).forEach((item) => {
          titulosDemanda.set(item.id, item.titulo || 'Demanda publicada')
        })
      }

      setDemandas(demandasMapeadas)
      setPropostas(
        (propostasRes.data || []).map((item) => ({
          id: item.id,
          demandaId: item.demanda_id,
          tituloDemanda: titulosDemanda.get(item.demanda_id) || 'Demanda publicada',
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

  const planoAtual = PLANOS_PROFISSIONAL[plano]
  const propostasPendentes = useMemo(() => contarPendentes(propostas), [propostas])

  function abrirFormulario(demandaId: string) {
    setFormProposta({
      demandaId,
      mensagem: '',
      valor: '',
      prazo: '2 dias',
    })
  }

  async function enviarProposta() {
    setAviso(null)

    const demanda = demandas.find((item) => item.id === formProposta.demandaId)
    if (!demanda) {
      setAviso({ tipo: 'erro', texto: 'Escolha uma demanda para enviar a proposta.' })
      return
    }

    if (!formProposta.mensagem.trim() || !formProposta.valor.trim() || !formProposta.prazo.trim()) {
      setAviso({ tipo: 'erro', texto: 'Preencha mensagem, valor e prazo para enviar a proposta.' })
      return
    }

    const limite = planoAtual.limites.propostasPendentes
    if (propostasPendentes >= limite) {
      setAviso({ tipo: 'erro', texto: `Seu plano ${planoAtual.nome} permite até ${textoLimite(limite)} proposta(s) pendente(s).` })
      return
    }

    const valor = Number(formProposta.valor.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setAviso({ tipo: 'erro', texto: 'Informe um valor válido para a proposta.' })
      return
    }

    const propostaMapeada: PropostaProfissional = {
      id: `prop-${Date.now()}`,
      demandaId: demanda.id,
      tituloDemanda: demanda.titulo,
      mensagem: formProposta.mensagem.trim(),
      valorProposto: valor,
      prazo: formProposta.prazo.trim(),
      status: 'pendente',
      createdAt: new Date().toISOString(),
    }

    if (modoDemo) {
      setPropostas((atual) => [propostaMapeada, ...atual])
      setFormProposta(FORM_VAZIO)
      setAviso({ tipo: 'ok', texto: 'Proposta adicionada na demonstração. Faça login para persistir no Supabase.' })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para enviar propostas reais.' })
      return
    }

    setEnviando(true)
    const { data, error } = await supabase
      .from('propostas')
      .insert({
        demanda_id: demanda.id,
        profissional_id: user.id,
        mensagem: propostaMapeada.mensagem,
        valor_proposto: propostaMapeada.valorProposto,
        prazo: propostaMapeada.prazo,
      })
      .select('id, demanda_id, mensagem, valor_proposto, prazo, status, created_at')
      .maybeSingle()
    setEnviando(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Enviar proposta: ${error.message}` })
      return
    }

    setPropostas((atual) => [
      {
        id: data?.id || propostaMapeada.id,
        demandaId: data?.demanda_id || propostaMapeada.demandaId,
        tituloDemanda: demanda.titulo,
        mensagem: data?.mensagem || propostaMapeada.mensagem,
        valorProposto: data?.valor_proposto || propostaMapeada.valorProposto,
        prazo: data?.prazo || propostaMapeada.prazo,
        status: (data?.status || 'pendente') as PropostaProfissional['status'],
        createdAt: data?.created_at || propostaMapeada.createdAt,
      },
      ...atual,
    ])
    setFormProposta(FORM_VAZIO)
    setAviso({ tipo: 'ok', texto: 'Proposta enviada com sucesso.' })
  }

  return (
    <main className="p-4 space-y-4">
      <section className={`bg-gradient-to-br ${planoAtual.cor} rounded-[28px] p-5 text-white space-y-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-[0.25em]">RF13 e RF14</p>
            <h1 className="text-2xl font-bold mt-1">Demandas e propostas</h1>
            <p className="text-sm text-white/80 mt-2">
              Seu plano {planoAtual.nome} libera até {textoLimite(planoAtual.limites.demandasVisiveis)} demanda(s)
              visíveis e {textoLimite(planoAtual.limites.propostasPendentes)} proposta(s) pendente(s).
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {categoriasAtuacao.map((categoria) => (
            <span key={categoria.id} className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold">
              {categoria.nome}
            </span>
          ))}
          {categoriasAtuacao.length === 0 && (
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/80">
              Cadastre categorias para receber demandas mais alinhadas
            </span>
          )}
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
            <h2 className="text-base font-bold text-gray-900">Mural de demandas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Oportunidades publicadas por clientes e filtradas pelo seu plano.
            </p>
          </div>
          <Link
            href="/profissional/configuracoes/conta"
            className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Ajustar categorias
          </Link>
        </div>

        {carregando && <p className="text-sm text-gray-500">Carregando demandas...</p>}

        {!carregando && demandas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Nenhuma demanda no seu recorte atual</p>
            <p className="text-xs text-gray-500 mt-1">
              Complete suas categorias ou aguarde novas publicações de clientes no mural.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {demandas.map((demanda) => {
            const propostaJaEnviada = propostas.some((item) => item.demandaId === demanda.id && item.status !== 'recusada')
            const formularioAberto = formProposta.demandaId === demanda.id

            return (
              <article key={demanda.id} className="rounded-3xl border border-gray-100 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{demanda.titulo}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">{demanda.categoriaNome}</span>
                      <span>{formatarData(demanda.createdAt)}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Aberta
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{demanda.descricao}</p>

                {!formularioAberto && (
                  <button
                    type="button"
                    onClick={() => abrirFormulario(demanda.id)}
                    disabled={propostaJaEnviada}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                      propostaJaEnviada
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                  >
                    {propostaJaEnviada ? 'Proposta já enviada' : 'Enviar proposta'}
                  </button>
                )}

                {formularioAberto && (
                  <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
                    <CampoTexto
                      label="Mensagem"
                      valor={formProposta.mensagem}
                      placeholder="Explique como você atenderia essa demanda."
                      rows={4}
                      onChange={(valor) => setFormProposta((atual) => ({ ...atual, mensagem: valor }))}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Campo
                        label="Valor proposto"
                        valor={formProposta.valor}
                        placeholder="Ex.: 350"
                        onChange={(valor) => setFormProposta((atual) => ({ ...atual, valor }))}
                      />
                      <Campo
                        label="Prazo"
                        valor={formProposta.prazo}
                        placeholder="Ex.: 2 dias"
                        onChange={(valor) => setFormProposta((atual) => ({ ...atual, prazo: valor }))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={enviarProposta}
                        disabled={enviando}
                        className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {enviando ? 'Enviando...' : 'Confirmar proposta'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormProposta(FORM_VAZIO)}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Propostas enviadas</h2>
            <p className="text-sm text-gray-500 mt-1">Acompanhe negociações em andamento e respostas dos clientes.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            {propostasPendentes} pendente(s)
          </span>
        </div>

        {propostas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Nenhuma proposta enviada</p>
            <p className="text-xs text-gray-500 mt-1">
              Quando você responder uma demanda publicada, a negociação aparecerá aqui.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {propostas.map((proposta) => {
            const meta = statusPropostaMeta(proposta.status)

            return (
              <article key={proposta.id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{proposta.tituloDemanda}</p>
                    <p className="text-xs text-gray-500 mt-1">Enviada em {formatarData(proposta.createdAt)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.classe}`}>
                    {meta.texto}
                  </span>
                </div>

                <p className="text-sm text-gray-600">{proposta.mensagem}</p>

                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="rounded-full bg-gray-100 px-3 py-1.5">{formatarMoeda(proposta.valorProposto)}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1.5">Prazo: {proposta.prazo}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function Campo(props: {
  label: string
  valor: string
  placeholder: string
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <input
        type="text"
        value={props.valor}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
      />
    </label>
  )
}

function CampoTexto(props: {
  label: string
  valor: string
  placeholder: string
  rows?: number
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <textarea
        value={props.valor}
        placeholder={props.placeholder}
        rows={props.rows || 4}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 resize-none"
      />
    </label>
  )
}
