'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const abas = [
  { href: '/profissional/inicio', icone: '🏠', label: 'Início' },
  { href: '/profissional/servicos', icone: '🛠️', label: 'Serviços' },
  { href: '/profissional/demandas', icone: '📋', label: 'Demandas' },
  { href: '/profissional/solicitacoes', icone: '📥', label: 'Pedidos' },
  { href: '/profissional/configuracoes', icone: '⚙️', label: 'Ajustes' },
]

export default function MenuInferiorProfissional() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {abas.map((aba) => {
          const ativo = pathname === aba.href
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                ativo ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{aba.icone}</span>
              <span className={`text-[10px] ${ativo ? 'font-semibold' : 'font-medium'}`}>
                {aba.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
