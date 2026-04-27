'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'
import {
  CATEGORIAS_PADRAO,
  DEMO_CATEGORIAS_ATUACAO,
  DEMO_SERVICOS,
  formatarMoeda,
  normalizarPlano,
  PLANOS_PROFISSIONAL,
  textoLimite,
  type CategoriaAtuacao,
  type CategoriaOption,
  type PlanoId,
  type ServicoProfissional,
} from '@/lib/profissional'

type Form = {
  nome: string
  telefone: string
  cidade: string
  descricaoProfissional: string
  experienciaAnos: string
  historicoProfissional: string
}

type NovoServicoForm = {
  titulo: string
  categoriaId: string
  descricao: string
  valorHora: string
}

const FORM_VAZIO: Form = {
  nome: '',
  telefone: '',
  cidade: '',
  descricaoProfissional: '',
  experienciaAnos: '',
  historicoProfissional: '',
}

const NOVO_SERVICO_VAZIO: NovoServicoForm = {
  titulo: '',
  categoriaId: '',
  descricao: '',
  valorHora: '',
}

const TAMANHO_MAX_MB = 2

function pegarIniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

export default function ContaProfissionalScreen() {
  const [form, setForm] = useState<Form>({
    nome: 'Prestador Demo',
    telefone: '(27) 99999-8888',
    cidade: 'Vitória - ES',
    descricaoProfissional: 'Faço instalações e reparos residenciais com atendimento rápido e acabamento caprichado.',
    experienciaAnos: '7',
    historicoProfissional: 'Atuei em manutenção predial, reformas leves e montagem de ambientes planejados.',
  })
  const [email, setEmail] = useState('demo@maocerta.com')
  const [plano, setPlano] = useState<PlanoId>('basico')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [categoriasOpcoes, setCategoriasOpcoes] = useState<CategoriaOption[]>(CATEGORIAS_PADRAO)
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<CategoriaAtuacao[]>(DEMO_CATEGORIAS_ATUACAO)
  const [servicos, setServicos] = useState<ServicoProfissional[]>(DEMO_SERVICOS)
  const [novoServico, setNovoServico] = useState<NovoServicoForm>(NOVO_SERVICO_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvandoServico, setSalvandoServico] = useState(false)
  const [modoDemo, setModoDemo] = useState(true)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const planoAtual = useMemo(() => PLANOS_PROFISSIONAL[plano], [plano])

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setModoDemo(true)
        setCarregando(false)
        return
      }

      setModoDemo(false)
      setEmail(user.email || '')

      const [profileRes, categoriasRes, categoriasSelecionadasRes, servicosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        supabase.from('categorias').select('id, nome').order('nome'),
        supabase
          .from('profissional_categorias')
          .select('id, categoria_id, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('servicos')
          .select('id, titulo, descricao, categoria_id, valor_hora, created_at')
          .eq('profissional_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (profileRes.error || categoriasRes.error || categoriasSelecionadasRes.error || servicosRes.error) {
        setAviso({
          tipo: 'erro',
          texto: 'Parte dos recursos depende da migration 007 aplicada no Supabase. O restante do perfil continua editável.',
        })
      }

      const planoUsuario = normalizarPlano(profileRes.data?.plano)
      setPlano(planoUsuario)
      setAvatarUrl(profileRes.data?.avatar_url || null)
      setForm({
        nome: profileRes.data?.nome || user.email?.split('@')[0] || 'Prestador',
        telefone: profileRes.data?.telefone || '',
        cidade: profileRes.data?.cidade || '',
        descricaoProfissional: profileRes.data?.bio || '',
        experienciaAnos:
          typeof profileRes.data?.experiencia_anos === 'number'
            ? String(profileRes.data.experiencia_anos)
            : '',
        historicoProfissional: profileRes.data?.historico_profissional || '',
      })

      const opcoes = (categoriasRes.data as CategoriaOption[] | null) || CATEGORIAS_PADRAO
      setCategoriasOpcoes(opcoes)

      const mapaCategorias = new Map<number, string>()
      opcoes.forEach((item) => mapaCategorias.set(item.id, item.nome))

      setCategoriasSelecionadas(
        (categoriasSelecionadasRes.data || []).map((item) => ({
          id: item.id,
          categoriaId: item.categoria_id,
          nome: mapaCategorias.get(item.categoria_id) || 'Categoria',
          createdAt: item.created_at,
        }))
      )

      setServicos(
        (servicosRes.data || []).map((item) => ({
          id: item.id,
          titulo: item.titulo || item.descricao || 'Serviço',
          descricao: item.descricao || '',
          categoriaId: item.categoria_id,
          categoriaNome: mapaCategorias.get(item.categoria_id) || 'Categoria',
          valorHora: typeof item.valor_hora === 'number' ? item.valor_hora : null,
          createdAt: item.created_at,
        }))
      )

      setCarregando(false)
    }

    carregar()
  }, [])

  async function trocarFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return

    e.target.value = ''
    setAviso(null)

    if (!arquivo.type.startsWith('image/')) {
      setAviso({ tipo: 'erro', texto: 'Selecione um arquivo de imagem.' })
      return
    }

    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setAviso({ tipo: 'erro', texto: `A imagem precisa ter no máximo ${TAMANHO_MAX_MB} MB.` })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para alterar a foto no Supabase.' })
      return
    }

    setEnviandoFoto(true)
    const extensao = arquivo.name.split('.').pop() || 'jpg'
    const caminho = `${user.id}/avatar-${Date.now()}.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from('avatars')
      .upload(caminho, arquivo, { upsert: true, cacheControl: '3600', contentType: arquivo.type })

    if (erroUpload) {
      setEnviandoFoto(false)
      setAviso({ tipo: 'erro', texto: `Upload da foto: ${erroUpload.message}` })
      return
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(caminho)
    const url = publicUrl.publicUrl

    const tipoUsuario = (user.user_metadata as { tipo?: 'cliente' | 'profissional' | 'administrador' })?.tipo || 'profissional'

    const { error: erroBanco } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nome: form.nome || user.email?.split('@')[0] || 'Prestador',
        telefone: form.telefone,
        tipo: tipoUsuario,
        avatar_url: url,
      })

    setEnviandoFoto(false)

    if (erroBanco) {
      setAviso({ tipo: 'erro', texto: `Salvar foto: ${erroBanco.message}` })
      return
    }

    setAvatarUrl(url)
    setAviso({ tipo: 'ok', texto: 'Foto de perfil atualizada.' })
  }

  async function removerFoto() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para remover a foto do Supabase.' })
      return
    }

    setEnviandoFoto(true)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    setEnviandoFoto(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Remover foto: ${error.message}` })
      return
    }

    setAvatarUrl(null)
    setAviso({ tipo: 'ok', texto: 'Foto removida.' })
  }

  async function salvarPerfil(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setSalvando(false)
      setAviso({ tipo: 'erro', texto: 'No modo demonstração, o preenchimento é apenas visual. Faça login para persistir.' })
      return
    }

    const tipoUsuario = (user.user_metadata as { tipo?: 'cliente' | 'profissional' | 'administrador' })?.tipo || 'profissional'
    const experiencia = form.experienciaAnos.trim() ? Number(form.experienciaAnos) : null

    if (experiencia !== null && (!Number.isFinite(experiencia) || experiencia < 0)) {
      setSalvando(false)
      setAviso({ tipo: 'erro', texto: 'Informe a experiência em anos usando apenas números positivos.' })
      return
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nome: form.nome,
        telefone: form.telefone,
        cidade: form.cidade,
        bio: form.descricaoProfissional,
        experiencia_anos: experiencia,
        historico_profissional: form.historicoProfissional,
        tipo: tipoUsuario,
      })

    setSalvando(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Salvar perfil: ${error.message}` })
      return
    }

    setAviso({ tipo: 'ok', texto: 'Perfil profissional atualizado.' })
  }

  async function alternarCategoria(categoria: CategoriaOption) {
    setAviso(null)

    const jaSelecionada = categoriasSelecionadas.some((item) => item.categoriaId === categoria.id)
    const limite = planoAtual.limites.categorias

    if (modoDemo) {
      if (jaSelecionada) {
        setCategoriasSelecionadas((atual) => atual.filter((item) => item.categoriaId !== categoria.id))
        setAviso({ tipo: 'ok', texto: 'Categoria removida da demonstração.' })
        return
      }

      if (categoriasSelecionadas.length >= limite) {
        setAviso({ tipo: 'erro', texto: `Seu plano ${planoAtual.nome} permite até ${textoLimite(limite)} categoria(s).` })
        return
      }

      setCategoriasSelecionadas((atual) => [
        { id: `demo-cat-${categoria.id}`, categoriaId: categoria.id, nome: categoria.nome },
        ...atual,
      ])
      setAviso({ tipo: 'ok', texto: 'Categoria adicionada na demonstração.' })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (jaSelecionada) {
      const categoriaAtual = categoriasSelecionadas.find((item) => item.categoriaId === categoria.id)
      if (!categoriaAtual) return

      const { error } = await supabase
        .from('profissional_categorias')
        .delete()
        .eq('id', categoriaAtual.id)
        .eq('profissional_id', user.id)

      if (error) {
        setAviso({ tipo: 'erro', texto: `Remover categoria: ${error.message}` })
        return
      }

      setCategoriasSelecionadas((atual) => atual.filter((item) => item.id !== categoriaAtual.id))
      setAviso({ tipo: 'ok', texto: 'Categoria removida.' })
      return
    }

    if (categoriasSelecionadas.length >= limite) {
      setAviso({ tipo: 'erro', texto: `Seu plano ${planoAtual.nome} permite até ${textoLimite(limite)} categoria(s).` })
      return
    }

    const { data, error } = await supabase
      .from('profissional_categorias')
      .insert({
        profissional_id: user.id,
        categoria_id: categoria.id,
      })
      .select('id, categoria_id, created_at')
      .maybeSingle()

    if (error) {
      setAviso({ tipo: 'erro', texto: `Adicionar categoria: ${error.message}` })
      return
    }

    setCategoriasSelecionadas((atual) => [
      {
        id: data?.id || `cat-${categoria.id}`,
        categoriaId: categoria.id,
        nome: categoria.nome,
        createdAt: data?.created_at,
      },
      ...atual,
    ])
    setAviso({ tipo: 'ok', texto: 'Categoria adicionada com sucesso.' })
  }

  async function adicionarServico() {
    setAviso(null)

    const limite = planoAtual.limites.servicos
    if (servicos.length >= limite) {
      setAviso({ tipo: 'erro', texto: `Seu plano ${planoAtual.nome} permite até ${textoLimite(limite)} serviço(s).` })
      return
    }

    const categoria = categoriasOpcoes.find((item) => String(item.id) === novoServico.categoriaId)
    if (!categoria) {
      setAviso({ tipo: 'erro', texto: 'Escolha uma categoria para o serviço.' })
      return
    }

    const servicoMapeado: ServicoProfissional = {
      id: `servico-${Date.now()}`,
      titulo: novoServico.titulo.trim(),
      descricao: novoServico.descricao.trim(),
      categoriaId: categoria.id,
      categoriaNome: categoria.nome,
      valorHora: novoServico.valorHora.trim() ? Number(novoServico.valorHora) : null,
      createdAt: new Date().toISOString(),
    }

    if (!servicoMapeado.titulo || !servicoMapeado.descricao) {
      setAviso({ tipo: 'erro', texto: 'Preencha nome e descrição do serviço.' })
      return
    }

    if (
      servicoMapeado.valorHora !== null &&
      (!Number.isFinite(servicoMapeado.valorHora) || servicoMapeado.valorHora < 0)
    ) {
      setAviso({ tipo: 'erro', texto: 'Informe um valor/hora válido.' })
      return
    }

    if (modoDemo) {
      setServicos((atual) => [servicoMapeado, ...atual])
      setNovoServico(NOVO_SERVICO_VAZIO)
      setAviso({ tipo: 'ok', texto: 'Serviço adicionado na demonstração.' })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSalvandoServico(true)
    const { data, error } = await supabase
      .from('servicos')
      .insert({
        profissional_id: user.id,
        categoria_id: categoria.id,
        titulo: servicoMapeado.titulo,
        descricao: servicoMapeado.descricao,
        valor_hora: servicoMapeado.valorHora,
      })
      .select('id, titulo, descricao, categoria_id, valor_hora, created_at')
      .maybeSingle()
    setSalvandoServico(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Adicionar serviço: ${error.message}` })
      return
    }

    setServicos((atual) => [
      {
        id: data?.id || servicoMapeado.id,
        titulo: data?.titulo || servicoMapeado.titulo,
        descricao: data?.descricao || servicoMapeado.descricao,
        categoriaId: data?.categoria_id || servicoMapeado.categoriaId,
        categoriaNome: categoria.nome,
        valorHora: typeof data?.valor_hora === 'number' ? data.valor_hora : servicoMapeado.valorHora,
        createdAt: data?.created_at || servicoMapeado.createdAt,
      },
      ...atual,
    ])
    setNovoServico(NOVO_SERVICO_VAZIO)
    setAviso({ tipo: 'ok', texto: 'Serviço cadastrado com sucesso.' })
  }

  async function removerServico(id: string) {
    setAviso(null)

    if (modoDemo) {
      setServicos((atual) => atual.filter((item) => item.id !== id))
      setAviso({ tipo: 'ok', texto: 'Serviço removido da demonstração.' })
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('servicos')
      .delete()
      .eq('id', id)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Remover serviço: ${error.message}` })
      return
    }

    setServicos((atual) => atual.filter((item) => item.id !== id))
    setAviso({ tipo: 'ok', texto: 'Serviço removido.' })
  }

  function alterarForm<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function alterarNovoServico<K extends keyof NovoServicoForm>(campo: K, valor: NovoServicoForm[K]) {
    setNovoServico((atual) => ({ ...atual, [campo]: valor }))
  }

  return (
    <main className="p-4 space-y-4">
      <CabecalhoAjuste
        titulo="Conta"
        subtitulo="RF08, RF09 e RF10 · fortaleça seu perfil com categorias, serviços e experiência"
        voltarHref="/profissional/configuracoes"
      />

      <section className="bg-white rounded-3xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white text-2xl font-bold flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span>{pegarIniciais(form.nome) || 'MC'}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => inputFotoRef.current?.click()}
                disabled={enviandoFoto}
                className="absolute -bottom-1 -right-1 w-9 h-9 bg-emerald-700 text-white rounded-full flex items-center justify-center text-sm shadow-md hover:bg-emerald-800 disabled:opacity-50"
                aria-label="Alterar foto de perfil"
              >
                {enviandoFoto ? '...' : '📷'}
              </button>
            </div>
            <div>
              <p className="font-bold text-lg text-gray-900">{form.nome || 'Prestador'}</p>
              <p className="text-xs text-gray-500">{email}</p>
              <p className="text-xs font-semibold text-emerald-700 mt-2">Plano {planoAtual.nome}</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          onChange={trocarFoto}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            disabled={enviandoFoto}
            className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={removerFoto}
              disabled={enviandoFoto}
              className="rounded-full bg-red-50 px-3 py-2 font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Remover foto
            </button>
          )}
          <span className="text-gray-400">JPG ou PNG · até {TAMANHO_MAX_MB} MB</span>
        </div>
      </section>

      <form onSubmit={salvarPerfil} className="space-y-4">
        <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dados pessoais</h2>
          <Campo
            label="Nome completo"
            valor={form.nome}
            placeholder="Como deseja aparecer para os clientes"
            disabled={carregando}
            onChange={(valor) => alterarForm('nome', valor)}
          />
          <CampoLeitura label="E-mail" valor={email} dica="Para alterar o e-mail use a tela de segurança." />
          <Campo
            label="Telefone / WhatsApp"
            valor={form.telefone}
            placeholder="(00) 00000-0000"
            disabled={carregando}
            onChange={(valor) => alterarForm('telefone', valor)}
          />
          <Campo
            label="Cidade onde atende"
            valor={form.cidade}
            placeholder="Ex.: Vitória - ES"
            disabled={carregando}
            onChange={(valor) => alterarForm('cidade', valor)}
          />
        </section>

        <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Apresentação profissional</h2>
            <p className="text-[11px] text-gray-400 mt-1">RF10 · informe descrição, experiência e histórico para ganhar confiança.</p>
          </div>

          <CampoTexto
            label="Descrição profissional"
            valor={form.descricaoProfissional}
            placeholder="Explique como você trabalha, especialidades, diferenciais e tipo de atendimento."
            disabled={carregando}
            onChange={(valor) => alterarForm('descricaoProfissional', valor)}
          />
          <Campo
            label="Experiência (anos)"
            valor={form.experienciaAnos}
            placeholder="Ex.: 7"
            disabled={carregando}
            onChange={(valor) => alterarForm('experienciaAnos', valor)}
          />
          <CampoTexto
            label="Histórico profissional"
            valor={form.historicoProfissional}
            placeholder="Conte onde já atuou, tipos de clientes atendidos e marcos importantes da sua trajetória."
            disabled={carregando}
            rows={5}
            onChange={(valor) => alterarForm('historicoProfissional', valor)}
          />
        </section>

        <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categorias de atuação</h2>
              <p className="text-[11px] text-gray-400 mt-1">RF08 · escolha onde você atua. Seu plano libera até {textoLimite(planoAtual.limites.categorias)} categoria(s).</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {categoriasSelecionadas.length}/{textoLimite(planoAtual.limites.categorias)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoriasOpcoes.map((categoria) => {
              const ativa = categoriasSelecionadas.some((item) => item.categoriaId === categoria.id)
              return (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => alternarCategoria(categoria)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    ativa
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {categoria.nome}
                </button>
              )
            })}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Serviços específicos</h2>
              <p className="text-[11px] text-gray-400 mt-1">RF09 · cadastre exatamente o que você oferece. Limite do plano: {textoLimite(planoAtual.limites.servicos)} serviço(s).</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {servicos.length}/{textoLimite(planoAtual.limites.servicos)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4">
            <Campo
              label="Nome do serviço"
              valor={novoServico.titulo}
              placeholder="Ex.: Instalação de ventilador de teto"
              onChange={(valor) => alterarNovoServico('titulo', valor)}
            />

            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Categoria</span>
              <select
                value={novoServico.categoriaId}
                onChange={(e) => alterarNovoServico('categoriaId', e.target.value)}
                className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="">Selecione</option>
                {categoriasOpcoes.map((categoria) => (
                  <option key={categoria.id} value={String(categoria.id)}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>

            <CampoTexto
              label="Descrição do serviço"
              valor={novoServico.descricao}
              placeholder="Explique o que está incluso, materiais, diferenciais e observações."
              rows={4}
              onChange={(valor) => alterarNovoServico('descricao', valor)}
            />

            <Campo
              label="Valor por hora (opcional)"
              valor={novoServico.valorHora}
              placeholder="Ex.: 120"
              onChange={(valor) => alterarNovoServico('valorHora', valor)}
            />

            <button
              type="button"
              onClick={adicionarServico}
              disabled={salvandoServico}
              className="w-full bg-emerald-700 text-white font-semibold py-3 rounded-2xl text-sm hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {salvandoServico ? 'Adicionando serviço...' : 'Adicionar serviço'}
            </button>
          </div>

          <div className="space-y-3">
            {servicos.map((servico) => (
              <article key={servico.id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{servico.titulo}</p>
                    <p className="text-xs text-gray-500 mt-1">{servico.categoriaNome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerServico(servico.id)}
                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Remover
                  </button>
                </div>
                <p className="text-sm text-gray-600">{servico.descricao}</p>
                <p className="text-sm font-semibold text-emerald-700">{formatarMoeda(servico.valorHora)} / hora</p>
              </article>
            ))}

            {servicos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-gray-700">Nenhum serviço cadastrado</p>
                <p className="text-xs text-gray-500 mt-1">Crie seus primeiros serviços para aparecer melhor nas buscas e demandas.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-900">Documentação para validação</p>
            <p className="text-xs text-sky-800 mt-1">
              RF11 · envie RG, comprovantes e certificados na tela de documentos para ganhar mais confiança dos clientes.
            </p>
          </div>
          <Link
            href="/profissional/configuracoes/documentos"
            className="shrink-0 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Abrir
          </Link>
        </section>

        {aviso && (
          <div
            className={`rounded-2xl p-3 text-sm font-medium ${
              aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {aviso.texto}
          </div>
        )}

        <button
          type="submit"
          disabled={salvando || carregando}
          className="w-full bg-emerald-700 text-white font-semibold py-3 rounded-2xl text-sm hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          {salvando ? 'Salvando perfil...' : 'Salvar alterações'}
        </button>
      </form>
    </main>
  )
}

function Campo(props: {
  label: string
  valor: string
  placeholder: string
  disabled?: boolean
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <input
        type="text"
        value={props.valor}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white disabled:opacity-60"
      />
    </label>
  )
}

function CampoLeitura(props: { label: string; valor: string; dica?: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <div className="mt-1 w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500">
        {props.valor || '—'}
      </div>
      {props.dica && <p className="text-[11px] text-gray-400 mt-1">{props.dica}</p>}
    </div>
  )
}

function CampoTexto(props: {
  label: string
  valor: string
  placeholder: string
  disabled?: boolean
  rows?: number
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <textarea
        value={props.valor}
        placeholder={props.placeholder}
        disabled={props.disabled}
        rows={props.rows || 4}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white resize-none disabled:opacity-60"
      />
    </label>
  )
}
