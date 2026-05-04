import { createClient } from '@/lib/supabase/client'

export type StatusAtendimento = 'aceita' | 'em_andamento' | 'concluida' | 'cancelada'

export type ClienteResumo = {
  id: string
  nome: string
  telefone: string | null
  avatar_url: string | null
}

export type Atendimento = {
  id: string
  titulo: string
  descricao: string
  status: StatusAtendimento
  created_at: string
  updated_at: string
  cliente: ClienteResumo | null
}

export type WalletTransaction = {
  id: string
  tipo: 'credito' | 'debito'
  valor: number
  descricao: string
  referencia: string | null
  created_at: string
}

export type Saque = {
  id: string
  valor: number
  status: 'pendente' | 'processado' | 'cancelado'
  observacao: string | null
  created_at: string
  processado_em: string | null
}

const SELECT_ATENDIMENTO = `
  id, titulo, descricao, status, created_at, updated_at,
  cliente:cliente_id (id, nome, telefone, avatar_url)
`

export const prestadorService = {
  async getAtendimentosEmAndamento(userId: string): Promise<Atendimento[]> {
    const { data, error } = await createClient()
      .from('solicitacoes')
      .select(SELECT_ATENDIMENTO)
      .eq('profissional_id', userId)
      .in('status', ['aceita', 'em_andamento'])
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as unknown as Atendimento[]) || []
  },

  async getHistoricoAtendimentos(userId: string): Promise<Atendimento[]> {
    const { data, error } = await createClient()
      .from('solicitacoes')
      .select(SELECT_ATENDIMENTO)
      .eq('profissional_id', userId)
      .in('status', ['concluida', 'cancelada'])
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data as unknown as Atendimento[]) || []
  },

  async iniciarAtendimento(id: string) {
    const { error } = await createClient()
      .from('solicitacoes')
      .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async concluirAtendimento(id: string) {
    const { error } = await createClient()
      .from('solicitacoes')
      .update({ status: 'concluida', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async getWallet(userId: string): Promise<{ saldo: number } | null> {
    const { data, error } = await createClient()
      .from('wallets')
      .select('saldo')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    const { data, error } = await createClient()
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data as WalletTransaction[]) || []
  },

  async getSaques(userId: string): Promise<Saque[]> {
    const { data, error } = await createClient()
      .from('saques')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as Saque[]) || []
  },

  async solicitarSaque(userId: string, valor: number, observacao?: string) {
    const { data, error } = await createClient()
      .from('saques')
      .insert({ user_id: userId, valor, observacao: observacao || null })
      .select('id')
      .single()
    if (error) throw error
    return data
  },

  async cancelarSaque(id: string) {
    const { error } = await createClient()
      .from('saques')
      .update({ status: 'cancelado' })
      .eq('id', id)
    if (error) throw error
  },
}
