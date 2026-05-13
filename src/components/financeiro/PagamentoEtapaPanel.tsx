'use client'

import { useState } from 'react'
import type { Etapa, Pagamento } from '@/types'
import { financeiroService } from '@/lib/supabase/financeiro'
import { formatarValorBrl } from '@/lib/formatar-data'

type Props = {
  etapa: Etapa
  solicitacaoStatus: string
  meuTipo: 'cliente' | 'profissional'
  pagamento: Pagamento | null
  onAlterado: () => void
}

function statusLabel(s: Pagamento['status']) {
  switch (s) {
    case 'aguardando_pix':
      return { txt: 'Aguardando Pix', cls: 'bg-sky-50 text-sky-800 border-sky-200' }
    case 'pago_retido':
      return { txt: 'Pago — em retenção', cls: 'bg-amber-50 text-amber-900 border-amber-200' }
    case 'liberado':
      return { txt: 'Repasse liberado', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'em_disputa':
      return { txt: 'Em análise (retenção)', cls: 'bg-orange-50 text-orange-900 border-orange-200' }
    default:
      return { txt: s, cls: 'bg-gray-50 text-gray-700 border-gray-200' }
  }
}

export default function PagamentoEtapaPanel({
  etapa,
  solicitacaoStatus,
  meuTipo,
  pagamento,
  onAlterado,
}: Props) {
  const [copiou, setCopiou] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarDisputa, setMostrarDisputa] = useState(false)
  const [motivoDisputa, setMotivoDisputa] = useState('')

  const ativo = solicitacaoStatus === 'aceita' || solicitacaoStatus === 'em_andamento'
  const valorEtapa = Number(etapa.valor_acordado ?? 0)
  const podePagar =
    meuTipo === 'cliente' &&
    ativo &&
    valorEtapa > 0 &&
    ['agendada', 'em_progresso', 'concluida'].includes(etapa.status)

  async function criarPix() {
    setProcessando(true)
    setErro(null)
    try {
      const r = await financeiroService.criarPagamentoPix(etapa.id)
      if (!r.ok) {
        setErro(mapErro(r.erro))
        return
      }
      onAlterado()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o Pix. Tente de novo.')
    } finally {
      setProcessando(false)
    }
  }

  async function confirmarSandbox() {
    if (!pagamento) return
    setProcessando(true)
    setErro(null)
    try {
      const r = await financeiroService.confirmarPixSandbox(pagamento.id)
      if (!r.ok) {
        setErro(mapErro(r.erro))
        return
      }
      onAlterado()
    } catch (e) {
      console.error(e)
      setErro('Falha ao confirmar pagamento.')
    } finally {
      setProcessando(false)
    }
  }

  async function enviarDisputa() {
    setProcessando(true)
    setErro(null)
    try {
      const r = await financeiroService.abrirDisputa(etapa.id, motivoDisputa)
      if (!r.ok) {
        setErro(mapErro(r.erro))
        return
      }
      setMostrarDisputa(false)
      setMotivoDisputa('')
      onAlterado()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível registrar a contestação.')
    } finally {
      setProcessando(false)
    }
  }

  async function copiarPix() {
    if (!pagamento?.pix_copia_e_cola) return
    try {
      await navigator.clipboard.writeText(pagamento.pix_copia_e_cola)
      setCopiou(true)
      setTimeout(() => setCopiou(false), 2000)
    } catch {
      setErro('Não foi possível copiar. Selecione o código manualmente.')
    }
  }

  if (valorEtapa <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
        <p className="text-[11px] text-gray-500 leading-snug">
          💡 Defina o <strong>valor total do serviço</strong> acima para dividir automaticamente nestas etapas e habilitar o Pix.
        </p>
      </div>
    )
  }

  if (!pagamento && meuTipo === 'profissional') {
    return (
      <div className="rounded-xl border border-gray-100 bg-white/60 px-3 py-2">
        <p className="text-[11px] text-gray-500">
          Etapa: <strong>{formatarValorBrl(valorEtapa)}</strong> — o cliente paga pela plataforma (Pix).
        </p>
      </div>
    )
  }

  if (!pagamento && meuTipo === 'cliente') {
    if (!podePagar) return null
    return (
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Pix pela plataforma</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formatarValorBrl(valorEtapa)}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Pagamento exclusivo MaoCerta (demo). Comissão da plataforma já descontada no repasse ao prestador.
            </p>
          </div>
          <span className="text-2xl shrink-0" aria-hidden>
            💠
          </span>
        </div>
        <button
          type="button"
          disabled={processando}
          onClick={criarPix}
          className="w-full rounded-xl bg-violet-700 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-800 disabled:opacity-50"
        >
          {processando ? 'Gerando…' : 'Pagar etapa com Pix'}
        </button>
        {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}
      </div>
    )
  }

  if (!pagamento) return null

  const badge = statusLabel(pagamento.status)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pagamento desta etapa</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.txt}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-gray-50 px-2 py-2">
          <p className="text-[10px] text-gray-500 uppercase">Bruto</p>
          <p className="text-sm font-bold text-gray-900">{formatarValorBrl(Number(pagamento.valor_bruto))}</p>
        </div>
        <div className="rounded-lg bg-rose-50/80 px-2 py-2">
          <p className="text-[10px] text-rose-700 uppercase">Plataforma ({Number(pagamento.comissao_percentual)}%)</p>
          <p className="text-sm font-bold text-rose-800">− {formatarValorBrl(Number(pagamento.valor_comissao))}</p>
        </div>
        <div className="rounded-lg bg-emerald-50/80 px-2 py-2">
          <p className="text-[10px] text-emerald-800 uppercase">Prestador</p>
          <p className="text-sm font-bold text-emerald-900">{formatarValorBrl(Number(pagamento.valor_liquido_prestador))}</p>
        </div>
      </div>

      {pagamento.status === 'aguardando_pix' && meuTipo === 'cliente' && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600">
            <strong>Sandbox:</strong> copie o código abaixo e simule o pagamento no app do banco (ou use o botão para demo).
          </p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-24 overflow-y-auto">
            <code className="text-[10px] leading-tight text-gray-700 break-all">{pagamento.pix_copia_e_cola}</code>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={copiarPix}
              className="flex-1 rounded-xl border border-violet-300 bg-white py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
            >
              {copiou ? 'Copiado!' : 'Copiar código Pix'}
            </button>
            <button
              type="button"
              disabled={processando}
              onClick={confirmarSandbox}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {processando ? '…' : 'Já paguei (simular)'}
            </button>
          </div>
        </div>
      )}

      {pagamento.status === 'pago_retido' && (
        <div className="rounded-xl bg-amber-50/90 border border-amber-100 px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-amber-950">Valor retido na plataforma</p>
          <p className="text-[11px] text-amber-900/90 leading-relaxed">
            O repasse ao prestador ocorre automaticamente quando <strong>ambos</strong> confirmarem a conclusão desta etapa.
          </p>
          {meuTipo === 'cliente' && ativo && (
            <div className="pt-2 border-t border-amber-200/80 mt-2">
              {!mostrarDisputa ? (
                <button
                  type="button"
                  onClick={() => setMostrarDisputa(true)}
                  className="text-[11px] font-semibold text-orange-800 underline-offset-2 hover:underline"
                >
                  Abrir contestação (suspende o repasse)
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={motivoDisputa}
                    onChange={e => setMotivoDisputa(e.target.value)}
                    rows={2}
                    placeholder="Descreva o problema (opcional neste demo)…"
                    className="w-full text-xs rounded-lg border border-orange-200 px-2 py-1.5"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={processando}
                      onClick={enviarDisputa}
                      className="flex-1 rounded-lg bg-orange-600 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      Registrar retenção
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarDisputa(false)
                        setMotivoDisputa('')
                      }}
                      className="text-xs font-semibold text-gray-600 px-2"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pagamento.status === 'em_disputa' && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
          <p className="font-semibold">Contestação registrada</p>
          {pagamento.dispute_motivo && <p className="mt-1 text-orange-900/90">{pagamento.dispute_motivo}</p>}
          <p className="mt-1 text-[11px] text-orange-800/90">O repasse fica bloqueado até a moderação concluir a análise.</p>
        </div>
      )}

      {pagamento.status === 'liberado' && (
        <p className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
          <span>✓</span> Valor creditado na carteira interna do prestador (após confirmações e liberação).
        </p>
      )}

      {meuTipo === 'profissional' && pagamento.status !== 'aguardando_pix' && (
        <p className="text-[11px] text-gray-500">
          Acompanhamento financeiro visível para você e o cliente — sem alteração manual de saldo (RN24).
        </p>
      )}

      {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}
    </div>
  )
}

function mapErro(c?: string) {
  switch (c) {
    case 'valor_etapa_nao_definido':
      return 'Defina o valor total do serviço antes de pagar.'
    case 'ja_existe_pagamento':
      return 'Já existe um pagamento em andamento para esta etapa.'
    case 'apenas_cliente':
      return 'Apenas o cliente inicia o Pix.'
    case 'etapa_nao_pagavel':
      return 'Esta etapa ainda não aceita pagamento.'
    case 'status_invalido':
      return 'Status do pagamento não permite esta ação.'
    case 'sem_retencao_para_disputa':
      return 'Não há valor retido para contestar.'
    default:
      return c ? `Erro: ${c}` : 'Operação não permitida.'
  }
}
