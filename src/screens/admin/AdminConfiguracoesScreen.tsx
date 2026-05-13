'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  nome: string
  email: string
  avatarUrl: string | null
}

const itens = [
  {
    href: '/admin/configuracoes/conta',
    icone: '👤',
    titulo: 'Conta',
    descricao: 'Editar dados pessoais',
  },
  {
    href: '/admin/configuracoes/seguranca',
    icone: '🛡️',
    titulo: 'Privacidade e Segurança',
    descricao: '2FA e log de acesso',
  },
  {
    href: '/admin/configuracoes/suporte',
    icone: '❓',
    titulo: 'Suporte',
    descricao: 'Procedimentos internos e contatos',
  },
]

function pegarIniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')
}

export default function AdminConfiguracoesScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setProfile({
          nome: 'Administrador',
          email: 'admin@maocerta.com',
          avatarUrl: null,
        })
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      setProfile({
        nome: data?.nome || user.email?.split('@')[0] || 'Administrador',
        email: user.email || '',
        avatarUrl: data?.avatar_url || null,
      })
    }
    carregar()
  }, [])

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen pb-10">
      <header className="min-h-[200px] flex items-end bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white px-4 pt-8 pb-12 rounded-b-[2rem] shadow-lg">
        <div className="max-w-lg mx-auto w-full space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">Painel interno</p>
          <h1 className="text-2xl font-bold">Ajustes</h1>
          <p className="text-sm text-white/85 leading-relaxed">
            Conta, segurança e procedimentos internos do administrador.
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 relative z-10">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-lg font-bold text-slate-800 overflow-hidden">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span>{profile ? pegarIniciais(profile.nome) : '...'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-gray-900 truncate">{profile?.nome || 'Carregando...'}</p>
              <p className="text-gray-500 text-xs truncate">{profile?.email || ''}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">Nível de acesso</p>
              <p className="font-bold text-slate-800">Administrador</p>
            </div>
            <span className="bg-slate-100 text-slate-800 text-[10px] font-semibold px-2 py-1 rounded-full">
              🛡️ INTERNO
            </span>
          </div>
        </section>

        <div className="space-y-2">
          {itens.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 bg-white rounded-2xl p-4 hover:bg-gray-50 transition-colors shadow-sm border border-gray-100"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg shrink-0">
                {item.icone}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900">{item.titulo}</p>
                <p className="text-xs text-gray-500">{item.descricao}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          ))}
        </div>

        <button
          onClick={sair}
          className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-2xl text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <span>↪</span> Sair da conta
        </button>
      </div>
    </main>
  )
}
