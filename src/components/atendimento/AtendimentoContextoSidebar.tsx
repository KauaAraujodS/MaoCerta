import { formatarDataPt, formatarValorBrl } from '@/lib/formatar-data'

type Props = {
  titulo: string
  descricao: string
  statusLabel: string
  criadoEm: string
  valorTotal: number | null
  outroPapel: 'cliente' | 'prestador'
  outroNome: string
}

export default function AtendimentoContextoSidebar({
  titulo,
  descricao,
  statusLabel,
  criadoEm,
  valorTotal,
  outroPapel,
  outroNome,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-4 shadow-sm space-y-3 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Resumo</p>
      <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-snug">{titulo}</h2>
      <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed line-clamp-6">{descricao}</p>
      <dl className="space-y-2 text-xs border-t border-gray-100 dark:border-slate-800 pt-3">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-slate-500">Status</dt>
          <dd className="font-semibold text-gray-900 dark:text-slate-100 text-right">{statusLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-slate-500">Aberto em</dt>
          <dd className="text-gray-800 dark:text-slate-200 text-right">{formatarDataPt(criadoEm)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-slate-500">{outroPapel === 'prestador' ? 'Prestador' : 'Cliente'}</dt>
          <dd className="text-gray-800 dark:text-slate-200 text-right truncate max-w-[10rem]">{outroNome}</dd>
        </div>
        {valorTotal != null && valorTotal > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500 dark:text-slate-500">Valor total</dt>
            <dd className="font-bold text-emerald-800 dark:text-emerald-400">{formatarValorBrl(valorTotal)}</dd>
          </div>
        )}
      </dl>
      <p className="text-[10px] text-gray-500 dark:text-slate-500 leading-relaxed border-t border-gray-100 dark:border-slate-800 pt-3">
        O chat e as etapas ficam à esquerda no desktop. Use o menu inferior para sair desta tela.
      </p>
    </div>
  )
}
