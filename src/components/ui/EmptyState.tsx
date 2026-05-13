import Link from 'next/link'

type Props = {
  emoji: string
  titulo: string
  texto: string
  acao?: { label: string; href: string }
}

export default function EmptyState({ emoji, titulo, texto, acao }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-6 text-center space-y-2 shadow-sm">
      <p className="text-3xl" aria-hidden>
        {emoji}
      </p>
      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{titulo}</p>
      <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">{texto}</p>
      {acao && (
        <Link
          href={acao.href}
          className="inline-block mt-2 text-xs font-bold text-violet-700 dark:text-violet-400 hover:underline"
        >
          {acao.label} →
        </Link>
      )}
    </section>
  )
}
