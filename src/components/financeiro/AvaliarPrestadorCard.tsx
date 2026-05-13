'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { avaliacoesService } from '@/lib/supabase/avaliacoes'
import { financeiroService } from '@/lib/supabase/financeiro'
import { prestadorService } from '@/lib/supabase/prestador'
import { normalizarStatusPagamento } from '@/lib/financeiro/status-pagamento'

type Props = {
  atendimentoId: string
  profissionalId: string
  nomePrestador: string
  statusAtendimento: string
}

type AvaliacaoRecebida = {
  id: string
  resposta_prestador: string | null
  nota: number
  comentario: string | null
}

export default function AvaliarPrestadorCard({
  atendimentoId,
  profissionalId,
  nomePrestador,
  statusAtendimento,
}: Props) {
  const [modo, setModo] = useState<'carregando' | 'cliente_form' | 'cliente_ok' | 'prestador_resposta' | 'visitante'>(
    'carregando'
  )
  const [avRecebida, setAvRecebida] = useState<AvaliacaoRecebida | null>(null)
  const [nq, setNq] = useState(5)
  const [np, setNp] = useState(5)
  const [nc, setNc] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancel = false
    async function checar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancel) setModo('visitante')
        return
      }

      if (user.id === profissionalId) {
        const { data: av } = await supabase
          .from('avaliacoes')
          .select('id, resposta_prestador, nota, comentario')
          .eq('atendimento_id', atendimentoId)
          .eq('avaliado_id', user.id)
          .maybeSingle()
        if (!cancel) {
          if (av) {
            setAvRecebida(av as AvaliacaoRecebida)
            setModo('prestador_resposta')
          } else {
            setModo('visitante')
          }
        }
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('tipo').eq('id', user.id).maybeSingle()
      if (perfil?.tipo !== 'cliente') {
        if (!cancel) setModo('visitante')
        return
      }

      const { data: existente } = await supabase
        .from('avaliacoes')
        .select('id')
        .eq('atendimento_id', atendimentoId)
        .eq('avaliador_id', user.id)
        .maybeSingle()

      if (existente) {
        if (!cancel) setModo('cliente_ok')
        return
      }

      const etapas = await prestadorService.getEtapasAtendimento(atendimentoId)
      const ultima = etapas.length ? etapas[etapas.length - 1] : null
      const pagamentos = ultima ? await financeiroService.getPagamentosPorSolicitacao(atendimentoId) : []
      const pagUltima = pagamentos.find(p => p.etapa_id === ultima?.id)
      const liberado = pagUltima && normalizarStatusPagamento(pagUltima.status) === 'liberado'
      const pode =
        !!liberado && ['em_andamento', 'concluida'].includes(statusAtendimento)

      if (!cancel) setModo(pode ? 'cliente_form' : 'visitante')
    }
    void checar()
    return () => {
      cancel = true
    }
  }, [atendimentoId, statusAtendimento, profissionalId])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await avaliacoesService.criarPosEtapa(
        atendimentoId,
        { qualidade: nq, prazo: np, comunicacao: nc },
        comentario
      )
      if (!r.ok) {
        setErro(mapErro(r.erro))
        return
      }
      setOk(true)
      setModo('cliente_ok')
    } catch (err) {
      console.error(err)
      setErro('Não foi possível enviar a avaliação.')
    } finally {
      setEnviando(false)
    }
  }

  if (modo === 'carregando') {
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

  if (modo === 'visitante') return null

  if (modo === 'prestador_resposta' && avRecebida) {
    return (
      <RespostaPrestadorBloco
        avaliacaoId={avRecebida.id}
        respostaExistente={avRecebida.resposta_prestador}
        nota={avRecebida.nota}
        comentario={avRecebida.comentario}
        onPublicado={r => setAvRecebida(prev => (prev ? { ...prev, resposta_prestador: r } : prev))}
      />
    )
  }

  if (modo === 'cliente_ok') {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 text-center">
        <p className="text-sm font-bold text-emerald-900">{ok ? 'Obrigado pela avaliação!' : 'Avaliação já registrada'}</p>
        <p className="text-xs text-emerald-800 mt-1">
          Critérios: qualidade, prazo e comunicação. Sem reedição após 7 dias (RF46.3).
        </p>
      </section>
    )
  }

  if (modo !== 'cliente_form') return null

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-3 text-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">RF46 · Após liberação da última etapa</p>
        <h2 className="text-base font-bold">Avaliar {nomePrestador || 'o prestador'}</h2>
      </div>
      <form onSubmit={enviar} className="p-4 sm:p-5 space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          Notas de 1 a 5 em três critérios. A média influencia prioridade em buscas (RF46.4).
        </p>
        {(['qualidade', 'prazo', 'comunicacao'] as const).map(campo => {
          const val = campo === 'qualidade' ? nq : campo === 'prazo' ? np : nc
          const set = campo === 'qualidade' ? setNq : campo === 'prazo' ? setNp : setNc
          const label = campo === 'qualidade' ? 'Qualidade do serviço' : campo === 'prazo' ? 'Prazo' : 'Comunicação'
          return (
            <div key={campo}>
              <p className="text-[11px] font-semibold text-gray-700 mb-1">{label}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set(n)}
                    className={`flex-1 h-10 rounded-lg text-sm font-bold border-2 ${
                      val >= n ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-gray-200 bg-white text-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Comentário público (opcional)</span>
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

function mapErro(c?: string) {
  switch (c) {
    case 'etapa_final_nao_liberada':
      return 'Só é possível avaliar após o Pix da última etapa estar liberado ao prestador.'
    case 'ja_avaliado':
      return 'Você já avaliou este atendimento.'
    case 'notas_invalidas':
      return 'Verifique as notas (1 a 5).'
    default:
      return c ? `Erro: ${c}` : 'Não foi possível concluir.'
  }
}

function RespostaPrestadorBloco({
  avaliacaoId,
  respostaExistente,
  nota,
  comentario,
  onPublicado,
}: {
  avaliacaoId: string
  respostaExistente: string | null
  nota: number
  comentario: string | null
  onPublicado: (r: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resposta, setResposta] = useState(respostaExistente)
  const [erro, setErro] = useState<string | null>(null)
  const maxResp = 350

  async function enviar() {
    if (texto.trim().length > maxResp) {
      setErro(`Máximo de ${maxResp} caracteres.`)
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const r = await avaliacoesService.responderComoPrestador(avaliacaoId, texto)
      if (!r.ok) {
        setErro(r.erro || 'Falha')
        return
      }
      setResposta(texto)
      onPublicado(texto)
      setTexto('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível publicar a réplica.')
    } finally {
      setEnviando(false)
    }
  }

  if (resposta) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-xs font-bold text-slate-600 uppercase">Sua réplica pública (RF46.5)</p>
        <p className="text-sm text-slate-800">{resposta}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Avaliação recebida ({nota}★)</p>
      {comentario && <p className="text-xs text-gray-600 italic">«{comentario}»</p>}
      <p className="text-[11px] text-slate-600">Uma única réplica pública (até {maxResp} caracteres).</p>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={3}
        maxLength={maxResp}
        className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2"
        placeholder="Resposta cordial e objetiva…"
      />
      <p className="text-[10px] text-right text-slate-500">
        {texto.length}/{maxResp}
      </p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <button
        type="button"
        disabled={enviando || !texto.trim()}
        onClick={enviar}
        className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {enviando ? 'Publicando…' : 'Publicar réplica'}
      </button>
    </section>
  )
}
