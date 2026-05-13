import { createClient } from '@/lib/supabase/client'

type RpcOk = { ok: boolean; erro?: string }

export const avaliacoesService = {
  async criarPosEtapa(
    solicitacaoId: string,
    notas: { qualidade: number; prazo: number; comunicacao: number },
    comentario: string,
    auditoria?: { clientIp?: string | null; deviceFingerprint?: string | null }
  ): Promise<RpcOk> {
    const { data, error } = await createClient().rpc('fn_avaliacao_criar_pos_etapa', {
      p_solicitacao_id: solicitacaoId,
      p_nota_qualidade: notas.qualidade,
      p_nota_prazo: notas.prazo,
      p_nota_comunicacao: notas.comunicacao,
      p_comentario: comentario,
      p_client_ip: auditoria?.clientIp ?? null,
      p_fingerprint: auditoria?.deviceFingerprint ?? null,
    })
    if (error) throw error
    return data as RpcOk
  },

  async responderComoPrestador(avaliacaoId: string, texto: string): Promise<RpcOk> {
    const { data, error } = await createClient().rpc('fn_avaliacao_responder_prestador', {
      p_avaliacao_id: avaliacaoId,
      p_texto: texto,
    })
    if (error) throw error
    return data as RpcOk
  },
}
