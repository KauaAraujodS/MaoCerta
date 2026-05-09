'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'

type Documento = {
  id: string
  tipo_documento: string
  arquivo_url: string
  status: string
  criado_em: string
}

const TIPOS = ['CPF', 'CNPJ', 'Documento com foto', 'Comprovante de endereço']

export default function ValidacaoProfissionalScreen() {
  const [tipo, setTipo] = useState(TIPOS[0])
  const [enviando, setEnviando] = useState(false)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return

      const { data } = await supabase
        .from('documentos_validacao')
        .select('id, tipo_documento, arquivo_url, status, criado_em')
        .eq('profissional_id', user.id)
        .order('criado_em', { ascending: false })

      setDocumentos((data as Documento[] | null) || [])
    }
    carregar()
  }, [])

  async function enviarDocumento(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    e.target.value = ''

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    setEnviando(true)
    setAviso(null)

    const extensao = arquivo.name.split('.').pop() || 'jpg'
    const caminho = `${user.id}/${Date.now()}-${tipo.replace(/\s+/g, '-').toLowerCase()}.${extensao}`
    const { error: uploadError } = await supabase.storage.from('documentos-validacao').upload(caminho, arquivo, {
      upsert: true,
      cacheControl: '3600',
      contentType: arquivo.type,
    })

    if (uploadError) {
      setEnviando(false)
      setAviso('Falha no upload. Crie o bucket "documentos-validacao" no Supabase.')
      return
    }

    const { data: urlData } = supabase.storage.from('documentos-validacao').getPublicUrl(caminho)
    const arquivoUrl = urlData.publicUrl

    const { data, error } = await supabase
      .from('documentos_validacao')
      .insert({
        profissional_id: user.id,
        tipo_documento: tipo,
        arquivo_url: arquivoUrl,
      })
      .select('id, tipo_documento, arquivo_url, status, criado_em')
      .single()

    setEnviando(false)
    if (error) {
      setAviso('Falha ao registrar documento. Verifique se aplicou a migration RF11.')
      return
    }

    setDocumentos((atual) => [data as Documento, ...atual])
    setAviso('Documento enviado para validação.')
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto space-y-4">
      <CabecalhoAjuste
        titulo="Validação de documentos"
        subtitulo="Envie seus documentos para liberar selo verificado"
        voltarHref="/profissional/configuracoes"
      />

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipo de documento</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          >
            {TIPOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="w-full bg-emerald-700 text-white text-sm font-semibold py-3 rounded-xl text-center cursor-pointer block">
          {enviando ? 'Enviando...' : 'Selecionar arquivo e enviar'}
          <input type="file" accept="image/*,.pdf" onChange={enviarDocumento} className="hidden" disabled={enviando} />
        </label>
      </section>

      <section className="bg-white rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Histórico de envios</p>
        {documentos.length === 0 && <p className="text-sm text-gray-500">Nenhum documento enviado ainda.</p>}
        {documentos.map((doc) => (
          <div key={doc.id} className="border border-gray-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-900">{doc.tipo_documento}</p>
            <p className="text-xs text-gray-500 mt-1">Status: {doc.status}</p>
            <a href={doc.arquivo_url} target="_blank" className="text-xs text-emerald-700 font-semibold mt-2 inline-block">
              Ver arquivo
            </a>
          </div>
        ))}
      </section>

      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{aviso}</p>}
      </div>
    </main>
  )
}
