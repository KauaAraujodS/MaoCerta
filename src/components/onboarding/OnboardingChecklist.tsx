import Link from 'next/link'

type PropsCliente = {
  variant: 'cliente'
  perfilCompleto: boolean
  temDemanda: boolean
  temAtendimento: boolean
}

type PropsProf = {
  variant: 'profissional'
  perfilCompleto: boolean
  temCategorias: boolean
  temServicos: boolean
  temMovimento: boolean
}

type Props = PropsCliente | PropsProf

export default function OnboardingChecklist(props: Props) {
  const itens =
    props.variant === 'cliente'
      ? [
          {
            ok: props.perfilCompleto,
            titulo: 'Perfil com cidade',
            texto: 'Ajuda a filtrar prestadores perto de você.',
            href: '/cliente/configuracoes/conta',
          },
          {
            ok: props.temDemanda,
            titulo: 'Primeira demanda ou solicitação',
            texto: 'Abra uma demanda ou solicite um profissional na busca.',
            href: '/cliente/demandas',
          },
          {
            ok: props.temAtendimento,
            titulo: 'Acompanhar atendimento',
            texto: 'Quando alguém aceitar, acompanhe etapas e pagamentos aqui.',
            href: '/cliente/atendimentos',
          },
        ]
      : [
          {
            ok: props.perfilCompleto,
            titulo: 'Bio e localização',
            texto: 'Clientes confiam mais em perfis completos.',
            href: '/profissional/configuracoes/conta',
          },
          {
            ok: props.temCategorias,
            titulo: 'Áreas de atuação',
            texto: 'Defina em quais categorias você aparece na busca.',
            href: '/profissional/servicos',
          },
          {
            ok: props.temServicos,
            titulo: 'Serviços cadastrados',
            texto: 'Descreva o que você faz e valores orientativos.',
            href: '/profissional/servicos',
          },
          {
            ok: props.temMovimento,
            titulo: 'Primeira proposta ou pedido',
            texto: 'Envie propostas em demandas ou receba solicitações diretas.',
            href: '/profissional/demandas',
          },
        ]

  const total = itens.length
  const ok = itens.filter((i) => i.ok).length
  if (ok >= total) return null

  return (
    <section className="rounded-2xl border border-violet-200/80 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-violet-900 dark:text-violet-200 uppercase tracking-wider">Seu progresso</p>
        <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300">
          {ok}/{total}
        </span>
      </div>
      <ul className="space-y-2">
        {itens.map((item) => (
          <li
            key={item.titulo}
            className={`flex gap-2 rounded-xl border px-3 py-2 text-left ${
              item.ok
                ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20'
                : 'border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60'
            }`}
          >
            <span className="text-base shrink-0" aria-hidden>
              {item.ok ? '✅' : '○'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{item.titulo}</p>
              <p className="text-[11px] text-gray-600 dark:text-slate-400 leading-snug">{item.texto}</p>
              {!item.ok && (
                <Link href={item.href} className="text-[10px] font-bold text-violet-700 dark:text-violet-400 mt-1 inline-block">
                  Ir agora →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
