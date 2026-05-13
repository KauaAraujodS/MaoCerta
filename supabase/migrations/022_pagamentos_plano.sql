-- RF07 / Assinatura: pagamento de plano via Pix (Mercado Pago)
-- Cria tabela e função que muda o plano do usuário quando confirma pagamento.

create table if not exists public.pagamentos_plano (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plano_alvo public.plano_usuario not null,
  valor numeric(10,2) not null check (valor > 0),
  status text not null default 'aguardando_pix' check (status in ('aguardando_pix','pago','expirado','cancelado')),
  mp_payment_id text unique,            -- id do pagamento no Mercado Pago
  mp_qr_code_base64 text,               -- QR code (imagem em base64)
  mp_pix_copia_e_cola text,             -- chave Pix copia-e-cola
  mp_expires_at timestamptz,
  pago_em timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_pp_user on public.pagamentos_plano(user_id);
create index if not exists idx_pp_status on public.pagamentos_plano(status);

alter table public.pagamentos_plano enable row level security;

drop policy if exists "pp_select_own" on public.pagamentos_plano;
create policy "pp_select_own" on public.pagamentos_plano
  for select to authenticated using (user_id = auth.uid());

-- Sem policy de insert/update direto — fluxo só via rotas server-side (service role).

-- Confirma pagamento (chamada pelo webhook) e troca o plano do usuário.
create or replace function public.fn_pagamento_plano_confirmar(p_mp_payment_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pp record;
begin
  select * into v_pp from public.pagamentos_plano
    where mp_payment_id = p_mp_payment_id for update;

  if not found then
    return json_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
  end if;

  if v_pp.status = 'pago' then
    return json_build_object('ok', true, 'ja_processado', true, 'user_id', v_pp.user_id, 'plano', v_pp.plano_alvo);
  end if;

  update public.pagamentos_plano
    set status = 'pago', pago_em = now()
    where id = v_pp.id;

  update public.profiles
    set plano = v_pp.plano_alvo,
        plano_atualizado_em = now()
    where id = v_pp.user_id;

  return json_build_object('ok', true, 'user_id', v_pp.user_id, 'plano', v_pp.plano_alvo);
end;
$$;

revoke all on function public.fn_pagamento_plano_confirmar(text) from public;
grant execute on function public.fn_pagamento_plano_confirmar(text) to service_role;
