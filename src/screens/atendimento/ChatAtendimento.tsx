'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mensagem = {
  id: string
  solicitacao_id: string
  remetente_id: string
  conteudo: string
  created_at: string
}

type Props = {
  solicitacaoId: string
  meuId: string
  podeEnviar?: boolean
  corOutro?: string
  corMinha?: string
}

export default function ChatAtendimento({
  solicitacaoId,
  meuId,
  podeEnviar = true,
  corOutro = 'bg-gray-100 text-gray-800',
  corMinha = 'bg-emerald-600 text-white',
}: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let canal: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('mensagens_atendimento')
        .select('*')
        .eq('solicitacao_id', solicitacaoId)
        .order('created_at', { ascending: true })

      if (error) {
        setErro(`Não foi possível carregar mensagens: ${error.message}`)
      } else {
        setMensagens((data as Mensagem[]) || [])
      }
      setCarregando(false)

      canal = supabase
        .channel(`mensagens:${solicitacaoId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensagens_atendimento',
            filter: `solicitacao_id=eq.${solicitacaoId}`,
          },
          (payload) => {
            const nova = payload.new as Mensagem
            setMensagens((atual) => (atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]))
          },
        )
        .subscribe()
    }

    carregar()

    return () => {
      if (canal) {
        const supabase = createClient()
        supabase.removeChannel(canal)
      }
    }
  }, [solicitacaoId])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo || enviando) return

    setEnviando(true)
    setErro(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mensagens_atendimento')
      .insert({ solicitacao_id: solicitacaoId, remetente_id: meuId, conteudo })
      .select()
      .single()

    setEnviando(false)

    if (error) {
      setErro(`Falha ao enviar: ${error.message}`)
      return
    }
    setTexto('')
    if (data) {
      setMensagens((atual) => (atual.some((m) => m.id === (data as Mensagem).id) ? atual : [...atual, data as Mensagem]))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {carregando && (
          <p className="text-center text-xs text-gray-400 py-6">Carregando conversa...</p>
        )}
        {!carregando && mensagens.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-6">
            Nenhuma mensagem ainda. Mande a primeira pra alinhar os detalhes.
          </p>
        )}
        {mensagens.map((m) => {
          const minha = m.remetente_id === meuId
          return (
            <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  minha ? corMinha : corOutro
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                <p className={`text-[10px] mt-1 ${minha ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={fimRef} />
      </div>

      {erro && (
        <p className="text-xs text-red-700 bg-red-50 border-t border-red-100 px-3 py-2">{erro}</p>
      )}

      {podeEnviar ? (
        <form onSubmit={enviar} className="border-t border-gray-100 bg-white p-2 flex gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(e as unknown as FormEvent)
              }
            }}
            placeholder="Escreva uma mensagem..."
            rows={1}
            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-h-32"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="shrink-0 bg-emerald-600 text-white font-semibold px-4 rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {enviando ? '...' : 'Enviar'}
          </button>
        </form>
      ) : (
        <p className="border-t border-gray-100 bg-gray-50 px-3 py-3 text-center text-xs text-gray-500">
          Esta conversa está fechada. Mensagens não podem mais ser enviadas.
        </p>
      )}
    </div>
  )
}
