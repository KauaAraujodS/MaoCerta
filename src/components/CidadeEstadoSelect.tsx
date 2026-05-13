'use client'

import { useEffect, useState } from 'react'

type Estado = { id: number; sigla: string; nome: string }
type Municipio = { id: number; nome: string }

type Props = {
  estado: string | null
  cidade: string | null
  onChange: (valor: { estado: string | null; cidade: string | null }) => void
  disabled?: boolean
  classeBaseInput?: string
  rotuloEstado?: string
  rotuloCidade?: string
}

// Cache em memória durante a sessão
let cacheEstados: Estado[] | null = null
const cacheMunicipios = new Map<string, Municipio[]>()

async function carregarEstados(): Promise<Estado[]> {
  if (cacheEstados) return cacheEstados
  const r = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
  if (!r.ok) throw new Error('Falha ao carregar estados')
  const data = (await r.json()) as Estado[]
  cacheEstados = data
  return data
}

async function carregarMunicipios(uf: string): Promise<Municipio[]> {
  const c = cacheMunicipios.get(uf)
  if (c) return c
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
  if (!r.ok) throw new Error('Falha ao carregar municípios')
  const data = (await r.json()) as Municipio[]
  cacheMunicipios.set(uf, data)
  return data
}

const CLASSE_PADRAO = 'mt-1 w-full bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white'

export default function CidadeEstadoSelect({
  estado,
  cidade,
  onChange,
  disabled,
  classeBaseInput = CLASSE_PADRAO,
  rotuloEstado = 'Estado',
  rotuloCidade = 'Cidade',
}: Props) {
  const [estados, setEstados] = useState<Estado[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [carregandoMun, setCarregandoMun] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregarEstados()
      .then(setEstados)
      .catch(() => setErro('Não foi possível carregar a lista de estados.'))
  }, [])

  useEffect(() => {
    if (!estado) {
      setMunicipios([])
      return
    }
    setCarregandoMun(true)
    carregarMunicipios(estado)
      .then((lista) => {
        setMunicipios(lista)
        setCarregandoMun(false)
      })
      .catch(() => {
        setErro('Não foi possível carregar as cidades.')
        setCarregandoMun(false)
      })
  }, [estado])

  function trocarEstado(uf: string) {
    onChange({ estado: uf || null, cidade: null })
  }

  function trocarCidade(nome: string) {
    onChange({ estado, cidade: nome || null })
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{rotuloEstado}</span>
        <select
          value={estado || ''}
          onChange={(e) => trocarEstado(e.target.value)}
          disabled={disabled}
          className={classeBaseInput}
        >
          <option value="">UF</option>
          {estados.map((e) => (
            <option key={e.id} value={e.sigla}>
              {e.sigla}
            </option>
          ))}
        </select>
      </label>

      <label className="block col-span-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{rotuloCidade}</span>
        <select
          value={cidade || ''}
          onChange={(e) => trocarCidade(e.target.value)}
          disabled={disabled || !estado || carregandoMun}
          className={classeBaseInput}
        >
          <option value="">{!estado ? 'Selecione um estado primeiro' : carregandoMun ? 'Carregando...' : 'Selecione uma cidade'}</option>
          {municipios.map((m) => (
            <option key={m.id} value={m.nome}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      {erro && <p className="col-span-3 text-xs text-red-600">{erro}</p>}
    </div>
  )
}
