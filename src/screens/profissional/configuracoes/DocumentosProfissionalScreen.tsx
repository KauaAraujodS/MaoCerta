'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import CabecalhoAjuste from '@/screens/configuracoes/CabecalhoAjuste'
import { createClient } from '@/lib/supabase/client'
import {
  DEMO_DOCUMENTOS,
  formatarData,
  statusDocumentoMeta,
  type DocumentoProfissional,
} from '@/lib/profissional'

const TIPOS_DOCUMENTO = [
  'Documento com foto',
  'CPF',
  'Comprovante de endereço',
  'Certificado técnico',
  'MEI / CNPJ',
  'Antecedentes / referência',
]

const TAMANHO_MAX_MB = 8

export default function DocumentosProfissionalScreen() {
  const [documentos, setDocumentos] = useState<DocumentoProfissional[]>(DEMO_DOCUMENTOS)
  const [tipoDocumento, setTipoDocumento] = useState(TIPOS_DOCUMENTO[0])
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [modoDemo, setModoDemo] = useState(true)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setCarregando(false)
        return
      }

      setModoDemo(false)

      const { data, error } = await supabase
        .from('documentos_profissionais')
        .select('id, tipo_documento, nome_arquivo, arquivo_path, mime_type, status, observacoes, created_at')
        .eq('profissional_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setAviso({
          tipo: 'erro',
          texto: 'A lista de documentos depende da migration 007 no Supabase. Depois de aplicar, o upload passa a funcionar normalmente.',
        })
      } else {
        setDocumentos((data || []).map((item) => ({
          id: item.id,
          tipoDocumento: item.tipo_documento,
          nomeArquivo: item.nome_arquivo,
          arquivoPath: item.arquivo_path,
          mimeType: item.mime_type,
          status: item.status,
          observacoes: item.observacoes,
          createdAt: item.created_at,
        })) as DocumentoProfissional[])
      }

      setCarregando(false)
    }

    carregar()
  }, [])

  function selecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    setArquivo(e.target.files?.[0] || null)
  }

  async function enviarDocumento() {
    setAviso(null)

    if (!arquivo) {
      setAviso({ tipo: 'erro', texto: 'Escolha um arquivo antes de enviar.' })
      return
    }

    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!tiposPermitidos.includes(arquivo.type)) {
      setAviso({ tipo: 'erro', texto: 'Envie PDF, JPG, PNG ou WEBP.' })
      return
    }

    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setAviso({ tipo: 'erro', texto: `O arquivo precisa ter no máximo ${TAMANHO_MAX_MB} MB.` })
      return
    }

    if (modoDemo) {
      setDocumentos((atual) => [
        {
          id: `demo-doc-${Date.now()}`,
          tipoDocumento,
          nomeArquivo: arquivo.name,
          arquivoPath: `demo/${arquivo.name}`,
          mimeType: arquivo.type,
          status: 'pendente',
          observacoes: null,
          createdAt: new Date().toISOString(),
        },
        ...atual,
      ])
      setArquivo(null)
      setAviso({ tipo: 'ok', texto: 'Documento adicionado na demonstração. Faça login para enviar ao Supabase.' })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAviso({ tipo: 'erro', texto: 'Faça login para enviar documentos.' })
      return
    }

    setEnviando(true)
    const extensao = arquivo.name.split('.').pop() || 'pdf'
    const caminho = `${user.id}/${Date.now()}-${arquivo.name.replace(/\s+/g, '-').toLowerCase()}.${extensao}`.replace(`.${extensao}.${extensao}`, `.${extensao}`)

    const { error: erroUpload } = await supabase.storage
      .from('documentos-profissionais')
      .upload(caminho, arquivo, {
        upsert: true,
        cacheControl: '3600',
        contentType: arquivo.type,
      })

    if (erroUpload) {
      setEnviando(false)
      setAviso({ tipo: 'erro', texto: `Upload do documento: ${erroUpload.message}` })
      return
    }

    const { data, error } = await supabase
      .from('documentos_profissionais')
      .insert({
        profissional_id: user.id,
        tipo_documento: tipoDocumento,
        nome_arquivo: arquivo.name,
        arquivo_path: caminho,
        mime_type: arquivo.type,
      })
      .select('id, tipo_documento, nome_arquivo, arquivo_path, mime_type, status, observacoes, created_at')
      .maybeSingle()

    setEnviando(false)

    if (error) {
      setAviso({ tipo: 'erro', texto: `Salvar documento: ${error.message}` })
      return
    }

    setDocumentos((atual) => [
      {
        id: data?.id || `doc-${Date.now()}`,
        tipoDocumento: data?.tipo_documento || tipoDocumento,
        nomeArquivo: data?.nome_arquivo || arquivo.name,
        arquivoPath: data?.arquivo_path || caminho,
        mimeType: data?.mime_type || arquivo.type,
        status: (data?.status || 'pendente') as DocumentoProfissional['status'],
        observacoes: data?.observacoes || null,
        createdAt: data?.created_at || new Date().toISOString(),
      },
      ...atual,
    ])
    setArquivo(null)
    setAviso({ tipo: 'ok', texto: 'Documento enviado para validação.' })
  }

  async function abrirDocumento(documento: DocumentoProfissional) {
    if (modoDemo) {
      setAviso({ tipo: 'ok', texto: `Documento demo "${documento.nomeArquivo}" pronto para visualização no ambiente real.` })
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('documentos-profissionais')
      .createSignedUrl(documento.arquivoPath, 60)

    if (error || !data?.signedUrl) {
      setAviso({ tipo: 'erro', texto: `Abrir documento: ${error?.message || 'Não foi possível gerar o link.'}` })
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function removerDocumento(documento: DocumentoProfissional) {
    setAviso(null)

    if (modoDemo) {
      setDocumentos((atual) => atual.filter((item) => item.id !== documento.id))
      setAviso({ tipo: 'ok', texto: 'Documento removido da demonstração.' })
      return
    }

    const supabase = createClient()
    const { error: erroTabela } = await supabase
      .from('documentos_profissionais')
      .delete()
      .eq('id', documento.id)

    if (erroTabela) {
      setAviso({ tipo: 'erro', texto: `Remover documento: ${erroTabela.message}` })
      return
    }

    await supabase.storage
      .from('documentos-profissionais')
      .remove([documento.arquivoPath])

    setDocumentos((atual) => atual.filter((item) => item.id !== documento.id))
    setAviso({ tipo: 'ok', texto: 'Documento removido.' })
  }

  return (
    <main className="p-4 space-y-4">
      <CabecalhoAjuste
        titulo="Documentos"
        subtitulo="RF11 · envie documentação para validação do seu perfil profissional"
        voltarHref="/profissional/configuracoes"
      />

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-gray-900">Validação da conta</p>
            <p className="text-sm text-gray-500 mt-1">
              Envie documentos legíveis para aumentar a confiança dos clientes e agilizar a aprovação.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
            {modoDemo ? 'Demo' : 'Ao vivo'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipo de documento</span>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-sky-600"
            >
              {TIPOS_DOCUMENTO.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Arquivo</span>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={selecionarArquivo}
              className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-sky-600"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              PDF, JPG, PNG ou WEBP · até {TAMANHO_MAX_MB} MB · status inicial: em análise
            </p>
            <button
              type="button"
              onClick={enviarDocumento}
              disabled={enviando}
              className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar documento'}
            </button>
          </div>
        </div>
      </section>

      {aviso && (
        <section
          className={`rounded-2xl p-3 text-sm font-medium ${
            aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {aviso.texto}
        </section>
      )}

      <section className="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gray-900">Arquivos enviados</h2>
          <p className="text-sm text-gray-500 mt-1">Acompanhe o status de validação de cada documento.</p>
        </div>

        {carregando && (
          <p className="text-sm text-gray-500">Carregando documentos...</p>
        )}

        {!carregando && documentos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Nenhum documento enviado</p>
            <p className="text-xs text-gray-500 mt-1">Assim que você mandar o primeiro arquivo, ele aparece aqui com status de validação.</p>
          </div>
        )}

        <div className="space-y-3">
          {documentos.map((documento) => {
            const meta = statusDocumentoMeta(documento.status)

            return (
              <article key={documento.id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{documento.tipoDocumento}</p>
                    <p className="text-xs text-gray-500 mt-1">{documento.nomeArquivo}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.classe}`}>
                    {meta.texto}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Enviado em {formatarData(documento.createdAt)}</span>
                  {documento.mimeType && <span>{documento.mimeType}</span>}
                </div>

                {documento.observacoes && (
                  <div className="rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {documento.observacoes}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => abrirDocumento(documento)}
                    className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    Visualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => removerDocumento(documento)}
                    className="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Remover
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
