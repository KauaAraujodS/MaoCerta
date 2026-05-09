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
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 px-2 pt-2">Ajustes</h1>

      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 rounded-3xl p-5 text-white space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              <span>{profile ? pegarIniciais(profile.nome) : '...'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{profile?.nome || 'Carregando...'}</p>
            <p className="text-white/70 text-xs truncate">{profile?.email || ''}</p>
          </div>
        </div>

        <div className="bg-white/15 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-[10px] font-medium">Nível de acesso</p>
            <p className="font-bold">Administrador</p>
          </div>
          <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
            🛡️ INTERNO
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {itens.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white rounded-2xl p-4 hover:bg-gray-50 transition-colors"
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
