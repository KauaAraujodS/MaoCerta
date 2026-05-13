import { describe, expect, it } from 'vitest'
import { labelStatusPagamento, normalizarStatusPagamento, pagamentoPermiteIniciarEtapa } from '../status-pagamento'

describe('status pagamento', () => {
  it('normaliza legado', () => {
    expect(normalizarStatusPagamento('aguardando_pix')).toBe('aguardando_pagamento')
    expect(normalizarStatusPagamento('pago_retido')).toBe('em_escrow')
    expect(normalizarStatusPagamento('em_disputa')).toBe('contestado')
  })

  it('permite iniciar etapa com escrow ou liberado', () => {
    expect(pagamentoPermiteIniciarEtapa('em_escrow')).toBe(true)
    expect(pagamentoPermiteIniciarEtapa('liberado')).toBe(true)
    expect(pagamentoPermiteIniciarEtapa('aguardando_pagamento')).toBe(false)
  })

  it('rótulos conhecidos', () => {
    expect(labelStatusPagamento('contestado').txt).toMatch(/Contest/i)
  })
})
