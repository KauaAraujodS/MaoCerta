'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { iconeCategoria } from '@/lib/categorias-ui'
import PerfilModal from '@/screens/perfil/PerfilModal'

type Categoria = { id: number; nome: string }

type CategoriaVinculo = {
  categoria: { id: number; nome: string } | null
}

type Prestador = {
  id: string
  nome: string
  avatar_url: string | null
  cidade: string | null
  bio: string | null
  experiencia_anos: number | null
  created_at: string
  categorias: CategoriaVinculo[]
}

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function categoriasPlanas(p: Prestador) {
  return p.categorias.map((c) => c.categoria).filter(Boolean) as { id: number; nome: string }[]
}

export default function ClienteBuscarScreen() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriasPopulares, setCategoriasPopulares] = useState<{ id: number; nome: string; count: number }[]>([])
  const [minhaCidade, setMinhaCidade] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null)
  const [filtroCidade, setFiltroCidade] = useState('')

  // modais
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null)
  const [solicitarPara, setSolicitarPara] = useState<Prestador | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: meu } = await supabase
        .from('profiles')
        .select('cidade')
        .eq('id', user.id)
        .maybeSingle()
      setMinhaCidade(meu?.cidade || null)
    }

    const [catRes, prestRes] = await Promise.all([
      supabase.from('categorias').select('id, nome').order('nome'),
      supabase
        .from('profiles')
        .select(`
          id, nome, avatar_url, cidade, bio, experiencia_anos, created_at,
          categorias:profissional_categorias ( categoria:categoria_id ( id, nome ) )
        `)
        .eq('tipo', 'profissional')
        .order('created_at', { ascending: false })
        .limit(120),
    ])

    if (prestRes.error) {
      setErro(`Não foi possível carregar prestadores: ${prestRes.error.message}`)
    }

    const lista = ((prestRes.data as unknown as Prestador[]) || []).filter((p) => p.id !== user?.id)

    // categorias populares (por nº de prestadores vinculados)
    const counts: Record<number, { id: number; nome: string; count: number }> = {}
    for (const p of lista) {
      for (const c of categoriasPlanas(p)) {
        if (!counts[c.id]) counts[c.id] = { id: c.id, nome: c.nome, count: 0 }
        counts[c.id].count++
      }
    }
    const top = Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    setCategorias((catRes.data as Categoria[]) || [])
    setPrestadores(lista)
    setCategoriasPopulares(top)
    setCarregando(false)
  }

  const temFiltroAtivo = !!(busca.trim() || filtroCategoria || filtroCidade.trim())

  const prestadoresFiltrados = useMemo(() => {
    const q = normalizar(busca)
    const cidadeFiltro = normalizar(filtroCidade)

    return prestadores.filter((p) => {
      if (filtroCategoria && !p.categorias.some((c) => c.categoria?.id === filtroCategoria)) return false
      if (cidadeFiltro && !normalizar(p.cidade || '').includes(cidadeFiltro)) return false
      if (q) {
        const blob = normalizar(
          [
            p.nome,
            p.bio || '',
            p.cidade || '',
            ...categoriasPlanas(p).map((c) => c.nome),
          ].join(' '),
        )
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [prestadores, busca, filtroCategoria, filtroCidade])

  const sugestoes = useMemo(() => prestadores.slice(0, 6), [prestadores])

  const pertoDeMim = useMemo(() => {
    if (!minhaCidade) return []
    const c = normalizar(minhaCidade)
    return prestadores.filter((p) => normalizar(p.cidade || '').includes(c)).slice(0, 6)
  }, [prestadores, minhaCidade])

  function limparFiltros() {
    setBusca('')
    setFiltroCategoria(null)
    setFiltroCidade('')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white pb-10">
      <header className="bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-600 text-white px-4 pt-8 pb-10 rounded-b-[2rem] shadow-lg">
        <div className="max-w-lg mx-auto space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">Encontre o profissional certo</p>
          <h1 className="text-2xl font-bold">Buscar prestadores</h1>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55 text-sm">🔎</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, categoria, descrição..."
              className="w-full rounded-xl bg-white/15 border border-white/25 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filtroCategoria ?? ''}
              onChange={(e) => setFiltroCategoria(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl bg-white/15 border border-white/25 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="" className="text-gray-900">
                Todas as categorias
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id} className="text-gray-900">
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              placeholder="Cidade ou bairro"
              className="rounded-xl bg-white/15 border border-white/25 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          {temFiltroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="text-xs font-semibold text-white/85 hover:text-white underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-5 relative z-10">
        {erro && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{erro}</p>
        )}

        {carregando && (
          <div className="bg-white rounded-2xl p-6 shadow border border-gray-100 flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Carregando prestadores...</p>
          </div>
        )}

        {/* === SEM FILTRO: seções de descoberta === */}
        {!carregando && !temFiltroAtivo && (
          <>
            {categoriasPopulares.length > 0 && (
              <Secao titulo="Categorias populares">
                <div className="flex flex-wrap gap-2">
                  {categoriasPopulares.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFiltroCategoria(c.id)}
                      className="bg-white border border-purple-100 rounded-full px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{iconeCategoria(c.nome)}</span>
                      <span>{c.nome}</span>
                      <span className="text-[10px] text-purple-400 font-normal">({c.count})</span>
                    </button>
                  ))}
                </div>
              </Secao>
            )}

            {pertoDeMim.length > 0 && (
              <Secao titulo={`Perto de você · ${minhaCidade}`}>
                <ListaPrestadores
                  prestadores={pertoDeMim}
                  onVerPerfil={setPerfilAberto}
                  onSolicitar={setSolicitarPara}
                />
              </Secao>
            )}

            <Secao titulo="Ativos recentemente">
              <ListaPrestadores
                prestadores={sugestoes}
                onVerPerfil={setPerfilAberto}
                onSolicitar={setSolicitarPara}
              />
            </Secao>
          </>
        )}

        {/* === COM FILTRO: lista filtrada === */}
        {!carregando && temFiltroAtivo && (
          <>
            <p className="text-xs font-semibold text-gray-500 px-1">
              {prestadoresFiltrados.length} resultado(s)
            </p>

            {prestadoresFiltrados.length > 0 ? (
              <ListaPrestadores
                prestadores={prestadoresFiltrados}
                onVerPerfil={setPerfilAberto}
                onSolicitar={setSolicitarPara}
              />
            ) : (
              <>
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center space-y-2">
                  <p className="text-4xl">🤷</p>
                  <p className="text-sm font-semibold text-gray-800">Nenhum prestador encontrado</p>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
                    Tente trocar a categoria, mudar a cidade ou usar termos mais gerais.
                  </p>
                </section>
                {sugestoes.length > 0 && (
                  <Secao titulo="Talvez você se interesse">
                    <ListaPrestadores
                      prestadores={sugestoes}
                      onVerPerfil={setPerfilAberto}
                      onSolicitar={setSolicitarPara}
                    />
                  </Secao>
                )}
              </>
            )}
          </>
        )}
      </div>

      <PerfilModal
        perfilId={perfilAberto || ''}
        aberto={!!perfilAberto}
        onFechar={() => setPerfilAberto(null)}
        rotulo="Prestador"
      />

      {solicitarPara && (
        <SolicitarServicoModal
          prestador={solicitarPara}
          onFechar={() => setSolicitarPara(null)}
        />
      )}
    </main>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{titulo}</h2>
      {children}
    </section>
  )
}

function ListaPrestadores({
  prestadores,
  onVerPerfil,
  onSolicitar,
}: {
  prestadores: Prestador[]
  onVerPerfil: (id: string) => void
  onSolicitar: (p: Prestador) => void
}) {
  return (
    <ul className="space-y-2">
      {prestadores.map((p) => (
        <CardPrestador
          key={p.id}
          prestador={p}
          onVerPerfil={() => onVerPerfil(p.id)}
          onSolicitar={() => onSolicitar(p)}
        />
      ))}
    </ul>
  )
}

function CardPrestador({
  prestador,
  onVerPerfil,
  onSolicitar,
}: {
  prestador: Prestador
  onVerPerfil: () => void
  onSolicitar: () => void
}) {
  const cats = categoriasPlanas(prestador)
  const principal = cats[0]

  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 flex gap-3">
        <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-purple-200 to-indigo-200 flex items-center justify-center text-base font-bold text-purple-900 overflow-hidden">
          {prestador.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prestador.avatar_url} alt={prestador.nome} className="w-full h-full object-cover" />
          ) : (
            <span>{(prestador.nome || '?').slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-bold text-gray-900 truncate">{prestador.nome}</p>
          {principal && (
            <p className="text-[11px] text-purple-700 font-semibold truncate">
              {iconeCategoria(principal.nome)} {principal.nome}
              {cats.length > 1 && (
                <span className="text-gray-400 font-normal"> +{cats.length - 1}</span>
              )}
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            {prestador.cidade && <span>📍 {prestador.cidade}</span>}
            <span className="text-amber-500">★ <span className="text-gray-400">novo</span></span>
            {prestador.experiencia_anos != null && (
              <span>· {prestador.experiencia_anos}a exp.</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex border-t border-gray-100">
        <button
          type="button"
          onClick={onVerPerfil}
          className="flex-1 text-xs font-semibold py-2.5 text-gray-700 hover:bg-gray-50"
        >
          Ver perfil
        </button>
        <span className="w-px bg-gray-100" />
        <button
          type="button"
          onClick={onSolicitar}
          className="flex-1 text-xs font-bold py-2.5 text-purple-700 hover:bg-purple-50"
        >
          Solicitar serviço
        </button>
      </div>
    </li>
  )
}

function SolicitarServicoModal({
  prestador,
  onFechar,
}: {
  prestador: Prestador
  onFechar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !descricao.trim() || enviando) return
    setEnviando(true)
    setAviso(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login pra enviar a solicitação.' })
      setEnviando(false)
      return
    }
    const { error } = await supabase.from('solicitacoes').insert({
      cliente_id: user.id,
      profissional_id: prestador.id,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
    })
    setEnviando(false)
    if (error) {
      setAviso({ tipo: 'erro', texto: `Falha: ${error.message}` })
      return
    }
    setAviso({ tipo: 'ok', texto: 'Solicitação enviada. O prestador vai responder em Pedidos.' })
    setTitulo('')
    setDescricao('')
    setTimeout(onFechar, 1500)
  }

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
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Solicitar serviço</p>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={enviar} className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-base font-bold text-purple-900 overflow-hidden">
              {prestador.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prestador.avatar_url} alt={prestador.nome} className="w-full h-full object-cover" />
              ) : (
                <span>{prestador.nome.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Para</p>
              <p className="text-sm font-bold text-gray-900">{prestador.nome}</p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Trocar resistência do chuveiro"
              required
              maxLength={120}
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o problema, materiais, preferência de horário..."
              required
              rows={4}
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </label>

          {aviso && (
            <p
              className={`text-xs rounded-xl p-3 font-medium ${
                aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {aviso.texto}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-purple-700 text-white font-semibold py-3 rounded-xl text-sm hover:bg-purple-800 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </form>
      </div>
    </div>
  )
}
