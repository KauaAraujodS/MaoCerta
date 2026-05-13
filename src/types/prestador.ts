export interface AtendimentoPrestador {
  id: string;
  servico: {
    id: string;
    titulo: string;
    valor: number;
  };
  cliente: {
    id: string;
    nome: string;
    telefone?: string;
    foto_url?: string;
  };
  status: 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';
  data_agendada: string;
  endereco?: string;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  tipo: 'credito' | 'debito';
  valor: number;
  descricao: string;
  referencia_id?: string; // id do serviço ou saque
  created_at: string;
}

export interface Saque {
  id: string;
  valor: number;
  status: 'pendente' | 'processado' | 'cancelado';
  data_solicitacao: string;
  data_processamento?: string;
}