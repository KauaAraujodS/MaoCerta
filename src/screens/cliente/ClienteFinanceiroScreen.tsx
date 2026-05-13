'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { financeiroService } from '@/lib/supabase/financeiro'
import { formatarDataPt } from '@/lib/formatar-data'
import { labelStatusPagamento, normalizarStatusPagamento } from '@/lib/financeiro/status-pagamento'

type LinhaExtrato = {
  id: string
  status: string
  valor_bruto: number
  valor_comissao: number
  valor_liquido_prestador: number
  created_at: string
  pago_em: string | null
  liberado_em: string | null
  etapa_id: string
  solicitacao_id: string
}

function formatarValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ClienteFinanceiroScreen() {
  const [linhas, setLinhas] = useState<LinhaExtrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      setCarregando(true)
      setErro(null)
      try {
        const raw = await financeiroService.getExtratoCliente()
        if (!cancel) setLinhas((raw as LinhaExtrato[]) || [])
      } catch (e) {
        console.error(e)
        if (!cancel) setErro('Não foi possível carregar o extrato.')
      } finally {
        if (!cancel) setCarregando(false)
      }
    }
    void load()
    return () => {
      cancel = true
    }
  }, [])

  const totalPago = linhas
    .filter(l => ['em_escrow', 'liberado', 'contestado', 'pago'].includes(normalizarStatusPagamento(l.status)))
    .reduce((a, l) => a + Number(l.valor_bruto), 0)

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50/50 to-white dark:from-slate-950 dark:to-slate-950 pb-24">
      <header className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-4 pt-10 pb-8 rounded-b-3xl shadow-lg">
        <div className="max-w-lg mx-auto space-y-2">
          <Link href="/cliente/configuracoes" className="text-[11px] font-semibold text-white/80 hover:text-white">
            ← Voltar
          </Link>
          <p className="text-[11px] uppercase tracking-widest text-white/70">S3 · Cliente</p>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-white/85">Pagamento → contrato → etapa → serviço (RF41.3).</p>
          <p className="text-lg font-bold mt-2">Total pago (Pix confirmado): {formatarValor(totalPago)}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {carregando && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
            <span className="inline-block w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            Carregando…
          </div>
        )}
        {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{erro}</p>}

        {!carregando && linhas.length === 0 && !erro && (
          <p className="text-sm text-gray-600 dark:text-slate-400">Nenhum pagamento registrado ainda.</p>
        )}

        <ul className="space-y-2">
          {linhas.map(l => {
            const badge = labelStatusPagamento(l.status)
            const titulo = `Contrato ${l.solicitacao_id.slice(0, 8)}…`
            const etLabel = `Etapa ${l.etapa_id.slice(0, 8)}…`
            return (
              <li key={l.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 space-y-1">
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <Link
                      href={`/cliente/atendimentos/${l.solicitacao_id}`}
                      className="text-sm font-bold text-violet-800 dark:text-violet-300 hover:underline"
                    >
                      {titulo}
                    </Link>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">{etLabel}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                    {badge.txt}
                  </span>
                </div>
                <p className="text-base font-bold text-violet-800 dark:text-violet-300">{formatarValor(Number(l.valor_bruto))}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">
                  Criado {formatarDataPt(l.created_at)}
                  {l.pago_em && ` · Pago ${formatarDataPt(l.pago_em)}`}
                  {l.liberado_em && ` · Liberado ${formatarDataPt(l.liberado_em)}`}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  Comissão plataforma {formatarValor(Number(l.valor_comissao))} · Líquido prestador{' '}
                  {formatarValor(Number(l.valor_liquido_prestador))}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
