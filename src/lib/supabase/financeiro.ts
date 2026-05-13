import { createClient } from '@/lib/supabase/client'
import type { Pagamento } from '@/types'

type RpcOk<T> = T & { ok: boolean; erro?: string }

export type CriarPagamentoPixOpts = {
  escrowTermsAccepted: boolean
  /** Versão dos termos (deve coincidir com `config_financeiro.escrow_terms_version_atual` após migração 021). */
  escrowTermsVersion?: string | null
  clientIp?: string | null
  userAgent?: string | null
  deviceFingerprint?: string | null
}

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

  async criarPagamentoPix(
    etapaId: string,
    opts: CriarPagamentoPixOpts
  ): Promise<RpcOk<Record<string, unknown>>> {
    const ua =
      opts.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null)
    const { data, error } = await createClient().rpc('fn_financeiro_criar_pagamento_pix', {
      p_etapa_id: etapaId,
      p_escrow_terms_accepted: opts.escrowTermsAccepted,
      p_terms_version: opts.escrowTermsVersion ?? 'escrow-v1-2026',
      p_client_ip: opts.clientIp ?? null,
      p_user_agent: ua,
      p_fingerprint: opts.deviceFingerprint ?? null,
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

  async cancelarPixPendente(pagamentoId: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_cancelar_pix_pendente', {
      p_pagamento_id: pagamentoId,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async disputaPrestadorEvidencia(disputaId: string, texto: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_disputa_prestador_evidencia', {
      p_disputa_id: disputaId,
      p_texto: texto,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async disputaClienteReplica(disputaId: string, texto: string): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_disputa_cliente_replica', {
      p_disputa_id: disputaId,
      p_texto: texto,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async resolverDisputaAdmin(
    etapaId: string,
    acao: 'liberar' | 'estornar'
  ): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_resolver_disputa_admin', {
      p_etapa_id: etapaId,
      p_acao: acao,
    })
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },

  async getDisputaPorEtapa(etapaId: string) {
    const { data, error } = await createClient()
      .from('disputas')
      .select('*')
      .eq('etapa_id', etapaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data as Record<string, unknown> | null
  },

  async getExtratoCliente() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('pagamentos')
      .select(
        'id, status, valor_bruto, valor_comissao, valor_liquido_prestador, created_at, pago_em, liberado_em, etapa_id, solicitacao_id'
      )
      .eq('cliente_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) throw error
    return data ?? []
  },

  async processarLiberacoesAgendadas(): Promise<RpcOk<Record<string, unknown>>> {
    const { data, error } = await createClient().rpc('fn_financeiro_processar_liberacoes_agendadas')
    if (error) throw error
    return data as RpcOk<Record<string, unknown>>
  },
}
