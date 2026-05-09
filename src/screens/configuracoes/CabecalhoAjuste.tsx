import Link from 'next/link'

type Tema = 'cliente' | 'prestador' | 'admin'

type Props = {
  titulo: string
  subtitulo?: string
  voltarHref: string
  tema?: Tema
}

const GRADIENTES: Record<Tema, string> = {
  cliente: 'from-purple-700 via-indigo-600 to-blue-600',
  prestador: 'from-emerald-700 via-teal-600 to-cyan-600',
  admin: 'from-slate-800 via-slate-700 to-slate-900',
}

export default function CabecalhoAjuste({ titulo, subtitulo, voltarHref, tema = 'cliente' }: Props) {
  const gradiente = GRADIENTES[tema]
  return (
    <header className={`min-h-[200px] flex items-end bg-gradient-to-br ${gradiente} text-white px-4 pt-8 pb-12 rounded-b-[2rem] shadow-lg`}>
      <div className="max-w-lg mx-auto w-full space-y-2">
        <Link
          href={voltarHref}
          className="inline-flex items-center gap-1 text-white/85 text-sm font-medium hover:text-white"
        >
          <span className="text-base">‹</span> Voltar
        </Link>
        <div>
          <h1 className="text-2xl font-bold leading-tight">{titulo}</h1>
          {subtitulo && <p className="text-white/85 text-sm leading-relaxed mt-1">{subtitulo}</p>}
        </div>
      </div>
    </header>
  )
}
