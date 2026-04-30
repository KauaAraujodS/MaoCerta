'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Categoria = { id: number; nome: string }
type Demanda = { id: string; titulo: string; descricao: string; status: string }

export default function ClienteDemandasScreen() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: categoriasData } = await supabase.from('categorias').select('id, nome').order('nome')
      setCategorias((categoriasData as Categoria[] | null) || [])

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return

      const { data } = await supabase
        .from('demandas')
        .select('id, titulo, descricao, status')
        .eq('cliente_id', auth.user.id)
        .order('created_at', { ascending: false })
      setDemandas((data as Demanda[] | null) || [])
    }
    carregar()
  }, [])

  async function publicarDemanda(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !descricao.trim() || !categoriaId) return
    setAviso(null)
    setSalvando(true)

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      setSalvando(false)
      return
    }

    const { data, error } = await supabase
      .from('demandas')
      .insert({
        cliente_id: user.id,
        categoria_id: categoriaId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      })
      .select('id, titulo, descricao, status')
      .single()

    setSalvando(false)
    if (error) {
      setAviso('Falha ao publicar demanda.')
      return
    }

    setDemandas((atual) => [data as Demanda, ...atual])
    setTitulo('')
    setDescricao('')
    setCategoriaId('')
  }

  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Demandas</h1>
        <p className="text-sm text-gray-500 mt-1">Publique sua necessidade e receba propostas de profissionais.</p>
      </header>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nova demanda</p>
        <form onSubmit={publicarDemanda} className="space-y-2">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Selecione a categoria</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </select>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da demanda"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o que você precisa"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
          />
          <button type="submit" disabled={salvando} className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold">
            {salvando ? 'Publicando...' : 'Publicar demanda'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Minhas demandas</p>
        {demandas.length === 0 && <p className="text-sm text-gray-500">Você ainda não publicou demandas.</p>}
        {demandas.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-900">{item.titulo}</p>
            <p className="text-sm text-gray-600 mt-1">{item.descricao}</p>
            <p className="text-xs text-gray-500 mt-2">Status: {item.status}</p>
          </div>
        ))}
      </section>

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
    </main>
  )
}