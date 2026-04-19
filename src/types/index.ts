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
