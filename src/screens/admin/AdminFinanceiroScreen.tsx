'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { financeiroService } from '@/lib/supabase/financeiro'
import { formatarDataPt } from '@/lib/formatar-data'

type DisputaRow = {
  id: string
  etapa_id: string
  solicitacao_id: string
  status: string
  motivo: string | null
  created_at: string
}

type PagRow = {
  id: string
  etapa_id: string
  valor_bruto: number
  valor_comissao: number
  status: string
  pago_em: string | null
}

function formatarValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminFinanceiroScreen() {
  const [disputas, setDisputas] = useState<DisputaRow[]>([])
  const [comissoes, setComissoes] = useState<PagRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [procMsg, setProcMsg] = useState<string | null>(null)
  const [procLoading, setProcLoading] = useState(false)

  async function processarLiberacoes() {
    setProcMsg(null)
    setProcLoading(true)
    try {
      const r = await financeiroService.processarLiberacoesAgendadas()
      if (!r.ok) {
        setProcMsg(r.erro || 'Falha')
        return
      }
      const n = typeof r.processados === 'number' ? r.processados : 0
      setProcMsg(`Processados: ${n} repasse(s) agendado(s).`)
      await carregar()
    } catch (e) {
      console.error(e)
      setProcMsg('Erro ao chamar RPC (ver permissão admin / migração 021).')
    } finally {
      setProcLoading(false)
    }
  }

  async function carregar() {
    setCarregando(true)
    setMsg(null)
    try {
      const supabase = createClient()
      const [dRes, pRes] = await Promise.all([
        supabase.from('disputas').select('*').order('created_at', { ascending: false }).limit(40),
        supabase
          .from('pagamentos')
          .select('id, etapa_id, valor_bruto, valor_comissao, status, pago_em')
          .not('pago_em', 'is', null)
          .order('pago_em', { ascending: false })
          .limit(60),
      ])
      if (dRes.error) throw dRes.error
      if (pRes.error) throw pRes.error
      setDisputas((dRes.data as DisputaRow[]) || [])
      setComissoes((pRes.data as PagRow[]) || [])
    } catch (e) {
      console.error(e)
      setMsg('Sem permissão ou erro ao carregar dados financeiros.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function resolver(etapaId: string, acao: 'liberar' | 'estornar') {
    setMsg(null)
    try {
      const r = await financeiroService.resolverDisputaAdmin(etapaId, acao)
      if (!r.ok) {
        setMsg(r.erro || 'Falha')
        return
      }
      setMsg(acao === 'liberar' ? 'Repasse liberado.' : 'Estorno registrado.')
      await carregar()
    } catch (e) {
      console.error(e)
      setMsg('Erro ao resolver disputa.')
    }
  }

  const disputasAbertas = disputas.filter(d =>
    ['aberta', 'aguardando_prestador', 'aguardando_cliente', 'em_analise'].includes(d.status)
  )

  const totalComissao = comissoes.reduce((a, p) => a + Number(p.valor_comissao || 0), 0)

  return (
    <main className="min-h-screen bg-slate-50 pb-24 px-4 pt-8">
      <div className="max-w-lg mx-auto space-y-6">
        <header>
          <Link href="/admin/inicio" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            ← Início
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Financeiro & disputas</h1>
          <p className="text-sm text-slate-600 mt-1">RF42.3 / RF45 — visão administrativa.</p>
        </header>

        {msg && (
          <p className="text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800">{msg}</p>
        )}

        {carregando && <p className="text-sm text-slate-500">Carregando…</p>}

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Comissões (amostra recente)</h2>
          <p className="text-xs text-slate-500 mt-1">Soma comissões na lista: {formatarValor(totalComissao)}</p>
          <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto text-xs">
            {comissoes.slice(0, 15).map(p => (
              <li key={p.id} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{p.pago_em ? formatarDataPt(p.pago_em) : '—'}</span>
                <span className="font-semibold text-rose-700">{formatarValor(Number(p.valor_comissao))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-slate-900">Liberações agendadas (48h)</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Após a migração 021, valores em escrow com prazo vencido só creditam quando este job roda (cron ou manual).
          </p>
          {procMsg && <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">{procMsg}</p>}
          <button
            type="button"
            disabled={procLoading}
            onClick={() => void processarLiberacoes()}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-slate-800"
          >
            {procLoading ? 'Processando…' : 'Processar liberações agendadas agora'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Disputas em aberto</h2>
          {disputasAbertas.length === 0 && <p className="text-xs text-slate-500">Nenhuma disputa pendente.</p>}
          {disputasAbertas.map(d => (
            <div key={d.id} className="rounded-xl border border-orange-100 bg-orange-50/80 p-3 space-y-2">
              <p className="text-[11px] text-orange-900 font-mono">Etapa: {d.etapa_id}</p>
              <p className="text-xs text-orange-950">{d.motivo || 'Sem motivo'}</p>
              <p className="text-[10px] text-orange-800">Status: {d.status}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolver(d.etapa_id, 'liberar')}
                  className="flex-1 rounded-lg bg-emerald-700 py-2 text-[11px] font-bold text-white"
                >
                  Liberar prestador
                </button>
                <button
                  type="button"
                  onClick={() => resolver(d.etapa_id, 'estornar')}
                  className="flex-1 rounded-lg bg-red-700 py-2 text-[11px] font-bold text-white"
                >
                  Estornar cliente
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
