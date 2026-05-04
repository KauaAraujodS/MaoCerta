import { createClient } from '@/lib/supabase/client';

export const prestadorService = {
  async getAtendimentosEmAndamento(userId: string) {
    const { data } = await createClient()
      .from('atendimentos')
      .select(`
        *,
        servico:servicos(id, titulo, valor),
        cliente:profiles(id, nome, telefone, foto_url)
      `)
      .eq('prestador_id', userId)
      .in('status', ['agendado', 'em_andamento'])
      .order('data_agendada', { ascending: true });
    return data;
  },

  async getWallet(userId: string) {
    const { data } = await createClient()
      .from('wallets')
      .select('saldo')
      .eq('user_id', userId)
      .single();
    return data;
  },

  async getWalletTransactions(userId: string) {
    const { data } = await createClient()
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data;
  },

  async solicitarSaque(userId: string, valor: number) {
    const { data, error } = await createClient()
      .from('saques')
      .insert({
        user_id: userId,
        valor,
        status: 'pendente'
      })
      .select()
      .single();
    return { data, error };
  }
};