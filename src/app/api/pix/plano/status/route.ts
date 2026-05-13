import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/** GET /api/pix/plano/status?id=<pagamento_id>
 *  Devolve o status atual do pagamento + plano vigente do usuario.
 *  Se o webhook ainda nao confirmou mas o MP ja aprovou, faz a verificacao ativa.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, erro: 'id_obrigatorio' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, erro: 'nao_autenticado' }, { status: 401 })
  }

  const { data: pp } = await supabase
    .from('pagamentos_plano')
    .select('id, user_id, plano_alvo, status, mp_payment_id')
    .eq('id', id)
    .maybeSingle()
  if (!pp || pp.user_id !== user.id) {
    return NextResponse.json({ ok: false, erro: 'pagamento_nao_encontrado' }, { status: 404 })
  }

  // Se ja esta pago no nosso banco, retorna direto
  if (pp.status === 'pago') {
    const { data: prof } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .maybeSingle()
    return NextResponse.json({
      ok: true,
      status: 'pago',
      plano_alvo: pp.plano_alvo,
      plano_atual: prof?.plano ?? null,
    })
  }

  // Ainda nao confirmado: pergunta direto ao MP (caso o webhook tenha falhado / atrasado)
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken || !pp.mp_payment_id) {
    return NextResponse.json({ ok: true, status: pp.status, plano_alvo: pp.plano_alvo })
  }

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${pp.mp_payment_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (r.ok) {
      const mp = (await r.json()) as { status?: string }
      if (mp.status === 'approved') {
        const admin = createServiceRoleClient()
        if (admin) {
          await admin.rpc('fn_pagamento_plano_confirmar', { p_mp_payment_id: pp.mp_payment_id })
          return NextResponse.json({
            ok: true,
            status: 'pago',
            plano_alvo: pp.plano_alvo,
            plano_atual: pp.plano_alvo,
          })
        }
      }
    }
  } catch {
    // ignora e devolve o status atual
  }

  return NextResponse.json({ ok: true, status: pp.status, plano_alvo: pp.plano_alvo })
}
