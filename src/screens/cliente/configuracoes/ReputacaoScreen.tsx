'use client'

import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'

type Avaliacao = {
  id: string
  prestador: string
  servico: string
  nota: number
  comentario: string
  data: string
}

const AVALIACOES: Avaliacao[] = []

const METRICAS = {
  notaMedia: 0,
  totalAvaliacoes: 0,
  taxaCancelamento: 0,
  contratacoesConcluidas: 0,
}

export default function ReputacaoScreen() {
  const semHistorico = METRICAS.totalAvaliacoes === 0

  return (
    <main className="min-h-screen pb-10">
      <CabecalhoAjuste titulo="Reputação" subtitulo="Como prestadores enxergam você" voltarHref="/cliente/configuracoes" tema="cliente" />
      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 relative z-10">

      <section className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-5 text-white">
        <div className="flex items-end gap-2">
          <p className="text-5xl font-bold">{METRICAS.notaMedia.toFixed(1)}</p>
          <p className="text-white/80 text-sm pb-2">/ 5,0</p>
        </div>
        <p className="text-white/80 text-sm mt-1">
          Baseado em {METRICAS.totalAvaliacoes} avaliação{METRICAS.totalAvaliacoes === 1 ? '' : 'ões'} de prestadores
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <CardMetrica
          titulo="Contratações concluídas"
          valor={METRICAS.contratacoesConcluidas.toString()}
          dica="Atendimentos finalizados sem disputa"
        />
        <CardMetrica
          titulo="Taxa de cancelamento"
          valor={`${METRICAS.taxaCancelamento}%`}
          dica="Quanto menor, melhor sua reputação"
          alerta={METRICAS.taxaCancelamento > 20}
        />
      </section>

      <section className="bg-white rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Avaliações recebidas</h2>

        {semHistorico ? (
          <div className="text-center py-8 space-y-2">
            <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-2xl">
              ⭐
            </div>
            <p className="text-sm text-gray-600 font-medium">Você ainda não tem avaliações</p>
            <p className="text-xs text-gray-400 max-w-[260px] mx-auto">
              Após contratar um prestador e concluir o atendimento, ele poderá avaliar você.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {AVALIACOES.map(av => (
              <li key={av.id} className="border border-gray-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{av.prestador}</p>
                    <p className="text-[11px] text-gray-400">{av.servico} · {av.data}</p>
                  </div>
                  <span className="text-amber-500 font-bold text-sm">{av.nota.toFixed(1)} ⭐</span>
                </div>
                <p className="text-sm text-gray-700">{av.comentario}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold text-purple-900">Como melhorar sua reputação</p>
        <ul className="text-xs text-purple-800/80 space-y-1 list-disc pl-4">
          <li>Responda às mensagens dos prestadores</li>
          <li>Evite cancelar contratações em andamento</li>
          <li>Cumpra os horários combinados</li>
          <li>Avalie cada atendimento concluído</li>
        </ul>
      </section>
      </div>
    </main>
  )
}

function CardMetrica({
  titulo,
  valor,
  dica,
  alerta,
}: {
  titulo: string
  valor: string
  dica: string
  alerta?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-4 space-y-1">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
      <p className={`text-2xl font-bold ${alerta ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
      <p className="text-[11px] text-gray-400">{dica}</p>
    </div>
  )
}
