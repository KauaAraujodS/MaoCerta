'use client'

import { useState } from 'react'
import { Etapa, TipoEtapa } from '@/types'
import { formatarDataPt } from '@/lib/formatar-data'

type Props = {
  etapa: Etapa
  meuId: string
  meuTipo: 'cliente' | 'profissional'
  onComecar: () => void
  onConcluir: () => void
  onConfirmar: () => void
  onCancelar: (motivo?: string) => void
  onPropostaAgendamento: () => void
  podeInteragir: boolean
}

const statusBadges: Record<Etapa['status'], { label: string; bg: string; text: string }> = {
  pendente: { label: '⏳ Pendente', bg: 'bg-gray-50', text: 'text-gray-700' },
  agendada: { label: '📅 Agendada', bg: 'bg-blue-50', text: 'text-blue-700' },
  em_progresso: { label: '⚙️ Em Progresso', bg: 'bg-amber-50', text: 'text-amber-700' },
  concluida: { label: '✅ Concluída', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelada: { label: '❌ Cancelada', bg: 'bg-red-50', text: 'text-red-700' }
}

const nomeEtapaMap: Record<TipoEtapa, { nome: string; emoji: string }> = {
  vistoria: { nome: 'Vistoria/Consulta', emoji: '🔍' },
  orcamento: { nome: 'Orçamento', emoji: '💰' },
  execucao: { nome: 'Execução', emoji: '🔨' }
}

export default function CardEtapa({
  etapa,
  meuId,
  meuTipo,
  onComecar,
  onConcluir,
  onConfirmar,
  onCancelar,
  onPropostaAgendamento,
  podeInteragir
}: Props) {
  const [expandido, setExpandido] = useState(false)
  const [mostraCancelamento, setMostraCancelamento] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  
  const badge = statusBadges[etapa.status]
  const nomeEtapa = nomeEtapaMap[etapa.tipo]
  
  const ambosCfirmaram = etapa.cliente_confirmou && etapa.profissional_confirmou
  const podeConfirmar = 
    etapa.status === 'concluida' && 
    (
      (meuTipo === 'cliente' && !etapa.cliente_confirmou) ||
      (meuTipo === 'profissional' && !etapa.profissional_confirmou)
    )

  const podePropor = etapa.status === 'pendente' && meuTipo === 'profissional'

  function handleCancelar() {
    if (motivoCancelamento.trim()) {
      onCancelar(motivoCancelamento)
      setMostraCancelamento(false)
      setMotivoCancelamento('')
    }
  }

  return (
    <div className={`rounded-xl border-2 transition-all ${badge.bg} border-transparent`}>
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full text-left p-4 flex items-center justify-between hover:opacity-80"
      >
        <div className="flex items-center gap-3 flex-1">
          <span className="text-2xl">{nomeEtapa.emoji}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{nomeEtapa.nome}</h3>
            <p className={`text-xs font-medium ${badge.text}`}>{badge.label}</p>
          </div>
        </div>
        <span className="text-2xl text-gray-400">{expandido ? '▼' : '▶'}</span>
      </button>

      {expandido && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          {/* Informações de agendamento */}
          {etapa.data_proposta && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">📅 DATA E HORÁRIO AGENDADO</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatarDataPt(etapa.data_proposta)} às {etapa.hora_proposta || '...:...'}
              </p>
            </div>
          )}

          {/* Notas */}
          {etapa.notas_inicial && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">📝 NOTAS INICIAIS</p>
              <p className="text-sm text-gray-700">{etapa.notas_inicial}</p>
            </div>
          )}

          {etapa.notas_conclusao && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">✍️ NOTAS DE CONCLUSÃO</p>
              <p className="text-sm text-gray-700">{etapa.notas_conclusao}</p>
            </div>
          )}

          {/* Confirmações */}
          <div className="bg-white rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Prestador confirmou:</span>
              <span className={etapa.profissional_confirmou ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                {etapa.profissional_confirmou ? '✅ Sim' : '⏳ Não'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Cliente confirmou:</span>
              <span className={etapa.cliente_confirmou ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                {etapa.cliente_confirmou ? '✅ Sim' : '⏳ Não'}
              </span>
            </div>
          </div>

          {/* Botões de ação */}
          {podeInteragir && (
            <div className="space-y-2 pt-2">
              {etapa.status === 'pendente' && (
                <>
                  <button
                    onClick={onComecar}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    ▶️ Iniciar Etapa
                  </button>
                  {podePropor && (
                    <button
                      onClick={onPropostaAgendamento}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                      📅 Propor Data/Horário
                    </button>
                  )}
                </>
              )}

              {etapa.status === 'em_progresso' && (
                <button
                  onClick={onConcluir}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  ✅ Marcar como Concluída
                </button>
              )}

              {podeConfirmar && (
                <button
                  onClick={onConfirmar}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  🤝 Confirmar Conclusão
                </button>
              )}

              {etapa.status !== 'concluida' && etapa.status !== 'cancelada' && (
                <button
                  onClick={() => setMostraCancelamento(!mostraCancelamento)}
                  className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 font-semibold py-2 px-4 rounded-lg transition"
                >
                  ❌ Cancelar Etapa
                </button>
              )}

              {mostraCancelamento && (
                <div className="bg-red-50 rounded-lg p-3 space-y-2">
                  <textarea
                    placeholder="Por que esta etapa está sendo cancelada? (opcional)"
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    className="w-full text-xs border border-red-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelar}
                      disabled={!motivoCancelamento.trim()}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-1 px-2 rounded text-sm transition"
                    >
                      Confirmar Cancelamento
                    </button>
                    <button
                      onClick={() => {
                        setMostraCancelamento(false)
                        setMotivoCancelamento('')
                      }}
                      className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 font-semibold py-1 px-2 rounded text-sm transition"
                    >
                      Manter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!podeInteragir && etapa.status === 'concluida' && ambosCfirmaram && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-lg">✅</span>
              <p className="text-sm font-semibold text-emerald-700">Etapa finalizada com ambas as confirmações</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
