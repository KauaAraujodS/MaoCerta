import Link from 'next/link'

const atalhos = [
  {
    href: '/profissional/servicos',
    titulo: 'Categorias e serviços',
    descricao: 'Defina onde você atua e quais serviços oferece',
    icone: '🛠️',
  },
  {
    href: '/profissional/demandas',
    titulo: 'Demandas públicas',
    descricao: 'Veja oportunidades abertas e envie propostas',
    icone: '📋',
  },
  {
    href: '/profissional/solicitacoes',
    titulo: 'Solicitações recebidas',
    descricao: 'Pedidos diretos enviados por clientes',
    icone: '📥',
  },
  {
    href: '/profissional/configuracoes/conta',
    titulo: 'Perfil profissional',
    descricao: 'Atualize bio, experiência e histórico',
    icone: '👤',
  },
]

export default function ProfissionalInicio() {
  return (
    <main className="p-4 space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Painel do profissional</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie seu perfil, serviços e propostas em um só lugar.</p>
      </header>

      <section className="space-y-2">
        {atalhos.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-2xl p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">{item.icone}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-900">{item.titulo}</p>
              <p className="text-xs text-gray-500">{item.descricao}</p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
