/**
 * Conteúdo fictício para dar vida ao marketplace quando ainda há poucos dados reais.
 * IDs começam com "demo-" para não conflitar com UUIDs do banco.
 */
export type DemandaDemonstracao = {
  id: string
  titulo: string
  descricao: string
  categoriaNome: string
  clienteNome: string
  cidade: string
  publicadoEm: string
}

export const DEMANDAS_DEMONSTRACAO: DemandaDemonstracao[] = [
  {
    id: 'demo-1',
    titulo: 'Trocar chuveiro e resistência no banheiro',
    descricao:
      'Chuveiro queimando rápido, quero avaliação se é fiação ou só resistência. Apartamento em andar alto, garagem para estacionar.',
    categoriaNome: 'Hidráulica',
    clienteNome: 'Mariana Costa',
    cidade: 'Belo Horizonte · MG',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'demo-2',
    titulo: 'Instalar 4 câmeras Wi‑Fi + gravador',
    descricao:
      'Comprei kit Mercado Livre, preciso passagem de fio discreta na sala e 2 quartos. Orçamento com materiais à parte.',
    categoriaNome: 'Instalação de câmeras e alarmes',
    clienteNome: 'Roberto Almeida',
    cidade: 'Curitiba · PR',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'demo-3',
    titulo: 'Pintura de apartamento 65 m²',
    descricao:
      'Teto e paredes branco gelo, 2 quartos + sala + corredor. Preciso lixamento de massa antiga e selador antes da látex.',
    categoriaNome: 'Pintura',
    clienteNome: 'Fernanda e Luiz',
    cidade: 'São Paulo · SP',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'demo-4',
    titulo: 'Montar cozinha planejada (12 módulos)',
    descricao:
      'Marceneiro desistiu no último minuto. Módulos já na sala, manual da fábrica disponível. Preciso para esta semana.',
    categoriaNome: 'Montagem de móveis',
    clienteNome: 'Pedro Henrique',
    cidade: 'Florianópolis · SC',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'demo-5',
    titulo: 'Limpeza pós-reforma (casa térrea)',
    descricao:
      'Cimento e rejunte no piso porcelanato, janelas com silicone. Cerca de 90 m², preciso nota fiscal de serviço.',
    categoriaNome: 'Limpeza pós-obra',
    clienteNome: 'Ana Paula Souza',
    cidade: 'Recife · PE',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: 'demo-6',
    titulo: 'Manutenção preventiva em 3 splits',
    descricao:
      'Aparelhos 9000 e 12000 BTUs, última higienização há 2 anos. Quero checklist com fotos antes/depois.',
    categoriaNome: 'Ar-condicionado',
    clienteNome: 'Carlos Eduardo',
    cidade: 'Brasília · DF',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: 'demo-7',
    titulo: 'Criar identidade visual para food truck',
    descricao:
      'Nome já definido, preciso logo, paleta, padrão para redes sociais e arte para envelopamento do veículo.',
    categoriaNome: 'Design gráfico',
    clienteNome: 'Juliana & Breno',
    cidade: 'Porto Alegre · RS',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: 'demo-8',
    titulo: 'Aulas de Excel para equipe comercial (4 pessoas)',
    descricao:
      'Nível intermediário, foco em tabelas dinâmicas e dashboards. Podemos ser presencial na empresa ou remoto.',
    categoriaNome: 'Aulas particulares',
    clienteNome: 'TechVendas Ltda.',
    cidade: 'Campinas · SP',
    publicadoEm: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(),
  },
]

export type SolicitacaoDemonstracao = {
  id: string
  titulo: string
  descricao: string
  status: 'pendente' | 'aceita' | 'recusada'
  created_at: string
}

/** Exemplos só para estado vazio — não são gravados no banco. */
export const SOLICITACOES_DEMONSTRACAO: SolicitacaoDemonstracao[] = [
  {
    id: 'demo-s1',
    titulo: 'Instalar ventilador de teto no quarto casal',
    descricao:
      'Teto de gesso, já tenho o ventilador. Preciso fim de semana de preferência. Cliente: Rafael (prédio com elevador).',
    status: 'pendente',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'demo-s2',
    titulo: 'Orçamento para impermeabilização de laje',
    descricao:
      'Infiltração no canto da sala. Gostaria de visita técnica e laudo simples com fotos para o síndico.',
    status: 'pendente',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    id: 'demo-s3',
    titulo: 'Montagem de estante e rack na sala',
    descricao:
      'Dois móveis IKEA, tenho todas as peças. Estimativa de 3–4 horas.',
    status: 'aceita',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
]
