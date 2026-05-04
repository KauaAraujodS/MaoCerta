'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Perfil = {
  id: string
  nome: string
  tipo: string
  telefone: string | null
  cidade: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
  experiencia_anos: number | null
  historico_profissional: string | null
}

type Props = {
  perfilId: string
  aberto: boolean
  onFechar: () => void
  rotulo?: 'Cliente' | 'Prestador' | 'Perfil'
}

function pegarIniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function PerfilModal({ perfilId, aberto, onFechar, rotulo = 'Perfil' }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return

    let cancelado = false
    setCarregando(true)
    setErro(null)
    setPerfil(null)

    async function carregar() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, tipo, telefone, cidade, bio, avatar_url, created_at, experiencia_anos, historico_profissional')
        .eq('id', perfilId)
        .maybeSingle()

      if (cancelado) return

      if (error) {
        setErro(`Não foi possível carregar o perfil: ${error.message}`)
      } else if (!data) {
        setErro('Perfil não encontrado.')
      } else {
        setPerfil(data as Perfil)
      }
      setCarregando(false)
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [perfilId, aberto])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    if (aberto) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  const ehProfissional = perfil?.tipo === 'profissional'

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{rotulo}</p>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {carregando && (
          <div className="p-8 flex items-center justify-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Carregando perfil...</p>
          </div>
        )}

        {erro && (
          <p className="m-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{erro}</p>
        )}

        {perfil && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-200 flex items-center justify-center text-2xl font-bold text-emerald-900 overflow-hidden shadow-md">
                {perfil.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfil.avatar_url} alt={perfil.nome} className="w-full h-full object-cover" />
                ) : (
                  <span>{pegarIniciais(perfil.nome) || '👤'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{perfil.nome}</h2>
                <p className="text-xs text-gray-500 capitalize">{perfil.tipo}</p>
                {perfil.cidade && <p className="text-xs text-gray-600 mt-1">📍 {perfil.cidade}</p>}
              </div>
            </div>

            {perfil.bio && (
              <section className="space-y-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sobre</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{perfil.bio}</p>
              </section>
            )}

            {ehProfissional && (perfil.experiencia_anos != null || perfil.historico_profissional) && (
              <section className="space-y-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Experiência profissional
                </p>
                {perfil.experiencia_anos != null && (
                  <p className="text-sm text-gray-800">
                    <strong>{perfil.experiencia_anos}</strong> ano(s) de atuação
                  </p>
                )}
                {perfil.historico_profissional && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {perfil.historico_profissional}
                  </p>
                )}
              </section>
            )}

            <section className="space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contato</p>
              {perfil.telefone ? (
                <a
                  href={`tel:${perfil.telefone}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                >
                  <span>📞</span>
                  <span className="font-medium">{perfil.telefone}</span>
                </a>
              ) : (
                <p className="text-xs text-gray-400">Telefone não informado</p>
              )}
            </section>

            <p className="text-[11px] text-gray-400 text-center pt-2">
              Membro desde {new Date(perfil.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
