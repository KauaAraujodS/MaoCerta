import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * RF40.2 — Webhook Mercado Pago (ou PSP) confirma Pix.
 * Configure MERCADO_PAGO_WEBHOOK_SECRET e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */
export async function POST(req: Request) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  const sig = req.headers.get('x-webhook-secret') || req.headers.get('x-signature') || ''
  if (secret && sig !== secret) {
    return NextResponse.json({ ok: false, erro: 'assinatura' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const data = body?.data as Record<string, unknown> | undefined
  const txid =
    (typeof data?.id === 'string' && data.id) ||
    (typeof body?.txid === 'string' && body.txid) ||
    (typeof body?.pix_txid === 'string' && body.pix_txid) ||
    ''

  if (!txid) {
    return NextResponse.json({ ok: false, erro: 'txid_ausente' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, erro: 'service_role_nao_configurado' }, { status: 503 })
  }

  const idem =
    req.headers.get('x-idempotency-key') ||
    req.headers.get('x-request-id') ||
    (typeof body?.id === 'string' ? body.id : null) ||
    null

  const { data: rpcData, error } = await admin.rpc('fn_financeiro_webhook_confirmar_pix', {
    p_pix_txid: txid,
    p_webhook_ref: JSON.stringify(body).slice(0, 900),
    p_idempotency_key: idem,
  })

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })
  }

  return NextResponse.json(rpcData)
}
