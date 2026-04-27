export type PlanoId = 'free' | 'basico' | 'premium'

export type CategoriaOption = {
  id: number
  nome: string
}

export type CategoriaAtuacao = {
  id: string
  categoriaId: number
  nome: string
  createdAt?: string
}

export type ServicoProfissional = {
  id: string
  titulo: string
  descricao: string
  categoriaId: number
  categoriaNome: string
  valorHora: number | null
  createdAt: string
}

export type DocumentoProfissional = {
  id: string
  tipoDocumento: string
  nomeArquivo: string
  arquivoPath: string
  mimeType: string | null
  status: 'pendente' | 'aprovado' | 'rejeitado'
  observacoes: string | null
  createdAt: string
}

export type SolicitacaoProfissional = {
  id: string
  titulo: string
  descricao: string
  status: 'pendente' | 'aceita' | 'recusada' | 'concluida'
  categoriaId: number | null
  categoriaNome: string
  clienteNome: string
  dataPreferida: string | null
  orcamentoSugerido: number | null
  createdAt: string
}

export type DemandaProfissional = {
  id: string
  titulo: string
  descricao: string
  categoriaId: number
  categoriaNome: string
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
  createdAt: string
}

export type PropostaProfissional = {
  id: string
  demandaId: string
  tituloDemanda: string
  mensagem: string
  valorProposto: number
  prazo: string
  status: 'pendente' | 'aceita' | 'recusada'
  createdAt: string
}

export type PlanoConfig = {
  id: PlanoId
  nome: string
  cor: string
  selo: string
  limites: {
    categorias: number
    servicos: number
    demandasVisiveis: number
    propostasPendentes: number
  }
}

export const LIMITE_ILIMITADO = 999

export const PLANOS_PROFISSIONAL: Record<PlanoId, PlanoConfig> = {
  free: {
    id: 'free',
    nome: 'Free',
    cor: 'from-gray-800 to-slate-700',
    selo: 'Começando agora',
    limites: {
      categorias: 1,
      servicos: 3,
      demandasVisiveis: 6,
      propostasPendentes: 2,
    },
  },
  basico: {
    id: 'basico',
    nome: 'Pro',
    cor: 'from-emerald-700 to-teal-500',
    selo: 'Mais alcance',
    limites: {
      categorias: 3,
      servicos: 8,
      demandasVisiveis: 18,
      propostasPendentes: 6,
    },
  },
  premium: {
    id: 'premium',
    nome: 'Premium Pro',
    cor: 'from-cyan-700 via-emerald-600 to-lime-500',
    selo: 'Máxima visibilidade',
    limites: {
      categorias: LIMITE_ILIMITADO,
      servicos: LIMITE_ILIMITADO,
      demandasVisiveis: LIMITE_ILIMITADO,
      propostasPendentes: LIMITE_ILIMITADO,
    },
  },
}

export const CATEGORIAS_PADRAO: CategoriaOption[] = [
  { id: 1, nome: 'Elétrica' },
  { id: 2, nome: 'Hidráulica' },
  { id: 3, nome: 'Pintura' },
  { id: 4, nome: 'Limpeza' },
  { id: 5, nome: 'Marcenaria' },
  { id: 6, nome: 'Jardinagem' },
  { id: 7, nome: 'Informática' },
  { id: 8, nome: 'Montagem de móveis' },
  { id: 9, nome: 'Ar-condicionado' },
  { id: 10, nome: 'Reforma geral' },
]

export const DEMO_CATEGORIAS_ATUACAO: CategoriaAtuacao[] = [
  {
    id: 'demo-cat-1',
    categoriaId: 1,
    nome: 'Elétrica',
    createdAt: '2026-04-20T10:00:00.000Z',
  },
  {
    id: 'demo-cat-2',
    categoriaId: 8,
    nome: 'Montagem de móveis',
    createdAt: '2026-04-21T10:00:00.000Z',
  },
]

export const DEMO_SERVICOS: ServicoProfissional[] = [
  {
    id: 'demo-serv-1',
    titulo: 'Troca de disjuntor',
    descricao: 'Substituição segura de disjuntores e revisão básica do quadro.',
    categoriaId: 1,
    categoriaNome: 'Elétrica',
    valorHora: 85,
    createdAt: '2026-04-18T14:20:00.000Z',
  },
  {
    id: 'demo-serv-2',
    titulo: 'Instalação de ventilador de teto',
    descricao: 'Instalação com fixação, montagem e teste final.',
    categoriaId: 1,
    categoriaNome: 'Elétrica',
    valorHora: 95,
    createdAt: '2026-04-19T09:00:00.000Z',
  },
]

export const DEMO_DOCUMENTOS: DocumentoProfissional[] = [
  {
    id: 'demo-doc-1',
    tipoDocumento: 'Documento com foto',
    nomeArquivo: 'cnh-frente.pdf',
    arquivoPath: 'demo/cnh-frente.pdf',
    mimeType: 'application/pdf',
    status: 'aprovado',
    observacoes: 'Documento legível e dentro da validade.',
    createdAt: '2026-04-15T08:00:00.000Z',
  },
  {
    id: 'demo-doc-2',
    tipoDocumento: 'Comprovante de endereço',
    nomeArquivo: 'conta-luz-marco.pdf',
    arquivoPath: 'demo/conta-luz-marco.pdf',
    mimeType: 'application/pdf',
    status: 'pendente',
    observacoes: null,
    createdAt: '2026-04-24T19:30:00.000Z',
  },
]

export const DEMO_SOLICITACOES: SolicitacaoProfissional[] = [
  {
    id: 'demo-sol-1',
    titulo: 'Visita para avaliar curto no chuveiro',
    descricao: 'Cliente precisa de uma visita ainda esta semana para entender a origem do problema.',
    status: 'pendente',
    categoriaId: 1,
    categoriaNome: 'Elétrica',
    clienteNome: 'Mariana Costa',
    dataPreferida: '2026-04-29',
    orcamentoSugerido: 120,
    createdAt: '2026-04-26T11:00:00.000Z',
  },
  {
    id: 'demo-sol-2',
    titulo: 'Montagem de painel na sala',
    descricao: 'Solicitação direta enviada após o cliente visualizar seu perfil.',
    status: 'aceita',
    categoriaId: 8,
    categoriaNome: 'Montagem de móveis',
    clienteNome: 'João Martins',
    dataPreferida: '2026-05-02',
    orcamentoSugerido: 180,
    createdAt: '2026-04-24T15:00:00.000Z',
  },
]

export const DEMO_DEMANDAS: DemandaProfissional[] = [
  {
    id: 'demo-dem-1',
    titulo: 'Troca de fiação da cozinha',
    descricao: 'Preciso revisar tomadas e instalar dois novos pontos de energia.',
    categoriaId: 1,
    categoriaNome: 'Elétrica',
    status: 'aberta',
    createdAt: '2026-04-26T09:30:00.000Z',
  },
  {
    id: 'demo-dem-2',
    titulo: 'Montagem de guarda-roupa 6 portas',
    descricao: 'Entrega prevista para quarta e preciso da montagem no mesmo dia.',
    categoriaId: 8,
    categoriaNome: 'Montagem de móveis',
    status: 'aberta',
    createdAt: '2026-04-25T17:40:00.000Z',
  },
  {
    id: 'demo-dem-3',
    titulo: 'Instalação de ar-condicionado split',
    descricao: 'Apartamento no segundo andar, tubulação já iniciada pela construtora.',
    categoriaId: 9,
    categoriaNome: 'Ar-condicionado',
    status: 'aberta',
    createdAt: '2026-04-23T13:15:00.000Z',
  },
]

export const DEMO_PROPOSTAS: PropostaProfissional[] = [
  {
    id: 'demo-prop-1',
    demandaId: 'demo-dem-2',
    tituloDemanda: 'Montagem de guarda-roupa 6 portas',
    mensagem: 'Consigo atender no mesmo dia da entrega com equipe própria.',
    valorProposto: 260,
    prazo: '1 dia',
    status: 'pendente',
    createdAt: '2026-04-26T20:15:00.000Z',
  },
  {
    id: 'demo-prop-2',
    demandaId: 'demo-dem-1',
    tituloDemanda: 'Troca de fiação da cozinha',
    mensagem: 'Incluo visita técnica e lista dos materiais necessários.',
    valorProposto: 340,
    prazo: '2 dias',
    status: 'aceita',
    createdAt: '2026-04-25T08:10:00.000Z',
  },
]

export function normalizarPlano(valor?: string | null): PlanoId {
  if (valor === 'basico' || valor === 'premium') {
    return valor
  }

  return 'free'
}

export function textoLimite(limite: number) {
  return limite >= LIMITE_ILIMITADO ? 'Ilimitado' : String(limite)
}

export function formatarMoeda(valor?: number | null) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) {
    return 'A combinar'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarData(valor?: string | null) {
  if (!valor) {
    return 'Sem data'
  }

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    return valor
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(data)
}

export function contarPendentes(propostas: PropostaProfissional[]) {
  return propostas.filter((item) => item.status === 'pendente').length
}

export function statusDocumentoMeta(status: DocumentoProfissional['status']) {
  if (status === 'aprovado') {
    return {
      texto: 'Aprovado',
      classe: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  if (status === 'rejeitado') {
    return {
      texto: 'Rejeitado',
      classe: 'bg-red-50 text-red-700 border-red-200',
    }
  }

  return {
    texto: 'Em análise',
    classe: 'bg-amber-50 text-amber-700 border-amber-200',
  }
}

export function statusSolicitacaoMeta(status: SolicitacaoProfissional['status']) {
  switch (status) {
    case 'aceita':
      return { texto: 'Aceita', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'recusada':
      return { texto: 'Recusada', classe: 'bg-red-50 text-red-700 border-red-200' }
    case 'concluida':
      return { texto: 'Concluída', classe: 'bg-sky-50 text-sky-700 border-sky-200' }
    default:
      return { texto: 'Pendente', classe: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
}

export function statusPropostaMeta(status: PropostaProfissional['status']) {
  switch (status) {
    case 'aceita':
      return { texto: 'Aceita', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'recusada':
      return { texto: 'Recusada', classe: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return { texto: 'Pendente', classe: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
}
