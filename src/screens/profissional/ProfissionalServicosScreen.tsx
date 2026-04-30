'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nomePlano, obterLimitesPlano } from '@/lib/plano-limites'

type Categoria = { id: number; nome: string }
type Servico = { id: string; descricao: string; categoria_id: number; valor_hora: number | null }

export default function ProfissionalServicosScreen() {
  const [plano, setPlano] = useState('free')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<number[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [descricao, setDescricao] = useState('')
  const [valorHora, setValorHora] = useState('')
  const limites = useMemo(() => obterLimitesPlano(plano), [plano])

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user

      const { data: categoriasData } = await supabase.from('categorias').select('id, nome').order('nome')
      setCategorias((categoriasData as Categoria[] | null) || [])

      if (!user) {
        setCarregando(false)
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('plano').eq('id', user.id).maybeSingle()
      setPlano(perfil?.plano || 'free')

      const { data: categoriasProf } = await supabase
        .from('profissional_categorias')
        .select('categoria_id')
        .eq('profissional_id', user.id)
      setCategoriasSelecionadas((categoriasProf || []).map((c: { categoria_id: number }) => c.categoria_id))

      const { data: servicosData } = await supabase
        .from('servicos')
        .select('id, descricao, categoria_id, valor_hora')
        .eq('profissional_id', user.id)
        .order('created_at', { ascending: false })
      setServicos((servicosData as Servico[] | null) || [])
      setCarregando(false)
    }

    carregar()
  }, [])

  async function alternarCategoria(catId: number) {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    const jaTem = categoriasSelecionadas.includes(catId)
    if (!jaTem && categoriasSelecionadas.length >= limites.maxCategorias) {
      setAviso(`Seu plano ${nomePlano(plano)} permite até ${limites.maxCategorias} categorias.`)
      return
    }

    setAviso(null)
    if (jaTem) {
      await supabase
        .from('profissional_categorias')
        .delete()
        .eq('profissional_id', user.id)
        .eq('categoria_id', catId)
      setCategoriasSelecionadas((atual) => atual.filter((id) => id !== catId))
      return
    }

    const { error } = await supabase.from('profissional_categorias').insert({ profissional_id: user.id, categoria_id: catId })
    if (error) {
      setAviso('Não foi possível salvar a categoria. Verifique se a migration foi aplicada.')
      return
    }
    setCategoriasSelecionadas((atual) => [...atual, catId])
  }

  async function criarServico(e: FormEvent) {
    e.preventDefault()
    setAviso(null)
    if (!categoriaId || !descricao.trim()) return
    if (servicos.length >= limites.maxServicos) {
      setAviso(`Seu plano ${nomePlano(plano)} permite até ${limites.maxServicos} serviços.`)
      return
    }

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    setSalvando(true)
    const valor = valorHora.trim() ? Number(valorHora.replace(',', '.')) : null
    const { data, error } = await supabase
      .from('servicos')
      .insert({
        profissional_id: user.id,
        categoria_id: categoriaId,
        descricao: descricao.trim(),
        valor_hora: Number.isFinite(valor as number) ? valor : null,
      })
      .select('id, descricao, categoria_id, valor_hora')
      .single()

    setSalvando(false)

    if (error) {
      setAviso('Não foi possível criar o serviço.')
      return
    }

    setServicos((atual) => [data as Servico, ...atual])
    setDescricao('')
    setValorHora('')
    setCategoriaId('')
  }

  async function removerServico(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('servicos').delete().eq('id', id)
    if (error) {
      setAviso('Não foi possível remover este serviço.')
      return
    }
    setServicos((atual) => atual.filter((item) => item.id !== id))
  }

  function nomeCategoria(id: number) {
    return categorias.find((c) => c.id === id)?.nome || 'Categoria'
  }

  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Categorias e serviços</h1>
        <p className="text-sm text-gray-500 mt-1">Plano atual: {nomePlano(plano)}.</p>
      </header>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categorias de atuação</p>
        <p className="text-xs text-gray-500">
          Selecionadas: {categoriasSelecionadas.length}/{limites.maxCategorias}
        </p>
        <div className="flex flex-wrap gap-2">
          {categorias.map((cat) => {
            const ativo = categoriasSelecionadas.includes(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => alternarCategoria(cat.id)}
                className={`text-xs font-semibold px-3 py-2 rounded-full border ${
                  ativo ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {cat.nome}
              </button>
            )
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Novo serviço</p>
        <form onSubmit={criarServico} className="space-y-3">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Selecione uma categoria</option>
            {categoriasSelecionadas.map((id) => (
              <option key={id} value={id}>
                {nomeCategoria(id)}
              </option>
            ))}
          </select>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Instalação e manutenção elétrica residencial"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
          <input
            value={valorHora}
            onChange={(e) => setValorHora(e.target.value)}
            placeholder="Valor por hora (opcional)"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={salvando || carregando}
            className="w-full bg-emerald-700 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Cadastrar serviço'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Serviços cadastrados ({servicos.length}/{limites.maxServicos})
        </p>
        {servicos.length === 0 && <p className="text-sm text-gray-500">Nenhum serviço cadastrado ainda.</p>}
        {servicos.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-emerald-700 font-semibold">{nomeCategoria(item.categoria_id)}</p>
            <p className="text-sm font-medium text-gray-900">{item.descricao}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {item.valor_hora ? `R$ ${Number(item.valor_hora).toFixed(2)}/h` : 'Valor a combinar'}
              </p>
              <button type="button" onClick={() => removerServico(item.id)} className="text-xs text-red-600 font-semibold">
                Remover
              </button>
            </div>
          </div>
        ))}
      </section>

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
    </main>
  )
}
