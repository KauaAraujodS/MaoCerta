'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nomePlano, obterLimitesPlano } from '@/lib/plano-limites'

type Demanda = {
  id: string
  titulo: string
  descricao: string
  categoria_id: number
  status: string
  created_at: string
}

export default function ProfissionalDemandasScreen() {
  const [plano, setPlano] = useState('free')
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('')
  const [demandaSelecionada, setDemandaSelecionada] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const limites = useMemo(() => obterLimitesPlano(plano), [plano])

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user

      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('plano').eq('id', user.id).maybeSingle()
        setPlano(perfil?.plano || 'free')
      }

      const { data } = await supabase
        .from('demandas')
        .select('id, titulo, descricao, categoria_id, status, created_at')
        .eq('status', 'aberta')
        .order('created_at', { ascending: false })
        .limit(limites.maxDemandasAtivas)

      setDemandas((data as Demanda[] | null) || [])
      setCarregando(false)
    }
    carregar()
  }, [limites.maxDemandasAtivas])

  async function enviarProposta(e: FormEvent) {
    e.preventDefault()
    if (!demandaSelecionada || !mensagem.trim() || !valor.trim() || !prazo.trim()) return

    setAviso(null)
    setEnviandoId(demandaSelecionada)
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setAviso('Faça login para enviar proposta.')
      setEnviandoId(null)
      return
    }

    const { count } = await supabase
      .from('propostas')
      .select('*', { count: 'exact', head: true })
      .eq('demanda_id', demandaSelecionada)
      .eq('profissional_id', user.id)

    if ((count || 0) >= limites.maxPropostasPorDemanda) {
      setAviso(`Seu plano ${nomePlano(plano)} permite até ${limites.maxPropostasPorDemanda} proposta(s) por demanda.`)
      setEnviandoId(null)
      return
    }

    const { error } = await supabase.from('propostas').insert({
      demanda_id: demandaSelecionada,
      profissional_id: user.id,
      mensagem: mensagem.trim(),
      valor_proposto: Number(valor.replace(',', '.')),
      prazo: prazo.trim(),
    })

    setEnviandoId(null)
    if (error) {
      setAviso('Falha ao enviar proposta.')
      return
    }

    setMensagem('')
    setValor('')
    setPrazo('')
    setDemandaSelecionada(null)
    setAviso('Proposta enviada com sucesso.')
  }

  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Demandas públicas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plano {nomePlano(plano)}: visualizando até {limites.maxDemandasAtivas} demanda(s) abertas por vez.
        </p>
      </header>

      {carregando && <p className="text-sm text-gray-500">Carregando...</p>}

      {!carregando &&
        demandas.map((d) => (
          <section key={d.id} className="bg-white rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-semibold text-gray-900">{d.titulo}</p>
              <p className="text-sm text-gray-600 mt-1">{d.descricao}</p>
            </div>
            <button
              type="button"
              onClick={() => setDemandaSelecionada((atual) => (atual === d.id ? null : d.id))}
              className="text-sm font-semibold text-emerald-700"
            >
              {demandaSelecionada === d.id ? 'Cancelar' : 'Enviar proposta'}
            </button>

            {demandaSelecionada === d.id && (
              <form onSubmit={enviarProposta} className="space-y-2">
                <textarea
                  rows={3}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Explique como você vai executar o serviço"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Valor proposto (R$)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  placeholder="Prazo (ex.: 3 dias)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={enviandoId === d.id}
                  className="w-full bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
                >
                  {enviandoId === d.id ? 'Enviando...' : 'Confirmar proposta'}
                </button>
              </form>
            )}
          </section>
        ))}

      {!carregando && demandas.length === 0 && (
        <section className="bg-white rounded-2xl p-4">
          <p className="text-sm text-gray-500">Nenhuma demanda pública disponível neste momento.</p>
        </section>
      )}

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
    </main>
  )
}
