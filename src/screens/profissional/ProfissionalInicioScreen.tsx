'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  contarPendentes,
  DEMO_CATEGORIAS_ATUACAO,
  DEMO_DEMANDAS,
  DEMO_DOCUMENTOS,
  DEMO_PROPOSTAS,
  DEMO_SERVICOS,
  DEMO_SOLICITACOES,
  DocumentoProfissional,
  normalizarPlano,
  PLANOS_PROFISSIONAL,
  PropostaProfissional,
  ServicoProfissional,
  SolicitacaoProfissional,
  statusSolicitacaoMeta,
  textoLimite,
  type CategoriaAtuacao,
  type CategoriaOption,
  type DemandaProfissional,
  type PlanoId,
} from '@/lib/profissional'

type ResumoPerfil = {
  nome: string
  plano: PlanoId
  bio: string
  experienciaAnos: number | null
  historicoProfissional: string
}

const PERFIL_DEMO: ResumoPerfil = {
  nome: 'Prestador Demo',
  plano: 'basico',
  bio: 'Especialista em instalações residenciais e pequenos reparos com atendimento ágil.',
  experienciaAnos: 7,
  historicoProfissional: 'Atuei com manutenção predial, montagem de móveis planejados e serviços sob demanda para condomínios.',
}

export default function ProfissionalInicioScreen() {
  const [perfil, setPerfil] = useState<ResumoPerfil>(PERFIL_DEMO)
  const [categorias, setCategorias] = useState<CategoriaAtuacao[]>(DEMO_CATEGORIAS_ATUACAO)
  const [servicos, setServicos] = useState<ServicoProfissional[]>(DEMO_SERVICOS)
  const [documentos, setDocumentos] = useState<DocumentoProfissional[]>(DEMO_DOCUMENTOS)
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoProfissional[]>(DEMO_SOLICITACOES)
  const [demandas, setDemandas] = useState<DemandaProfissional[]>(DEMO_DEMANDAS)
  const [propostas, setPropostas] = useState<PropostaProfissional[]>(DEMO_PROPOSTAS)
  const [carregando, setCarregando] = useState(true)
  const [modoDemo, setModoDemo] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setModoDemo(true)
        setCarregando(false)
        return
      }

      setModoDemo(false)

      const profileRes = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const plano = normalizarPlano(profileRes.data?.plano)
      const configPlano = PLANOS_PROFISSIONAL[plano]

      setPerfil({
        nome: profileRes.data?.nome || user.email?.split('@')[0] || 'Prestador',
        plano,
        bio: profileRes.data?.bio || '',
        experienciaAnos:
          typeof profileRes.data?.experiencia_anos === 'number' ? profileRes.data.experiencia_anos : null,
        historicoProfissional: profileRes.data?.historico_profissional || '',
      })

      const [
        categoriasTodasRes,
        categoriasProfissionalRes,
        servicosRes,
        documentosRes,
        solicitacoesRes,
        demandasRes,
        propostasRes,
      ] = await Promise.all([
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase
          .from('profissional_categorias')
          .select('id, categoria_id, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('servicos')
          .select('id, titulo, descricao, categoria_id, valor_hora, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('documentos_profissionais')
          .select('id, tipo_documento, nome_arquivo, arquivo_path, mime_type, status, observacoes, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('solicitacoes_profissionais')
          .select('id, cliente_id, categoria_id, titulo, descricao, data_preferida, orcamento_sugerido, status, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('demandas')
          .select('id, titulo, descricao, categoria_id, status, created_at')
          .eq('status', 'aberta')
          .order('created_at', { ascending: false })
          .limit(configPlano.limites.demandasVisiveis),
        supabase
          .from('propostas')
          .select('id, demanda_id, mensagem, valor_proposto, prazo, status, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      const mensagensErro = [
        profileRes.error,
        categoriasTodasRes.error,
        categoriasProfissionalRes.error,
        servicosRes.error,
        documentosRes.error,
        solicitacoesRes.error,
        demandasRes.error,
        propostasRes.error,
      ].filter(Boolean)

      if (mensagensErro.length > 0) {
        setAviso('Alguns dados dependem da migration 007 aplicada no Supabase. O dashboard continua funcional em modo parcial.')
      }

      const mapaCategorias = new Map<number, string>()
      ;(categoriasTodasRes.data as CategoriaOption[] | null)?.forEach((item) => {
        mapaCategorias.set(item.id, item.nome)
      })

      const categoriasSelecionadas = (categoriasProfissionalRes.data || []).map((item) => ({
        id: item.id,
        categoriaId: item.categoria_id,
        nome: mapaCategorias.get(item.categoria_id) || 'Categoria',
        createdAt: item.created_at,
      }))

      const servicosMapeados = (servicosRes.data || []).map((item) => ({
        id: item.id,
        titulo: item.titulo || item.descricao || 'Serviço',
        descricao: item.descricao || '',
        categoriaId: item.categoria_id,
        categoriaNome: mapaCategorias.get(item.categoria_id) || 'Categoria',
        valorHora: typeof item.valor_hora === 'number' ? item.valor_hora : null,
        createdAt: item.created_at,
      }))

      const documentosMapeados = (documentosRes.data || []).map((item) => ({
        id: item.id,
        tipoDocumento: item.tipo_documento,
        nomeArquivo: item.nome_arquivo,
        arquivoPath: item.arquivo_path,
        mimeType: item.mime_type,
        status: item.status,
        observacoes: item.observacoes,
        createdAt: item.created_at,
      })) as DocumentoProfissional[]

      const nomesClientes = new Map<string, string>()
      const clienteIds = Array.from(
        new Set((solicitacoesRes.data || []).map((item) => item.cliente_id).filter(Boolean))
      )

      if (clienteIds.length > 0) {
        const clientesRes = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', clienteIds)

        ;(clientesRes.data || []).forEach((item) => {
          nomesClientes.set(item.id, item.nome || 'Cliente')
        })
      }

      const solicitacoesMapeadas = (solicitacoesRes.data || []).map((item) => ({
        id: item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        status: item.status,
        categoriaId: item.categoria_id,
        categoriaNome: item.categoria_id ? mapaCategorias.get(item.categoria_id) || 'Categoria' : 'Sem categoria',
        clienteNome: nomesClientes.get(item.cliente_id) || 'Cliente da plataforma',
        dataPreferida: item.data_preferida,
        orcamentoSugerido:
          typeof item.orcamento_sugerido === 'number' ? item.orcamento_sugerido : null,
        createdAt: item.created_at,
      })) as SolicitacaoProfissional[]

      const demandasMapeadas = (demandasRes.data || []).map((item) => ({
        id: item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        categoriaId: item.categoria_id,
        categoriaNome: mapaCategorias.get(item.categoria_id) || 'Categoria',
        status: item.status,
        createdAt: item.created_at,
      })) as DemandaProfissional[]

      const tituloDemanda = new Map<string, string>()
      demandasMapeadas.forEach((item) => {
        tituloDemanda.set(item.id, item.titulo)
      })

      const propostasIdsDemanda = Array.from(
        new Set((propostasRes.data || []).map((item) => item.demanda_id).filter(Boolean))
      )

      if (propostasIdsDemanda.length > 0) {
        const demandasDasPropostasRes = await supabase
          .from('demandas')
          .select('id, titulo')
          .in('id', propostasIdsDemanda)

        ;(demandasDasPropostasRes.data || []).forEach((item) => {
          tituloDemanda.set(item.id, item.titulo || 'Demanda')
        })
      }

      const propostasMapeadas = (propostasRes.data || []).map((item) => ({
        id: item.id,
        demandaId: item.demanda_id,
        tituloDemanda: tituloDemanda.get(item.demanda_id) || 'Demanda publicada',
        mensagem: item.mensagem,
        valorProposto: item.valor_proposto,
        prazo: item.prazo,
        status: item.status,
        createdAt: item.created_at,
      })) as PropostaProfissional[]

      setCategorias(categoriasSelecionadas)
      setServicos(servicosMapeados)
      setDocumentos(documentosMapeados)
      setSolicitacoes(solicitacoesMapeadas)
      setDemandas(demandasMapeadas)
      setPropostas(propostasMapeadas)
      setCarregando(false)
    }

    carregar()
  }, [])

  const planoAtual = PLANOS_PROFISSIONAL[perfil.plano]
  const propostasPendentes = useMemo(() => contarPendentes(propostas), [propostas])
  const documentosAprovados = documentos.filter((item) => item.status === 'aprovado').length
  const perfilCompleto = Boolean(
    perfil.bio.trim() &&
    perfil.historicoProfissional.trim() &&
    categorias.length > 0 &&
    servicos.length > 0 &&
    documentos.length > 0
  )

  return (
    <main className="p-4 space-y-4">
      <section className={`bg-gradient-to-br ${planoAtual.cor} rounded-[28px] p-5 text-white space-y-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-white/70 text-xs uppercase tracking-[0.25em]">Painel do prestador</p>
            <h1 className="text-2xl font-bold leading-tight">{perfil.nome}</h1>
            <p className="text-sm text-white/80">
              Plano {planoAtual.nome} · {planoAtual.selo}
            </p>
          </div>
          <span className="bg-white/15 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ResumoNumero
            titulo="Categorias"
            valor={String(categorias.length)}
            detalhe={`Limite ${textoLimite(planoAtual.limites.categorias)}`}
          />
          <ResumoNumero
            titulo="Serviços"
            valor={String(servicos.length)}
            detalhe={`Limite ${textoLimite(planoAtual.limites.servicos)}`}
          />
          <ResumoNumero
            titulo="Solicitações"
            valor={String(solicitacoes.filter((item) => item.status === 'pendente').length)}
            detalhe="Aguardando retorno"
          />
          <ResumoNumero
            titulo="Propostas"
            valor={String(propostasPendentes)}
            detalhe={`Limite ${textoLimite(planoAtual.limites.propostasPendentes)}`}
          />
        </div>
      </section>

      {aviso && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Integração parcial</p>
          <p className="text-xs text-amber-800 mt-1">{aviso}</p>
        </section>
      )}

      {carregando && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Carregando painel do profissional...</p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <CardAcao
          href="/profissional/configuracoes/conta"
          titulo="Perfil profissional"
          descricao="Descrição, experiência, categorias e serviços"
          icone="🧰"
        />
        <CardAcao
          href="/profissional/configuracoes/documentos"
          titulo="Documentos"
          descricao="Envie arquivos para validação"
          icone="🪪"
        />
        <CardAcao
          href="/profissional/atendimentos"
          titulo="Solicitações"
          descricao="Pedidos diretos enviados por clientes"
          icone="🤝"
        />
        <CardAcao
          href="/profissional/demandas"
          titulo="Demandas e propostas"
          descricao="Mural de oportunidades do plano"
          icone="📋"
        />
      </section>

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Checklist do perfil</h2>
            <p className="text-sm text-gray-500">Tudo o que fortalece sua presença no app</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
              perfilCompleto ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {perfilCompleto ? 'Perfil pronto' : 'Perfil em evolução'}
          </span>
        </div>

        <div className="space-y-3">
          <LinhaChecklist titulo="Descrição profissional preenchida" concluido={Boolean(perfil.bio.trim())} />
          <LinhaChecklist titulo="Experiência e histórico informados" concluido={Boolean(perfil.experienciaAnos || perfil.historicoProfissional.trim())} />
          <LinhaChecklist titulo="Categorias de atuação cadastradas" concluido={categorias.length > 0} />
          <LinhaChecklist titulo="Serviços específicos publicados" concluido={servicos.length > 0} />
          <LinhaChecklist titulo="Documentação enviada para validação" concluido={documentos.length > 0} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        <PainelLista
          titulo="Solicitações recentes"
          subtitulo="RF12 · clientes que te chamaram diretamente"
          href="/profissional/atendimentos"
          hrefTexto="Ver todas"
        >
          {solicitacoes.slice(0, 2).map((item) => (
            <SolicitacaoCard key={item.id} solicitacao={item} />
          ))}
          {solicitacoes.length === 0 && (
            <Vazio
              titulo="Nenhuma solicitação por enquanto"
              descricao="Quando um cliente pedir atendimento direto no seu perfil, ela vai aparecer aqui."
            />
          )}
        </PainelLista>

        <PainelLista
          titulo="Demandas com seu perfil"
          subtitulo="RF13 · oportunidades liberadas pelo seu plano"
          href="/profissional/demandas"
          hrefTexto="Explorar mural"
        >
          {demandas.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.titulo}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.categoriaNome}</p>
                </div>
                <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  Aberta
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{item.descricao}</p>
            </div>
          ))}
          {demandas.length === 0 && (
            <Vazio
              titulo="Nenhuma demanda disponível"
              descricao="Ajuste suas categorias ou aguarde novas publicações dos clientes."
            />
          )}
        </PainelLista>

        <PainelLista
          titulo="Validação e propostas"
          subtitulo="RF11 e RF14 · documentação enviada e negociações abertas"
          href="/profissional/configuracoes/documentos"
          hrefTexto="Abrir documentos"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniCard titulo="Documentos aprovados" valor={String(documentosAprovados)} descricao={`${documentos.length} enviados`} />
            <MiniCard titulo="Propostas pendentes" valor={String(propostasPendentes)} descricao={`de ${textoLimite(planoAtual.limites.propostasPendentes)}`} />
          </div>
          {propostas.slice(0, 2).map((item) => (
            <div key={item.id} className="rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-sm text-gray-900">{item.tituloDemanda}</p>
                <StatusChip classe="bg-amber-50 text-amber-700 border-amber-200">
                  {item.status === 'aceita' ? 'Aceita' : item.status === 'recusada' ? 'Recusada' : 'Pendente'}
                </StatusChip>
              </div>
              <p className="text-sm text-gray-600">{item.mensagem}</p>
            </div>
          ))}
        </PainelLista>
      </section>
    </main>
  )
}

function ResumoNumero(props: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3">
      <p className="text-white/65 text-[11px] uppercase tracking-wide">{props.titulo}</p>
      <p className="text-2xl font-bold mt-1">{props.valor}</p>
      <p className="text-white/75 text-xs mt-1">{props.detalhe}</p>
    </div>
  )
}

function CardAcao(props: { href: string; titulo: string; descricao: string; icone: string }) {
  return (
    <Link href={props.href} className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100 space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">
        {props.icone}
      </div>
      <div>
        <p className="font-semibold text-sm text-gray-900">{props.titulo}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{props.descricao}</p>
      </div>
    </Link>
  )
}

function LinhaChecklist(props: { titulo: string; concluido: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-700">{props.titulo}</p>
      <span
        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          props.concluido ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {props.concluido ? 'OK' : 'Pendente'}
      </span>
    </div>
  )
}

function PainelLista(props: {
  titulo: string
  subtitulo: string
  href: string
  hrefTexto: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">{props.titulo}</h2>
          <p className="text-sm text-gray-500 mt-1">{props.subtitulo}</p>
        </div>
        <Link href={props.href} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          {props.hrefTexto}
        </Link>
      </div>
      <div className="space-y-3">{props.children}</div>
    </section>
  )
}

function StatusChip(props: { classe: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${props.classe}`}>
      {props.children}
    </span>
  )
}

function MiniCard(props: { titulo: string; valor: string; descricao: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.titulo}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{props.valor}</p>
      <p className="text-xs text-gray-500 mt-1">{props.descricao}</p>
    </div>
  )
}

function Vazio(props: { titulo: string; descricao: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
      <p className="font-semibold text-sm text-gray-700">{props.titulo}</p>
      <p className="text-xs text-gray-500 mt-1">{props.descricao}</p>
    </div>
  )
}

function SolicitacaoCard(props: { solicitacao: SolicitacaoProfissional }) {
  const meta = statusSolicitacaoMeta(props.solicitacao.status)

  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{props.solicitacao.titulo}</p>
          <p className="text-xs text-gray-500 mt-1">
            {props.solicitacao.clienteNome} · {props.solicitacao.categoriaNome}
          </p>
        </div>
        <StatusChip classe={meta.classe}>{meta.texto}</StatusChip>
      </div>
      <p className="text-sm text-gray-600">{props.solicitacao.descricao}</p>
    </div>
  )
}
