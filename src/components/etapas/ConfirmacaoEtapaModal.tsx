'use client'

import { useState } from 'react'

type Props = {
  etapaId: string
  meuId: string
  onConfirmado: (notas?: string) => void
  onCancelado: () => void
}

export default function ConfirmacaoEtapaModal({
  etapaId,
  meuId,
  onConfirmado,
  onCancelado
}: Props) {
  const [notas, setNotas] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function handleConfirmar() {
    setConfirmando(true)
    try {
      onConfirmado(notas || undefined)
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 p-6 animate-in zoom-in">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">✅ Marcar Etapa como Concluída</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Você tem certeza que concluiu esta etapa?
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Notas de Conclusão (opcional)
          </label>
          <textarea
            placeholder="Descreva o que foi feito nesta etapa..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full text-sm border-2 border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 transition resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancelado}
            disabled={confirmando}
            className="flex-1 border-2 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50 font-semibold py-2 px-4 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={confirmando}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            {confirmando ? '⏳ Confirmando...' : '✅ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
