'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatarDataPt } from '@/lib/formatar-data'
import ChatAtendimento from '@/screens/atendimento/ChatAtendimento'
import PerfilModal from '@/screens/perfil/PerfilModal'

type Atendimento = {
  id: string
  titulo: string
  descricao: string
  status: string
  created_at: string
  updated_at: string
  cliente_id: string
  profissional_id: string
  demanda_origem_id: string | null
  profissional: { id: string; nome: string; telefone: string | null; avatar_url: string | null; cidade: string | null; bio: string | null } | null
}

export default function ClienteAtendimentoDetalheScreen({ id }: { id: string }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [acaoEmCurso, setAcaoEmCurso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [verPerfilPrestador, setVerPerfilPrestador] = useState(false)

  useEffect(() => {
    carregar()
  }, [id])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErro('Faça login para ver este atendimento.')
      setCarregando(false)
      return
    }
    setMeuId(user.id)

    const { data, error } = await supabase
      .from('solicitacoes')
      .select(`
        id, titulo, descricao, status, created_at, updated_at,
        cliente_id, profissional_id, demanda_origem_id,
        profissional:profissional_id ( id, nome, telefone, avatar_url, cidade, bio )
      `)
      .eq('id', id)
      .eq('cliente_id', user.id)
      .maybeSingle()

    if (error) {
      setErro(`Erro ao carregar: ${error.message}`)
    } else if (!data) {
      setErro('Atendimento não encontrado.')
    } else {
      setAtendimento(data as unknown as Atendimento)
    }
    setCarregando(false)
  }

  async function cancelar() {
    if (!atendimento) return
    setAcaoEmCurso(true)
    setErro(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('solicitacoes')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', atendimento.id)
    setAcaoEmCurso(false)
    if (error) {
      setErro(`Falha ao cancelar: ${error.message}`)
      return
    }
    router.push('/cliente/atendimentos')
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-md flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Carregando...</p>
        </div>
      </main>
    )
  }

  if (!atendimento || !meuId) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-md space-y-3">
          <p className="text-sm text-red-700">{erro || 'Atendimento não encontrado.'}</p>
          <Link href="/cliente/atendimentos" className="text-sm font-semibold text-purple-700">
            ‹ Voltar
          </Link>
        </div>
      </main>
    )
  }

  const prest = atendimento.profissional
  const ativo = atendimento.status === 'aceita' || atendimento.status === 'em_andamento'
  const statusLabel =
    atendimento.status === 'aceita'
      ? 'Aceito (aguardando início)'
      : atendimento.status === 'em_andamento'
        ? 'Em andamento'
        : atendimento.status === 'concluida'
          ? 'Concluído'
          : 'Cancelado'

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 text-white px-4 pt-6 pb-5 shadow-lg">
        <div className="max-w-lg mx-auto space-y-3">
          <Link
            href="/cliente/atendimentos"
            className="inline-flex items-center gap-1 text-white/80 text-xs font-medium hover:text-white"
          >
            ‹ Atendimentos
          </Link>
          <button
            type="button"
            onClick={() => setVerPerfilPrestador(true)}
            className="flex items-center gap-3 w-full text-left bg-white/10 hover:bg-white/15 rounded-xl p-2 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-base font-bold">
              {prest?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prest.avatar_url} alt={prest.nome} className="w-full h-full object-cover" />
              ) : (
                <span>{(prest?.nome || '?').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/65">Prestador · toque para ver perfil</p>
              <h1 className="text-lg font-bold truncate">{prest?.nome || 'Sem nome'}</h1>
              {prest?.cidade && <p className="text-[11px] text-white/80">{prest.cidade}</p>}
            </div>
            <span className="text-white/70 text-lg">›</span>
          </button>
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
            {statusLabel}
          </span>
        </div>
      </header>

      <section className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sua demanda</p>
          <h2 className="text-base font-bold text-gray-900">{atendimento.titulo}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{atendimento.descricao}</p>
          <p className="text-[11px] text-gray-400">Aceita em {formatarDataPt(atendimento.created_at)}</p>

          {ativo && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(true)}
                className="text-xs font-semibold bg-white border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50"
              >
                Cancelar atendimento
              </button>
            </div>
          )}
        </div>
      </section>

      {confirmandoCancelamento && (
        <section className="bg-amber-50 border-b border-amber-200 px-4 py-4">
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-sm text-amber-900">
              Tem certeza? {atendimento.demanda_origem_id ? 'Sua demanda volta a aparecer pra outros prestadores.' : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelar}
                disabled={acaoEmCurso}
                className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Sim, cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(false)}
                disabled={acaoEmCurso}
                className="text-xs font-semibold bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                Voltar
              </button>
            </div>
          </div>
        </section>
      )}

      {erro && (
        <p className="text-xs text-red-700 bg-red-50 border-b border-red-100 px-4 py-2 text-center">{erro}</p>
      )}

      <section className="flex-1 max-w-lg w-full mx-auto bg-white border-x border-gray-100 flex flex-col">
        <ChatAtendimento
          solicitacaoId={atendimento.id}
          meuId={meuId}
          podeEnviar={ativo}
          corMinha="bg-purple-700 text-white"
        />
      </section>

      <PerfilModal
        perfilId={atendimento.profissional_id}
        aberto={verPerfilPrestador}
        onFechar={() => setVerPerfilPrestador(false)}
        rotulo="Prestador"
      />
    </main>
  )
}
