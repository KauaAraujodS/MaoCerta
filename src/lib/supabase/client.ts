import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Cliente no navegador: grava sessão em cookies (compatível com middleware SSR). */
export const createClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export const clienteService = {
  
  async buscarPrestadores(filtros: { 
    categoria?: string; 
    cidade?: string; 
    bairro?: string 
  }) {
    let query = createClient()
      .from('prestadores_profiles') // ou nome da sua view/tabela
      .select(`
        id,
        nome,
        foto_url,
        categoria,
        cidade,
        bairro,
        nota_media,
        verificado,
        avaliacoes:avaliacoes(count)
      `);

    if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
    if (filtros.cidade) query = query.eq('cidade', filtros.cidade);
    if (filtros.bairro) query = query.eq('bairro', filtros.bairro);

    const { data, error } = await query
      .order('nota_media', { ascending: false });

    if (error) console.error(error);
    return data;
  },

  async getPerfilPrestador(prestadorId: string) {
    const { data, error } = await createClient()
      .from('prestadores_profiles')
      .select(`
        *,
        avaliacoes (
          id,
          nota,
          comentario,
          created_at,
          cliente:profiles(nome)
        )
      `)
      .eq('id', prestadorId)
      .single();

    if (error) console.error(error);
    return data;
  },

  async contratarPrestador(dados: {
    prestador_id: string;
    data_agendada: string;
    horario: string;
    endereco: string;
    valor: number;
    observacoes?: string;
  }) {
    const { data: user } = await createClient().auth.getUser();

    if (!user.user) throw new Error("Usuário não autenticado");

    const { data, error } = await createClient()
      .from('atendimentos')
      .insert({
        cliente_id: user.user.id,
        prestador_id: dados.prestador_id,
        data_agendada: dados.data_agendada,
        horario: dados.horario,
        endereco: dados.endereco,
        valor: dados.valor,
        observacoes: dados.observacoes,
        status: 'agendado'
      })
      .select()
      .single();

    if (error) console.error(error);
    return { data, error };
  }
};