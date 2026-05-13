'use client'

import { useState, useEffect, useCallback } from 'react'
import { TipoEtapa, AgendamentoProposta } from '@/types'
import { prestadorService } from '@/lib/supabase/prestador'
import { formatarDataPt } from '@/lib/formatar-data'

type Props = {
  etapaId: string
  tipo: TipoEtapa
  solicitacaoId: string
  meuId: string
  meuTipo: 'cliente' | 'profissional'
  abaInicial?: 'propor' | 'respostas'
  onClose: () => void
}

const nomeEtapaMap: Record<TipoEtapa, string> = {
  vistoria: 'Vistoria/Consulta',
  orcamento: 'Orçamento',
  execucao: 'Execução'
}

export default function AgendamentoModal({
  etapaId,
  tipo,
  solicitacaoId,
  meuId,
  meuTipo,
  abaInicial = 'propor',
  onClose
}: Props) {
  const [abas, setAbas] = useState<'propor' | 'respostas'>(abaInicial)
  const [dataProposta, setDataProposta] = useState('')
  const [horaProposta, setHoraProposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [propostas, setPropostas] = useState<AgendamentoProposta[]>([])
  const [carregandoPropostas, setCarregandoPropostas] = useState(false)

  const carregarPropostas = useCallback(async () => {
    setCarregandoPropostas(true)
    try {
      const dados = await prestadorService.getAgendamentoPropostas(etapaId)
      setPropostas(dados)
    } catch (e) {
      console.error(e)
    } finally {
      setCarregandoPropostas(false)
    }
  }, [etapaId])

  useEffect(() => {
    setAbas(abaInicial)
    if (abaInicial === 'respostas') {
      void carregarPropostas()
    }
  }, [etapaId, abaInicial, carregarPropostas])

  async function handlePropor(e: React.FormEvent) {
    e.preventDefault()
    if (!dataProposta || !horaProposta) {
      setErro('Preencha data e horário')
      return
    }

    setEnviando(true)
    setErro(null)
    try {
      await prestadorService.propostaAgendamento(
        etapaId,
        solicitacaoId,
        dataProposta,
        horaProposta,
        meuId,
        meuTipo === 'cliente' ? 'cliente' : 'profissional'
      )
      setSucesso(true)
      setDataProposta('')
      setHoraProposta('')
      setTimeout(() => setSucesso(false), 2000)
      void carregarPropostas()
    } catch (e) {
      console.error(e)
      setErro('Erro ao enviar proposta')
    } finally {
      setEnviando(false)
    }
  }

  async function handleResponderProposta(propostaId: string, acao: 'aceitar' | 'rejeitar') {
    try {
      if (acao === 'aceitar') {
        await prestadorService.aceitarAgendamento(propostaId, meuId)
      } else {
        await prestadorService.rejeitarAgendamento(propostaId, meuId)
      }
      void carregarPropostas()
    } catch (e) {
      console.error(e)
      setErro('Erro ao responder proposta')
    }
  }

  async function handleCancelarAgendamento(propostaId: string) {
    try {
      await prestadorService.cancelarAgendamento(propostaId, meuId)
      void carregarPropostas()
    } catch (e) {
      console.error(e)
      setErro('Erro ao cancelar agendamento')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 rounded-t-3xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Agendamento</p>
            <h2 className="text-lg font-bold">{nomeEtapaMap[tipo]}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-80 transition"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 sticky top-16 bg-white dark:bg-slate-900">
          <button
            onClick={() => {
              setAbas('propor')
              setSucesso(false)
              setErro(null)
            }}
            className={`flex-1 py-3 font-semibold text-sm transition ${
              abas === 'propor'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            📅 Propor Data
          </button>
          <button
            onClick={() => {
              setAbas('respostas')
              void carregarPropostas()
            }}
            className={`flex-1 py-3 font-semibold text-sm transition ${
              abas === 'respostas'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            💬 Respostas
          </button>
        </div>

        {/* Conteúdo */}
        <div className="max-h-[60vh] overflow-y-auto pb-6">
          {abas === 'propor' ? (
            <div className="p-6 space-y-4">
              {sucesso && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <p className="text-sm font-semibold text-emerald-700">Proposta enviada com sucesso!</p>
                </div>
              )}

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              )}

              <form onSubmit={handlePropor} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={dataProposta}
                    onChange={(e) => setDataProposta(e.target.value)}
                    className="w-full border-2 border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={horaProposta}
                    onChange={(e) => setHoraProposta(e.target.value)}
                    className="w-full border-2 border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600 transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition"
                >
                  {enviando ? '📤 Enviando...' : '📤 Enviar Proposta'}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {carregandoPropostas && (
                <div className="flex items-center gap-2 py-8">
                  <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-600 dark:text-slate-400">Carregando propostas...</p>
                </div>
              )}

              {!carregandoPropostas && propostas.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma proposta de agendamento ainda</p>
                </div>
              )}

              {!carregandoPropostas && propostas.map((proposta) => (
                <div key={proposta.id} className="border-2 border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {formatarDataPt(proposta.data_proposta)} às {proposta.hora_proposta}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Proposto em {formatarDataPt(proposta.created_at)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      proposta.status === 'proposto_prestador' ? 'bg-blue-100 text-blue-700' :
                      proposta.status === 'proposto_cliente' ? 'bg-amber-100 text-amber-700' :
                      proposta.status === 'aceito_ambos' ? 'bg-emerald-100 text-emerald-700' :
                      proposta.status === 'rejeitado' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                    }`}>
                      {proposta.status === 'proposto_prestador' && '⏳ Aguardando resposta'}
                      {proposta.status === 'proposto_cliente' && '⏳ Aguardando confirmação'}
                      {proposta.status === 'aceito_ambos' && '✅ Aceito'}
                      {proposta.status === 'rejeitado' && '❌ Rejeitado'}
                      {proposta.status === 'cancelado' && '❌ Cancelado'}
                    </span>
                  </div>

                  {proposta.motivo_rejeicao && (
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-xs text-red-700">
                        <strong>Motivo:</strong> {proposta.motivo_rejeicao}
                      </p>
                    </div>
                  )}

                  {proposta.status === 'proposto_prestador' && proposta.proposto_por !== meuId && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleResponderProposta(proposta.id, 'aceitar')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded text-sm transition"
                      >
                        ✅ Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResponderProposta(proposta.id, 'rejeitar')}
                        className="flex-1 border-2 border-red-300 text-red-600 hover:bg-red-50 font-semibold py-2 px-3 rounded text-sm transition"
                      >
                        ❌ Rejeitar
                      </button>
                    </div>
                  )}

                  {proposta.status === 'proposto_cliente' && proposta.proposto_por !== meuId && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleResponderProposta(proposta.id, 'aceitar')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded text-sm transition"
                      >
                        ✅ Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResponderProposta(proposta.id, 'rejeitar')}
                        className="flex-1 border-2 border-red-300 text-red-600 hover:bg-red-50 font-semibold py-2 px-3 rounded text-sm transition"
                      >
                        ❌ Rejeitar
                      </button>
                    </div>
                  )}

                  {proposta.status === 'aceito_ambos' && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleCancelarAgendamento(proposta.id)}
                        className="flex-1 border-2 border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold py-2 px-3 rounded text-sm transition"
                      >
                        🚫 Cancelar Agendamento
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
