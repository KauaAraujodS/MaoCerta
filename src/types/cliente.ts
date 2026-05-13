export interface PrestadorBusca {
  id: string;
  nome: string;
  foto_url?: string;
  categoria: string;
  cidade: string;
  bairro?: string;
  nota_media: number;
  total_avaliacoes: number;
  verificado: boolean;
  distancia_km?: number;
}

export interface PerfilPrestador {
  id: string;
  nome: string;
  foto_url?: string;
  descricao?: string;
  cidade: string;
  bairro?: string;
  nota_media: number;
  total_avaliacoes: number;
  verificado: boolean;
  categorias: string[];
  avaliacoes: Avaliacao[];
}

export interface Avaliacao {
  id: string;
  cliente_nome: string;
  nota: number;
  comentario: string;
  data: string;
}

export interface NovaContratacao {
  prestador_id: string;
  servico_id?: string;
  data_agendada: string;
  horario: string;
  endereco: string;
  valor: number;
  observacoes?: string;
}