export type UserRole = "cliente" | "profissional";

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  telefone?: string;
  created_at: string;
}

export interface Servico {
  id: string;
  categoria: string;
  descricao: string;
  profissional_id: string;
  created_at: string;
}

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  cliente_id: string;
  status: "aberta" | "em_andamento" | "concluida" | "cancelada";
  created_at: string;
}

export interface Acordo {
  id: string;
  demanda_id?: string;
  cliente_id: string;
  profissional_id: string;
  valor: number;
  prazo: string;
  status: "pendente" | "aceito" | "recusado" | "concluido";
  created_at: string;
}

// RF30-RF38: Etapas de Atendimento
export type TipoEtapa = "vistoria" | "orcamento" | "execucao";
export type StatusEtapa = "pendente" | "agendada" | "em_progresso" | "concluida" | "cancelada";
export type StatusAgendamento = "proposto_prestador" | "proposto_cliente" | "aceito_ambos" | "rejeitado" | "cancelado";

export interface EtapaTipo {
  id: number;
  tipo: TipoEtapa;
  nome: string;
  descricao?: string;
  sequencia: number;
}

export interface Etapa {
  id: string;
  solicitacao_id: string;
  tipo: TipoEtapa;
  sequencia: number;
  status: StatusEtapa;
  data_proposta?: string;
  hora_proposta?: string;
  proposto_por?: string;
  cliente_confirmou: boolean;
  profissional_confirmou: boolean;
  data_confirmacao_cliente?: string;
  data_confirmacao_profissional?: string;
  notas_inicial?: string;
  notas_conclusao?: string;
  data_inicio?: string;
  data_conclusao?: string;
  created_at: string;
  updated_at: string;
}

export interface AgendamentoProposta {
  id: string;
  etapa_id: string;
  solicitacao_id: string;
  data_proposta: string;
  hora_proposta: string;
  proposto_por: string;
  status: StatusAgendamento;
  respondido_por?: string;
  resposta_em?: string;
  motivo_rejeicao?: string;
  created_at: string;
  updated_at: string;
}

export interface CancelamentoEtapa {
  id: string;
  etapa_id: string;
  solicitacao_id: string;
  cancelado_por: string;
  motivo?: string;
  created_at: string;
}
