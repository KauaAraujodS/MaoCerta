'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { iconeCategoria } from '@/lib/categorias-ui'
import { formatarRelativoPt } from '@/lib/formatar-data'

type Demanda = {
  id: string
  titulo: string
  descricao: string
  categoria_id: number
  status: string
  created_at: string
  cliente_id: string
  categorias: { nome: string } | null
  cliente: { nome: string; cidade: string | null } | null
}

export default function ProfissionalDemandasScreen() {
  const router = useRouter()
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const demandasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return demandas
    return demandas.filter((d) => {
      const cat = d.categorias?.nome?.toLowerCase() || ''
      return (
        d.titulo.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q) ||
        cat.includes(q)
      )
    })
  }, [demandas, busca])

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    setAviso(null)
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login como prestador para ver as demandas.' })
      setCarregando(false)
      return
    }
    setUserId(user.id)

    const [recusasRes, aceitasRes] = await Promise.all([
      supabase.from('demanda_recusas').select('demanda_id').eq('profissional_id', user.id),
      supabase
        .from('solicitacoes')
        .select('demanda_origem_id')
        .eq('profissional_id', user.id)
        .not('demanda_origem_id', 'is', null),
    ])

    const idsExcluidos = new Set<string>([
      ...(recusasRes.data?.map((r: { demanda_id: string }) => r.demanda_id) || []),
      ...(aceitasRes.data?.map((a: { demanda_origem_id: string }) => a.demanda_origem_id) || []),
    ])

    const { data, error } = await supabase
      .from('demandas')
      .select(`
        id, titulo, descricao, categoria_id, status, created_at, cliente_id,
        categorias ( nome ),
        cliente:cliente_id ( nome, cidade )
      `)
      .eq('status', 'aberta')
      .neq('cliente_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[demandas] select', error)
      setAviso({ tipo: 'erro', texto: `Erro ao carregar: ${error.message}` })
    } else {
      const lista = ((data as unknown as Demanda[] | null) || []).filter((d) => !idsExcluidos.has(d.id))
      setDemandas(lista)
    }
    setCarregando(false)
  }

  async function aceitar(demanda: Demanda) {
    if (!userId) return
    setAcaoEmCurso(demanda.id)
    setAviso(null)
    const supabase = createClient()

    const { error } = await supabase.from('solicitacoes').insert({
      cliente_id: demanda.cliente_id,
      profissional_id: userId,
      titulo: demanda.titulo,
      descricao: demanda.descricao,
      status: 'aceita',
      demanda_origem_id: demanda.id,
    })

    setAcaoEmCurso(null)

    if (error) {
      console.error('[aceitar] insert solicitacao', error)
      setAviso({ tipo: 'erro', texto: `Não foi possível aceitar: ${error.message}` })
      return
    }

    setDemandas((atual) => atual.filter((d) => d.id !== demanda.id))
    setAviso({ tipo: 'ok', texto: 'Demanda aceita. Encontre o atendimento na aba Atendimentos.' })
    setTimeout(() => router.push('/profissional/atendimentos'), 900)
  }

  async function recusar(demanda: Demanda) {
    if (!userId) return
    setAcaoEmCurso(demanda.id)
    setAviso(null)
    const supabase = createClient()

    const { error } = await supabase.from('demanda_recusas').insert({
      demanda_id: demanda.id,
      profissional_id: userId,
    })

    setAcaoEmCurso(null)

    if (error) {
      console.error('[recusar] insert demanda_recusas', error)
      setAviso({ tipo: 'erro', texto: `Não foi possível recusar: ${error.message}` })
      return
    }

    setDemandas((atual) => atual.filter((d) => d.id !== demanda.id))
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 pb-10">
      <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-700 text-white px-4 pt-8 pb-10 rounded-b-[2rem] shadow-lg">
        <div className="max-w-lg mx-auto space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Marketplace</p>
          <h1 className="text-2xl font-bold leading-tight">Demandas públicas</h1>
          <p className="text-sm text-white/85 leading-relaxed">
            Pedidos abertos por clientes. Aceite para abrir um atendimento e conversar com o cliente, ou recuse para ocultar da sua lista.
          </p>
          <div className="relative pt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">🔎</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, descrição ou categoria..."
              className="w-full rounded-xl bg-white/15 border border-white/25 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 relative z-10">
        {aviso && (
          <p
            className={`text-xs rounded-xl p-3 font-medium border ${
              aviso.tipo === 'ok'
                ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                : 'text-red-900 bg-red-50 border-red-200'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {carregando && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Carregando demandas...</p>
          </div>
        )}

        {!carregando && demandasFiltradas.length === 0 && demandas.length > 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Nenhuma demanda combina com a busca. Limpe o filtro para ver todas.
          </p>
        )}

        {!carregando &&
          demandasFiltradas.map((d) => {
            const catNome = d.categorias?.nome || 'Categoria'
            const cliente = d.cliente
            const acaoCarregando = acaoEmCurso === d.id
            return (
              <article
                key={d.id}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {iconeCategoria(catNome)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {catNome}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-auto">{formatarRelativoPt(d.created_at)}</span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 leading-snug">{d.titulo}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{d.descricao}</p>

                  {cliente && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{cliente.nome}</span>
                      {cliente.cidade && (
                        <>
                          <span className="text-gray-300"> · </span>
                          {cliente.cidade}
                        </>
                      )}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => aceitar(d)}
                      disabled={acaoCarregando}
                      className="flex-1 min-w-[120px] text-sm font-semibold bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {acaoCarregando ? 'Aceitando...' : 'Aceitar demanda'}
                    </button>
                    <button
                      type="button"
                      onClick={() => recusar(d)}
                      disabled={acaoCarregando}
                      className="flex-1 min-w-[120px] text-sm font-semibold bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

        {!carregando && demandas.length === 0 && (
          <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center space-y-2">
            <p className="text-4xl">📭</p>
            <p className="text-sm font-semibold text-gray-800">Nenhuma demanda no momento</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
              Quando algum cliente publicar uma demanda compatível com sua atuação, ela aparece aqui.
              Demandas que você recusou ou aceitou não voltam a aparecer.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
