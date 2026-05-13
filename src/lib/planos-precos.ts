// Fonte unica dos precos de plano. Mudou aqui = mudou em todo lugar.
import type { PlanoUsuario } from './plano-limites'

export type TipoUsuario = 'cliente' | 'profissional' | 'administrador'

// Mercado Pago exige valor minimo de R$ 0,50 para Pix em sandbox.
export const PRECOS_PLANO: Record<TipoUsuario, Record<PlanoUsuario, number>> = {
  cliente: { free: 0, basico: 0.50, premium: 1.00 },
  profissional: { free: 0, basico: 0.50, premium: 1.50 },
  administrador: { free: 0, basico: 0, premium: 0 },
}

export function precoPlano(tipo: string | null | undefined, plano: PlanoUsuario): number {
  const t = (tipo === 'cliente' || tipo === 'profissional' || tipo === 'administrador') ? tipo : 'cliente'
  return PRECOS_PLANO[t][plano] ?? 0
}

export function formatarPrecoPlano(tipo: string | null | undefined, plano: PlanoUsuario): string {
  const v = precoPlano(tipo, plano)
  if (v === 0) return 'Grátis'
  return `R$ ${v.toFixed(2).replace('.', ',')}/mês`
}
