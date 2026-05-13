import { createClient } from '@/lib/supabase/client'

export type NotificacaoFinanceira = {
  id: string
  tipo: string
  titulo: string
  corpo: string | null
  payload: Record<string, unknown> | null
  lida_em: string | null
  created_at: string
}

export const notificacoesService = {
  async listarRecentes(limite = 25): Promise<NotificacaoFinanceira[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notificacoes_financeiras')
      .select('id, tipo, titulo, corpo, payload, lida_em, created_at')
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data as NotificacaoFinanceira[]) || []
  },

  async marcarLida(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('notificacoes_financeiras')
      .update({ lida_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },
}
