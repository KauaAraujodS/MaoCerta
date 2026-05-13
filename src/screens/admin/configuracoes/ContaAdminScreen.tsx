'use client'

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'

type Form = {
  nome: string
  telefone: string
}

const VAZIO: Form = { nome: '', telefone: '' }
const TAMANHO_MAX_MB = 2

function pegarIniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')
}

export default function ContaAdminScreen() {
  const [form, setForm] = useState<Form>(VAZIO)
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setEmail('admin@maocerta.com')
        setForm({ nome: 'Administrador', telefone: '' })
        setCarregando(false)
        return
      }

      setEmail(user.email || '')

      const { data, error } = await supabase
        .from('profiles')
        .select('nome, telefone, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('[carregar] select profile', error)
        setAviso({ tipo: 'erro', texto: `Carregar: ${error.message}` })
      } else if (!data) {
        const meta = user.user_metadata as { nome?: string; telefone?: string }
        setForm({ nome: meta?.nome || '', telefone: meta?.telefone || '' })
      } else {
        setForm({
          nome: data.nome || '',
          telefone: data.telefone || '',
        })
        setAvatarUrl(data.avatar_url || null)
      }
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
      setAviso({ tipo: 'erro', texto: 'Faça login para alterar sua foto.' })
      return
    }

    setEnviandoFoto(true)
    const extensao = arquivo.name.split('.').pop() || 'jpg'
    const caminho = `${user.id}/avatar-${Date.now()}.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from('avatars')
      .upload(caminho, arquivo, { upsert: true, cacheControl: '3600', contentType: arquivo.type })

    if (erroUpload) {
      console.error('[avatar] upload', erroUpload)
      setAviso({ tipo: 'erro', texto: `Upload: ${erroUpload.message}` })
      setEnviandoFoto(false)
      return
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(caminho)
    const url = publicUrl.publicUrl

    const meta = user.user_metadata as { tipo?: 'cliente' | 'profissional' | 'administrador'; nome?: string; telefone?: string }
    const tipoUsuario = meta?.tipo || 'administrador'
    const nomeAtual = form.nome || meta?.nome || user.email?.split('@')[0] || 'Administrador'
    const telefoneAtual = form.telefone || meta?.telefone || ''

    const { error: erroBanco } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nome: nomeAtual,
        tipo: tipoUsuario,
        telefone: telefoneAtual,
        avatar_url: url,
      })

    setEnviandoFoto(false)

    if (erroBanco) {
      console.error('[avatar] update profile', erroBanco)
      setAviso({ tipo: 'erro', texto: `Perfil: ${erroBanco.message}` })
      return
    }

    setAvatarUrl(url)
    setAviso({ tipo: 'ok', texto: 'Foto de perfil atualizada.' })
  }

  async function removerFoto() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para alterar sua foto.' })
      return
    }

    setEnviandoFoto(true)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)
    setEnviandoFoto(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível remover a foto.' })
      return
    }

    setAvatarUrl(null)
    setAviso({ tipo: 'ok', texto: 'Foto removida.' })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para salvar suas alterações.' })
      setSalvando(false)
      return
    }

    const tipoUsuario = (user.user_metadata as { tipo?: 'cliente' | 'profissional' | 'administrador' })?.tipo || 'administrador'

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nome: form.nome,
        telefone: form.telefone,
        tipo: tipoUsuario,
      })

    if (error) {
      console.error('[salvar] update profile', error)
      setAviso({ tipo: 'erro', texto: `Salvar: ${error.message}` })
    } else {
      setAviso({ tipo: 'ok', texto: 'Dados atualizados com sucesso.' })
    }
    setSalvando(false)
  }

  function alterar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm(anterior => ({ ...anterior, [campo]: valor }))
  }

  return (
    <main className="min-h-screen pb-10">
      <CabecalhoAjuste titulo="Conta" subtitulo="Edite seus dados de administrador" voltarHref="/admin/configuracoes" tema="admin" />
      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 relative z-10">

      <section className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-2xl font-bold flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              <span>{pegarIniciais(form.nome) || '🛡️'}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            disabled={enviandoFoto}
            className="absolute -bottom-1 -right-1 w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm shadow-md hover:bg-slate-900 disabled:opacity-50"
            aria-label="Alterar foto de perfil"
          >
            {enviandoFoto ? '…' : '📷'}
          </button>
        </div>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          onChange={trocarFoto}
          className="hidden"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            disabled={enviandoFoto}
            className="text-slate-800 text-xs font-semibold hover:text-slate-900 disabled:opacity-50"
          >
            {avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {avatarUrl && (
            <>
              <span className="text-gray-300 text-xs">·</span>
              <button
                type="button"
                onClick={removerFoto}
                disabled={enviandoFoto}
                className="text-red-600 text-xs font-semibold hover:text-red-800 disabled:opacity-50"
              >
                Remover
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-gray-400">JPG ou PNG · até {TAMANHO_MAX_MB} MB</p>
      </section>

      <form onSubmit={salvar} className="space-y-4">
        <section className="bg-white rounded-2xl p-5 space-y-4">
          <Campo
            label="Nome completo"
            valor={form.nome}
            placeholder="Como aparece nos registros internos"
            disabled={carregando}
            onChange={v => alterar('nome', v)}
          />
          <CampoLeitura label="E-mail" valor={email} dica="Para alterar o e-mail use Privacidade e Segurança." />
          <Campo
            label="Telefone de contato interno"
            valor={form.telefone}
            placeholder="(00) 00000-0000"
            disabled={carregando}
            onChange={v => alterar('telefone', v)}
          />
          <CampoLeitura label="Tipo de conta" valor="Administrador" dica="Você tem acesso ao painel de moderação e métricas." />
        </section>

        <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Conta de administrador</p>
            <p className="text-xs text-slate-700 mt-1">
              Suas ações ficam registradas em log de auditoria. Não compartilhe seu acesso e habilite a autenticação em 2 fatores em Privacidade e Segurança.
            </p>
          </div>
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
          className="w-full bg-slate-800 text-white font-semibold py-3 rounded-2xl text-sm hover:bg-slate-900 transition-colors disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
      </div>
    </main>
  )
}

function Campo(props: {
  label: string
  valor: string
  placeholder: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{props.label}</span>
      <input
        type="text"
        value={props.valor}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={e => props.onChange(e.target.value)}
        className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-slate-700 focus:bg-white"
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
