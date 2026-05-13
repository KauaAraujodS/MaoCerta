'use client'

import { useEffect, useRef, useState } from 'react'

type Plano = 'basico' | 'premium'
type Tema = 'cliente' | 'profissional'

type Props = {
  aberto: boolean
  plano: Plano
  nomePlano: string
  tema: Tema
  onFechar: () => void
  onPago?: () => void
}

type RespostaCriar = {
  ok: boolean
  pagamento_id?: string
  qr_code_base64?: string
  pix_copia_e_cola?: string
  ticket_url?: string
  expira_em?: string
  valor?: number
  erro?: string
  detalhe?: string
}

type RespostaStatus = {
  ok: boolean
  status?: 'aguardando_pix' | 'pago' | 'expirado' | 'cancelado'
  plano_alvo?: string
  plano_atual?: string
}

function formatarReais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PagarPlanoModal({ aberto, plano, nomePlano, tema, onFechar, onPago }: Props) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<RespostaCriar | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const corBotao = tema === 'cliente' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-emerald-700 hover:bg-emerald-800'
  const corDestaque = tema === 'cliente' ? 'text-purple-700' : 'text-emerald-700'

  useEffect(() => {
    if (!aberto) return
    let cancelado = false

    async function criar() {
      setCarregando(true)
      setErro(null)
      setDados(null)
      setConfirmado(false)

      const r = await fetch('/api/pix/plano/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      })
      const d = (await r.json().catch(() => ({}))) as RespostaCriar
      if (cancelado) return

      if (!d.ok) {
        const mapaErro: Record<string, string> = {
          plano_atual_igual: 'Você já está nesse plano.',
          mp_nao_configurado: 'Pagamento ainda não está configurado. Avise o administrador.',
          service_role_nao_configurado: 'Servidor não configurado para confirmar pagamento.',
          mp_falhou: 'O Mercado Pago recusou a criação do pagamento.',
          mp_inacessivel: 'Não foi possível falar com o Mercado Pago. Tente novamente.',
          preco_indisponivel: 'Preço não disponível para esse plano.',
          nao_autenticado: 'Faça login para continuar.',
        }
        setErro(mapaErro[d.erro || ''] || d.erro || 'Erro desconhecido ao gerar Pix.')
      } else {
        setDados(d)
      }
      setCarregando(false)
    }

    criar()
    return () => {
      cancelado = true
    }
  }, [aberto, plano])

  // Polling do status a cada 4s
  useEffect(() => {
    if (!aberto || !dados?.pagamento_id || confirmado) return

    async function verificar() {
      try {
        const r = await fetch(`/api/pix/plano/status?id=${dados!.pagamento_id}`)
        const d = (await r.json().catch(() => ({}))) as RespostaStatus
        if (d.ok && d.status === 'pago') {
          setConfirmado(true)
          if (pollingRef.current) clearInterval(pollingRef.current)
          onPago?.()
        }
      } catch {
        // silencioso — tenta de novo no proximo tick
      }
    }

    verificar()
    pollingRef.current = setInterval(verificar, 4000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [aberto, dados, confirmado, onPago])

  useEffect(() => {
    if (!aberto) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  async function copiarPix() {
    if (!dados?.pix_copia_e_cola) return
    try {
      await navigator.clipboard.writeText(dados.pix_copia_e_cola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // ignora
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between rounded-t-3xl">
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Pagar plano</p>
            <p className={`text-sm font-bold ${corDestaque}`}>{nomePlano}</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-slate-400"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {carregando && (
            <div className="py-12 flex flex-col items-center gap-3">
              <span className="inline-block w-8 h-8 border-3 border-gray-300 dark:border-slate-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 dark:text-slate-400">Gerando Pix com o Mercado Pago...</p>
            </div>
          )}

          {erro && (
            <div className="space-y-3">
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl p-3">{erro}</p>
              <button
                type="button"
                onClick={onFechar}
                className="w-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold py-3 rounded-2xl text-sm hover:bg-gray-300 dark:hover:bg-slate-600"
              >
                Fechar
              </button>
            </div>
          )}

          {!carregando && !erro && confirmado && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">
                ✓
              </div>
              <p className="text-lg font-bold text-emerald-700">Pagamento confirmado!</p>
              <p className="text-sm text-gray-600 dark:text-slate-400">Seu plano foi atualizado pra <strong>{nomePlano}</strong>.</p>
              <button
                type="button"
                onClick={onFechar}
                className={`mt-3 w-full text-white font-semibold py-3 rounded-2xl text-sm ${corBotao}`}
              >
                Continuar
              </button>
            </div>
          )}

          {!carregando && !erro && !confirmado && dados && (
            <>
              {dados.valor != null && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">Total a pagar</p>
                  <p className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">{formatarReais(dados.valor)}</p>
                </div>
              )}

              {dados.qr_code_base64 && (
                <div className="flex justify-center">
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${dados.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="w-56 h-56"
                    />
                  </div>
                </div>
              )}

              {dados.pix_copia_e_cola && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Pix copia e cola</p>
                  <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 flex items-stretch gap-2">
                    <code className="flex-1 text-[10px] break-all px-2 py-1 text-gray-800 dark:text-slate-200 font-mono leading-snug">
                      {dados.pix_copia_e_cola}
                    </code>
                    <button
                      type="button"
                      onClick={copiarPix}
                      className={`shrink-0 px-3 rounded-lg text-xs font-bold text-white ${corBotao}`}
                    >
                      {copiado ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                <p className="text-xs text-amber-900 leading-relaxed">
                  <strong>Esperando pagamento...</strong>
                  <br />
                  Abra o app do seu banco, escolha &ldquo;Pagar com Pix&rdquo;, escaneie o QR Code ou cole a chave.
                  Seu plano vai mudar automaticamente assim que o pagamento for confirmado.
                </p>
              </div>

              {dados.ticket_url && (
                <a
                  href={dados.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-300 underline"
                >
                  Abrir comprovante / página completa no Mercado Pago
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
