'use client'

import { useEffect, useState } from 'react'
import { Etapa, Pagamento, TipoEtapa } from '@/types'
import { prestadorService } from '@/lib/supabase/prestador'
import { financeiroService } from '@/lib/supabase/financeiro'
import CardEtapa from './CardEtapa'
import AgendamentoModal from './AgendamentoModal'
import ConfirmacaoEtapaModal from './ConfirmacaoEtapaModal'

type Props = {
  solicitacaoId: string
  meuId: string
  meuTipo: 'cliente' | 'profissional'
  solicitacaoStatus: string
  /** Incrementa após salvar valor total — recarrega etapas e pagamentos */
  financeSignal?: number
}

const nomeEtapaMap: Record<TipoEtapa, string> = {
  vistoria: 'Vistoria/Consulta',
  orcamento: 'Orçamento',
  execucao: 'Execução'
}

export default function GerenciadorEtapas({
  solicitacaoId,
  meuId,
  meuTipo,
  solicitacaoStatus,
  financeSignal = 0,
}: Props) {
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [pagMap, setPagMap] = useState<Record<string, Pagamento>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  
  // Modais
  const [agendamentoModal, setAgendamentoModal] = useState<{
    etapaId: string
    tipo: TipoEtapa
    abaInicial: 'propor' | 'respostas'
  } | null>(null)
  const [confirmacaoModal, setConfirmacaoModal] = useState<{ etapaId: string } | null>(null)

  useEffect(() => {
    carregar()
  }, [solicitacaoId, financeSignal])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const [dados, pays] = await Promise.all([
        prestadorService.getEtapasAtendimento(solicitacaoId),
        financeiroService.getPagamentosPorSolicitacao(solicitacaoId).catch(() => [] as Pagamento[]),
      ])
      setEtapas(dados)
      setPagMap(financeiroService.mapPagamentoPorEtapa(pays))
    } catch (e) {
      console.error(e)
      setErro('Não foi possível carregar as etapas')
    } finally {
      setCarregando(false)
    }
  }

  async function handleComecarEtapa(etapaId: string, notas?: string) {
    try {
      await prestadorService.iniciarEtapa(etapaId, notas)
      await carregar()
    } catch (e: unknown) {
      console.error(e)
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : ''
      if (msg.includes('ETAPA_ANTERIOR_NAO_LIBERADA')) {
        setErro('A etapa anterior precisa estar paga e liberada antes de iniciar esta (RF39.3).')
      } else if (msg.includes('ETAPA_SEM_PAGAMENTO_CONFIRMADO')) {
        setErro('O cliente precisa confirmar o Pix desta etapa na plataforma antes de você iniciar o trabalho.')
      } else {
        setErro('Erro ao iniciar etapa')
      }
    }
  }

  async function handleConcluirEtapa(etapaId: string, notas?: string) {
    try {
      await prestadorService.concluirEtapa(etapaId, notas)
      await carregar()
    } catch (e) {
      console.error(e)
      setErro('Erro ao concluir etapa')
    }
  }

  async function handleConfirmarEtapa(etapaId: string) {
    try {
      if (meuTipo === 'cliente') {
        await prestadorService.confirmarEtapaCliente(etapaId)
      } else {
        await prestadorService.confirmarEtapaProfissional(etapaId)
      }
      await carregar()
    } catch (e) {
      console.error(e)
      setErro('Erro ao confirmar etapa')
    }
  }

  async function handleCancelarEtapa(etapaId: string, motivo?: string) {
    try {
      await prestadorService.cancelarEtapa(etapaId, solicitacaoId, meuId, motivo)
      await carregar()
    } catch (e) {
      console.error(e)
      setErro('Erro ao cancelar etapa')
    }
  }

  if (carregando) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600 dark:text-slate-400">Carregando etapas...</p>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{erro}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {etapas.map((etapa, idx) => (
          <CardEtapa
            key={etapa.id}
            etapa={etapa}
            meuId={meuId}
            meuTipo={meuTipo}
            solicitacaoStatus={solicitacaoStatus}
            pagamento={pagMap[etapa.id] ?? null}
            onPagamentoAlterado={() => void carregar()}
            onComecar={() => handleComecarEtapa(etapa.id)}
            onConcluir={() => setConfirmacaoModal({ etapaId: etapa.id })}
            onConfirmar={() => handleConfirmarEtapa(etapa.id)}
            onCancelar={(motivo) => handleCancelarEtapa(etapa.id, motivo)}
            onPropostaAgendamento={() =>
              setAgendamentoModal({ etapaId: etapa.id, tipo: etapa.tipo, abaInicial: 'propor' })
            }
            onVerAgendamentos={() =>
              setAgendamentoModal({ etapaId: etapa.id, tipo: etapa.tipo, abaInicial: 'respostas' })
            }
            podeInteragir={
              etapa.status !== 'cancelada' &&
              (etapa.status !== 'concluida' ||
                !etapa.cliente_confirmou ||
                !etapa.profissional_confirmou)
            }
          />
        ))}
      </div>

      {agendamentoModal && (
        <AgendamentoModal
          key={`${agendamentoModal.etapaId}-${agendamentoModal.abaInicial}`}
          etapaId={agendamentoModal.etapaId}
          tipo={agendamentoModal.tipo}
          solicitacaoId={solicitacaoId}
          meuId={meuId}
          meuTipo={meuTipo}
          abaInicial={agendamentoModal.abaInicial}
          onClose={() => {
            setAgendamentoModal(null)
            carregar()
          }}
        />
      )}

      {confirmacaoModal && (
        <ConfirmacaoEtapaModal
          etapaId={confirmacaoModal.etapaId}
          meuId={meuId}
          onConfirmado={() => {
            setConfirmacaoModal(null)
            handleConcluirEtapa(confirmacaoModal.etapaId)
          }}
          onCancelado={() => setConfirmacaoModal(null)}
        />
      )}
    </div>
  )
}
