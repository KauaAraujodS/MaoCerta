/** Moeda BRL (ex.: "R$ 120,00"). */
export function formatarValorBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data curta em pt-BR, ex.: "30/04/2026". */
export function formatarDataPt(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Texto relativo simples (ex.: "há 2 dias"). */
export function formatarRelativoPt(iso: string) {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'agora'
    if (min < 60) return `há ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `há ${h} h`
    const days = Math.floor(h / 24)
    if (days < 7) return `há ${days} dia${days > 1 ? 's' : ''}`
    return formatarDataPt(iso)
  } catch {
    return ''
  }
}
