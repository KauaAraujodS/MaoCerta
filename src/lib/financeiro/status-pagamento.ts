import type { StatusPagamento } from '@/types'

/** Normaliza status legados da migração incremental */
export function normalizarStatusPagamento(s: StatusPagamento | string): StatusPagamento {
  switch (s) {
    case 'aguardando_pix':
      return 'aguardando_pagamento'
    case 'pago_retido':
      return 'em_escrow'
    case 'em_disputa':
      return 'contestado'
    default:
      return s as StatusPagamento
  }
}

export function labelStatusPagamento(s: StatusPagamento | string): { txt: string; cls: string } {
  const n = normalizarStatusPagamento(s as StatusPagamento)
  switch (n) {
    case 'aguardando_pagamento':
      return { txt: 'Aguardando pagamento', cls: 'bg-sky-50 text-sky-800 border-sky-200' }
    case 'pago':
      return { txt: 'Pago', cls: 'bg-blue-50 text-blue-900 border-blue-200' }
    case 'em_escrow':
      return { txt: 'Em escrow (retenção)', cls: 'bg-amber-50 text-amber-900 border-amber-200' }
    case 'liberado':
      return { txt: 'Repasse liberado', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'contestado':
      return { txt: 'Contestado', cls: 'bg-orange-50 text-orange-900 border-orange-200' }
    case 'cancelado':
      return { txt: 'Cancelado', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    default:
      return { txt: String(s), cls: 'bg-gray-50 text-gray-700 border-gray-200' }
  }
}

export function pagamentoPermiteIniciarEtapa(status: StatusPagamento | string | undefined): boolean {
  if (!status) return false
  const n = normalizarStatusPagamento(status)
  return n === 'em_escrow' || n === 'liberado'
}
