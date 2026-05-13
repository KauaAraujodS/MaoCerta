import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { precoPlano } from '@/lib/planos-precos'

type Body = { plano?: 'basico' | 'premium' }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const plano = body.plano
  if (plano !== 'basico' && plano !== 'premium') {
    return NextResponse.json({ ok: false, erro: 'plano_invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, erro: 'nao_autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo, nome, plano')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ ok: false, erro: 'perfil_nao_encontrado' }, { status: 404 })
  }

  if (profile.plano === plano) {
    return NextResponse.json({ ok: false, erro: 'plano_atual_igual' }, { status: 400 })
  }

  const valor = precoPlano(profile.tipo, plano)
  if (!valor || valor <= 0) {
    return NextResponse.json({ ok: false, erro: 'preco_indisponivel' }, { status: 400 })
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ ok: false, erro: 'mp_nao_configurado' }, { status: 503 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, erro: 'service_role_nao_configurado' }, { status: 503 })
  }

  // 1) Pre-cria o registro (pra ter id estavel pra external_reference / idempotency)
  const { data: pp, error: errInsert } = await admin
    .from('pagamentos_plano')
    .insert({
      user_id: user.id,
      plano_alvo: plano,
      valor,
      status: 'aguardando_pix',
    })
    .select('id')
    .single()
  if (errInsert || !pp) {
    return NextResponse.json(
      { ok: false, erro: 'falha_pre_registro', detalhe: errInsert?.message },
      { status: 500 },
    )
  }

  // 2) Chama a API do Mercado Pago para criar o pagamento Pix
  // MP exige notification_url HTTPS publica — em dev (localhost), nao enviamos
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const isPublicHttps = /^https:\/\//.test(appUrl)
  const partes = (profile.nome || 'Usuario').trim().split(/\s+/)
  const firstName = partes[0] || 'Usuario'
  const lastName = partes.slice(1).join(' ') || 'Pagador'

  const payloadMp: Record<string, unknown> = {
    transaction_amount: valor,
    payment_method_id: 'pix',
    description: `MaoCerta - assinatura plano ${plano}`,
    external_reference: `plano:${pp.id}`,
    payer: {
      email: user.email || `teste-${pp.id}@maocerta.app`,
      first_name: firstName,
      last_name: lastName,
      identification: { type: 'CPF', number: '19119119100' },
    },
  }
  if (isPublicHttps) {
    payloadMp.notification_url = `${appUrl}/api/webhooks/mercado-pago`
  }

  let mpResp: Response
  try {
    mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `plano-${pp.id}`,
      },
      body: JSON.stringify(payloadMp),
    })
  } catch (e) {
    await admin.from('pagamentos_plano').update({ status: 'cancelado' }).eq('id', pp.id)
    return NextResponse.json(
      { ok: false, erro: 'mp_inacessivel', detalhe: (e as Error).message },
      { status: 502 },
    )
  }

  if (!mpResp.ok) {
    const detalhe = await mpResp.text().catch(() => '')
    console.error('[MP] criar pagamento falhou:', mpResp.status, detalhe)
    await admin.from('pagamentos_plano').update({ status: 'cancelado' }).eq('id', pp.id)
    return NextResponse.json(
      { ok: false, erro: 'mp_falhou', mp_status: mpResp.status, detalhe },
      { status: 502 },
    )
  }

  type MpPayment = {
    id: number | string
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string
        qr_code_base64?: string
        ticket_url?: string
      }
    }
    date_of_expiration?: string
  }
  const mp = (await mpResp.json()) as MpPayment
  const qr = mp.point_of_interaction?.transaction_data

  await admin
    .from('pagamentos_plano')
    .update({
      mp_payment_id: String(mp.id),
      mp_qr_code_base64: qr?.qr_code_base64 ?? null,
      mp_pix_copia_e_cola: qr?.qr_code ?? null,
      mp_expires_at: mp.date_of_expiration ?? null,
    })
    .eq('id', pp.id)

  return NextResponse.json({
    ok: true,
    pagamento_id: pp.id,
    qr_code_base64: qr?.qr_code_base64,
    pix_copia_e_cola: qr?.qr_code,
    ticket_url: qr?.ticket_url,
    expira_em: mp.date_of_expiration,
    valor,
    plano,
  })
}
