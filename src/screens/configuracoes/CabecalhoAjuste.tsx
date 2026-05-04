import Link from 'next/link'

type Props = {
  titulo: string
  subtitulo?: string
  voltarHref: string
}

export default function CabecalhoAjuste({ titulo, subtitulo, voltarHref }: Props) {
  return (
    <header className="space-y-2">
      <Link
        href={voltarHref}
        className="inline-flex items-center gap-1 text-purple-700 text-sm font-medium hover:text-purple-900"
      >
        <span className="text-base">‹</span> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        {subtitulo && <p className="text-gray-500 text-sm mt-1">{subtitulo}</p>}
      </div>
    </header>
  )
}
