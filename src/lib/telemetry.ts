/**
 * Telemetria leve: erros de RPC/API no cliente (console; opcional envio futuro).
 */
export function logClienteErro(contexto: string, erro: unknown, extra?: Record<string, unknown>) {
  const msg = erro instanceof Error ? erro.message : String(erro)
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[MaoCerta:${contexto}]`, msg, extra ?? '')
  }
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_TELEMETRY_URL) {
    void fetch(process.env.NEXT_PUBLIC_TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contexto, msg, extra, path: window.location?.pathname }),
      keepalive: true,
    }).catch(() => {})
  }
}
