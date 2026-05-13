import { createClient } from '@/lib/supabase/client'
import type { Pagamento } from '@/types'

type RpcOk<T> = T & { ok: boolean; erro?: string }

export const financeiroService = {
  async getComissaoPercentual(): Promise<number> {
    const { data, error } = await createClient()
      .from('config_financeiro')
      .select('comissao_percentual')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return Number(data?.comissao_percentual ?? 10)
  },

  async getPagamentosPorSolicitacao(solicitacaoId: string): Promise<Pagamento[]> {
    const { data, error } = await createClient()
      .from('pagamentos')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as Pagamento[]) || []
  },

  /** Último pagamento relevante por etapa (primeiro da lista ordenada por data). */
  mapPagamentoPorEtapa(rows: Pagamento[]): Record<string, Pagamento> {
    const map: Record<string, Pagamento> = {}
    for (const p of rows) {
      if (!map[p.etapa_id]) map[p.etapa_id] = p
    }
    return map
  },

  async definirValorTotalServico(
    solicitacaoId: string,
    valor: number | null
  ): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_definir_valor_total', {
      p_solicitacao_id: solicitacaoId,
      p_valor: valor,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async criarPagamentoPix(etapaId: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_criar_pagamento_pix', {
      p_etapa_id: etapaId,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async confirmarPixSandbox(pagamentoId: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_confirmar_pix_sandbox', {
      p_pagamento_id: pagamentoId,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async abrirDisputa(etapaId: string, motivo: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_abrir_disputa', {
      p_etapa_id: etapaId,
      p_motivo: motivo,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },
}
