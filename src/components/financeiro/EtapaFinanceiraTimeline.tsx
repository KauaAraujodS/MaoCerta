import { labelStatusPagamento, normalizarStatusPagamento } from '@/lib/financeiro/status-pagamento'
import type { Pagamento } from '@/types'
import type { Etapa } from '@/types'

type Props = {
  etapa: Etapa
  pagamento: Pagamento | null
}

const etapaSteps = ['agendada', 'em_progresso', 'concluida'] as const

function stepEtapaIndex(status: string) {
  if (status === 'concluida') return 2
  if (status === 'em_progresso') return 1
  return 0
}

export default function EtapaFinanceiraTimeline({ etapa, pagamento }: Props) {
  const si = stepEtapaIndex(etapa.status)
  const paySt = pagamento ? normalizarStatusPagamento(pagamento.status) : null

  const pixOk = !!pagamento && paySt !== 'aguardando_pagamento'
  const escrowOk =
    paySt === 'em_escrow' || paySt === 'contestado' || paySt === 'liberado' || paySt === 'pago'
  const disputaOuLiberado = paySt === 'contestado' || paySt === 'liberado'
  const finalLabel =
    paySt === 'contestado' ? 'Em disputa' : paySt === 'liberado' ? 'Repasse liberado' : 'Aguardando liberação'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/50 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Linha do tempo</p>
      <div className="flex flex-wrap gap-2">
        {etapaSteps.map((_, i) => (
          <span
            key={etapaSteps[i]}
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
              i <= si
                ? 'bg-violet-100 dark:bg-violet-950 border-violet-300 text-violet-900 dark:text-violet-200'
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
            }`}
          >
            {i === 0 ? '1. Agendada' : i === 1 ? '2. Em progresso' : '3. Concluída'}
          </span>
        ))}
      </div>
      {pagamento && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/80 dark:border-slate-700">
          <span
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
              pixOk ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 text-sky-900' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
            }`}
          >
            Pix confirmado
          </span>
          <span
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
              escrowOk ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
            }`}
          >
            Retenção
          </span>
          <span
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
              disputaOuLiberado ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
            }`}
          >
            {finalLabel}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-slate-500 ml-auto">{labelStatusPagamento(pagamento.status).txt}</span>
        </div>
      )}
      {!pagamento && (
        <p className="text-[10px] text-gray-500 dark:text-slate-500">Pagamento ainda não iniciado nesta etapa.</p>
      )}
    </div>
  )
}
