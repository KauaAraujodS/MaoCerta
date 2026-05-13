'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  atendimentoId: string
  profissionalId: string
  nomePrestador: string
  statusAtendimento: string
}

export default function AvaliarPrestadorCard({
  atendimentoId,
  profissionalId,
  nomePrestador,
  statusAtendimento,
}: Props) {
  const [jaAvaliou, setJaAvaliou] = useState(false)
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [temSessao, setTemSessao] = useState(true)

  useEffect(() => {
    let cancel = false
    async function checar() {
      setCarregando(true)
      if (statusAtendimento !== 'concluida') {
        if (!cancel) {
          setCarregando(false)
          setJaAvaliou(true)
        }
        return
      }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancel) {
          setTemSessao(false)
          setCarregando(false)
        }
        return
      }
      const { data } = await supabase
        .from('avaliacoes')
        .select('id')
        .eq('atendimento_id', atendimentoId)
        .eq('avaliador_id', user.id)
        .maybeSingle()
      if (!cancel) {
        setJaAvaliou(!!data)
        setCarregando(false)
      }
    }
    void checar()
    return () => {
      cancel = true
    }
  }, [atendimentoId, statusAtendimento])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErro('Faça login para avaliar.')
        return
      }
      const { error } = await supabase.from('avaliacoes').insert({
        atendimento_id: atendimentoId,
        avaliador_id: user.id,
        avaliado_id: profissionalId,
        nota,
        comentario: comentario.trim() || null,
      })
      if (error) {
        setErro(error.message)
        return
      }
      setOk(true)
      setJaAvaliou(true)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível enviar a avaliação.')
    } finally {
      setEnviando(false)
    }
  }

  if (statusAtendimento !== 'concluida') return null
  if (!temSessao) return null
  if (carregando) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 flex items-center gap-3 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-violet-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (jaAvaliou) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 text-center">
        <p className="text-sm font-bold text-emerald-900">{ok ? 'Obrigado pela avaliação!' : 'Avaliação já registrada'}</p>
        <p className="text-xs text-emerald-800 mt-1">
          {ok ? 'Sua opinião ajuda outros clientes na MaoCerta.' : 'Você já avaliou este prestador neste atendimento.'}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-3 text-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">RF46 · Pós-atendimento</p>
        <h2 className="text-base font-bold">Avaliar {nomePrestador || 'o prestador'}</h2>
      </div>
      <form onSubmit={enviar} className="p-4 sm:p-5 space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          Como foi sua experiência com este profissional neste atendimento?
        </p>
        <div className="flex justify-between gap-1 sm:justify-start sm:gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              className={`flex-1 sm:flex-none sm:w-11 h-11 rounded-xl text-lg font-bold transition border-2 ${
                nota >= n
                  ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-amber-200'
              }`}
              aria-label={`${n} estrelas`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Comentário (opcional)</span>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Destaque pontos positivos ou o que pode melhorar…"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:bg-white resize-none"
          />
        </label>
        {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-xl bg-violet-700 py-3 text-sm font-bold text-white shadow hover:bg-violet-800 disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar avaliação'}
        </button>
      </form>
    </section>
  )
}
