export type PlanoUsuario = 'free' | 'basico' | 'premium'

export type LimitesPlano = {
  maxCategorias: number
  maxServicos: number
  maxDemandasAtivas: number
  maxPropostasPorDemanda: number
}

export const LIMITES_PLANO: Record<PlanoUsuario, LimitesPlano> = {
  free: {
    maxCategorias: 2,
    maxServicos: 3,
    maxDemandasAtivas: 1,
    maxPropostasPorDemanda: 1,
  },
  basico: {
    maxCategorias: 5,
    maxServicos: 10,
    maxDemandasAtivas: 5,
    maxPropostasPorDemanda: 2,
  },
  premium: {
    maxCategorias: 999,
    maxServicos: 999,
    maxDemandasAtivas: 999,
    maxPropostasPorDemanda: 5,
  },
}

export function nomePlano(plano: string | null | undefined) {
  if (plano === 'basico') return 'Pro'
  if (plano === 'premium') return 'Premium Pro'
  return 'Free'
}

export function obterLimitesPlano(plano: string | null | undefined): LimitesPlano {
  if (plano === 'basico') return LIMITES_PLANO.basico
  if (plano === 'premium') return LIMITES_PLANO.premium
  return LIMITES_PLANO.free
}
