-- RF39–RF46: Pagamentos por etapa (Pix sandbox), comissão, retenção, carteira do prestador
-- RN18: pagamento exclusivo pela plataforma (fluxo via tabela pagamentos + RPCs)
-- RN23/RF45: retenção em disputa
-- RN24/RF44: saldo da carteira só via transações internas (sem insert direto em wallets)

-- ============================================================
-- 1) Config global (comissão)
-- ============================================================
create table if not exists public.config_financeiro (
  id smallint primary key default 1 check (id = 1),
  comissao_percentual numeric(5,2) not null default 10.00,
  updated_at timestamptz default now()
);

insert into public.config_financeiro (id, comissao_percentual) values (1, 10.00)
on conflict (id) do nothing;

alter table public.config_financeiro enable row level security;

drop policy if exists "config_financeiro_select_auth" on public.config_financeiro;
create policy "config_financeiro_select_auth" on public.config_financeiro
  for select to authenticated using (true);

-- ============================================================
-- 2) Valor total do serviço na solicitação + valor por etapa
-- ============================================================
alter table public.solicitacoes
  add column if not exists valor_total_servico numeric(10,2);

comment on column public.solicitacoes.valor_total_servico is 'Valor total acordado; dividido nas etapas (vistoria, orçamento, execução).';

alter table public.etapas_atendimento
  add column if not exists valor_acordado numeric(10,2);

comment on column public.etapas_atendimento.valor_acordado is 'Parte desta etapa após distribuição do valor_total_servico.';

-- Distribui valor_total_servico em até 3 etapas (diferença de arredondamento na última)
create or replace function public.distribuir_valor_etapas(p_solicitacao_id uuid, p_total numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_each numeric(10,2);
  v_sum_first numeric(10,2);
  r record;
  v_idx int := 0;
begin
  if p_total is null or p_total <= 0 then
    update public.etapas_atendimento set valor_acordado = null where solicitacao_id = p_solicitacao_id;
    return;
  end if;

  select count(*) into v_count from public.etapas_atendimento where solicitacao_id = p_solicitacao_id;
  if v_count = 0 then return; end if;

  v_each := round(p_total / v_count, 2);
  v_sum_first := v_each * (v_count - 1);
  for r in (
    select id from public.etapas_atendimento
    where solicitacao_id = p_solicitacao_id
    order by sequencia asc
  ) loop
    v_idx := v_idx + 1;
    if v_idx < v_count then
      update public.etapas_atendimento set valor_acordado = v_each, updated_at = now() where id = r.id;
    else
      update public.etapas_atendimento
        set valor_acordado = round(p_total - v_sum_first, 2), updated_at = now()
      where id = r.id;
    end if;
  end loop;
end;
$$;

create or replace function public.trg_solicitacao_distribuir_valor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.valor_total_servico is distinct from old.valor_total_servico then
    perform public.distribuir_valor_etapas(new.id, new.valor_total_servico);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitacao_distribuir_valor on public.solicitacoes;
create trigger trg_solicitacao_distribuir_valor
  after update of valor_total_servico on public.solicitacoes
  for each row
  when (new.valor_total_servico is distinct from old.valor_total_servico)
  execute function public.trg_solicitacao_distribuir_valor();

-- ============================================================
-- 3) Pagamentos por etapa (Pix)
-- ============================================================
create table if not exists public.pagamentos (
  id uuid default gen_random_uuid() primary key,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  etapa_id uuid not null references public.etapas_atendimento(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  profissional_id uuid not null references public.profiles(id) on delete cascade,
  valor_bruto numeric(10,2) not null check (valor_bruto > 0),
  comissao_percentual numeric(5,2) not null,
  valor_comissao numeric(10,2) not null check (valor_comissao >= 0),
  valor_liquido_prestador numeric(10,2) not null check (valor_liquido_prestador >= 0),
  metodo text not null default 'pix' check (metodo = 'pix'),
  status text not null default 'aguardando_pix' check (status in (
    'aguardando_pix', 'pago_retido', 'liberado', 'em_disputa', 'cancelado'
  )),
  pix_copia_e_cola text,
  pix_txid text,
  dispute_motivo text,
  liberado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pagamentos_solicitacao on public.pagamentos (solicitacao_id);
create index if not exists idx_pagamentos_etapa on public.pagamentos (etapa_id);

create unique index if not exists ux_pagamento_etapa_em_aberto
  on public.pagamentos (etapa_id)
  where status in ('aguardando_pix', 'pago_retido', 'em_disputa');

alter table public.pagamentos enable row level security;

drop policy if exists "pagamentos_select_participantes" on public.pagamentos;
create policy "pagamentos_select_participantes" on public.pagamentos
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

-- RF44: sem insert/update direto em pagamentos pelo cliente — apenas RPC security definer

-- ============================================================
-- 4) Funções financeiras (SECURITY DEFINER)
-- ============================================================

create or replace function public.fn_financeiro_definir_valor_total(
  p_solicitacao_id uuid,
  p_valor numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solic record;
begin
  if p_valor is not null and p_valor <= 0 then
    return json_build_object('ok', false, 'erro', 'valor_invalido');
  end if;

  select * into v_solic from public.solicitacoes where id = p_solicitacao_id;
  if not found then
    return json_build_object('ok', false, 'erro', 'solicitacao_nao_encontrada');
  end if;

  if v_solic.cliente_id <> auth.uid() and v_solic.profissional_id <> auth.uid() then
    return json_build_object('ok', false, 'erro', 'nao_autorizado');
  end if;

  if v_solic.status not in ('aceita', 'em_andamento') then
    return json_build_object('ok', false, 'erro', 'status_nao_permite');
  end if;

  update public.solicitacoes
    set valor_total_servico = p_valor, updated_at = now()
  where id = p_solicitacao_id;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_financeiro_criar_pagamento_pix(p_etapa_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa record;
  v_solic record;
  v_cfg numeric(5,2);
  v_comissao numeric(10,2);
  v_liquido numeric(10,2);
  v_bruto numeric(10,2);
  v_pix text;
  v_txid text;
  v_id uuid;
begin
  select * into v_etapa from public.etapas_atendimento where id = p_etapa_id for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'etapa_invalida');
  end if;

  select * into v_solic from public.solicitacoes where id = v_etapa.solicitacao_id;
  if v_solic.cliente_id <> auth.uid() then
    return json_build_object('ok', false, 'erro', 'apenas_cliente');
  end if;

  if v_etapa.status not in ('agendada', 'em_progresso', 'concluida') then
    return json_build_object('ok', false, 'erro', 'etapa_nao_pagavel');
  end if;

  v_bruto := coalesce(v_etapa.valor_acordado, 0);
  if v_bruto <= 0 then
    return json_build_object('ok', false, 'erro', 'valor_etapa_nao_definido');
  end if;

  if exists (
    select 1 from public.pagamentos
    where etapa_id = p_etapa_id and status in ('aguardando_pix', 'pago_retido', 'em_disputa')
  ) then
    return json_build_object('ok', false, 'erro', 'ja_existe_pagamento');
  end if;

  select comissao_percentual into v_cfg from public.config_financeiro where id = 1;
  v_comissao := round(v_bruto * coalesce(v_cfg, 10) / 100.0, 2);
  v_liquido := round(v_bruto - v_comissao, 2);
  if v_liquido < 0 then v_liquido := 0; end if;

  v_txid := 'SANDBOX-' || encode(gen_random_bytes(8), 'hex');
  v_pix := '00020126580014BR.GOV.BCB.PIX0136' || v_txid
    || '5204000053039865802BR5920MaoCerta Pix Demo6009SAO PAULO62070503***6304'
    || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  insert into public.pagamentos (
    solicitacao_id, etapa_id, cliente_id, profissional_id,
    valor_bruto, comissao_percentual, valor_comissao, valor_liquido_prestador,
    metodo, status, pix_copia_e_cola, pix_txid
  ) values (
    v_solic.id, p_etapa_id, v_solic.cliente_id, v_solic.profissional_id,
    v_bruto, coalesce(v_cfg, 10), v_comissao, v_liquido,
    'pix', 'aguardando_pix', v_pix, v_txid
  )
  returning id into v_id;

  return json_build_object(
    'ok', true,
    'pagamento_id', v_id,
    'pix_copia_e_cola', v_pix,
    'valor_bruto', v_bruto,
    'valor_comissao', v_comissao,
    'valor_liquido_prestador', v_liquido,
    'comissao_percentual', coalesce(v_cfg, 10)
  );
end;
$$;

create or replace function public.fn_financeiro_confirmar_pix_sandbox(p_pagamento_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  select * into v_p from public.pagamentos where id = p_pagamento_id for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
  end if;

  if v_p.cliente_id <> auth.uid() then
    return json_build_object('ok', false, 'erro', 'nao_autorizado');
  end if;

  if v_p.status <> 'aguardando_pix' then
    return json_build_object('ok', false, 'erro', 'status_invalido');
  end if;

  update public.pagamentos
    set status = 'pago_retido', updated_at = now()
  where id = p_pagamento_id;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_financeiro_liberar_credito_etapa(p_etapa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa record;
  v_p record;
begin
  select * into v_etapa from public.etapas_atendimento where id = p_etapa_id;
  if not found then return; end if;

  if v_etapa.status <> 'concluida' or not v_etapa.cliente_confirmou or not v_etapa.profissional_confirmou then
    return;
  end if;

  select * into v_p from public.pagamentos
  where etapa_id = p_etapa_id and status = 'pago_retido'
  order by created_at desc limit 1 for update;
  if not found then return; end if;

  update public.pagamentos
    set status = 'liberado', liberado_em = now(), updated_at = now()
  where id = v_p.id;

  insert into public.wallets (user_id, saldo)
  values (v_p.profissional_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
    set saldo = saldo + v_p.valor_liquido_prestador, updated_at = now()
  where user_id = v_p.profissional_id;

  insert into public.wallet_transactions (user_id, tipo, valor, descricao, referencia)
  values (
    v_p.profissional_id,
    'credito',
    v_p.valor_liquido_prestador,
    'Repasse etapa (Pix) após confirmação mútua — comissão plataforma R$ ' || v_p.valor_comissao::text,
    v_p.id::text
  );
end;
$$;

create or replace function public.trg_etapa_liberar_financeiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluida' and new.cliente_confirmou and new.profissional_confirmou then
    perform public.fn_financeiro_liberar_credito_etapa(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_etapa_liberar_financeiro on public.etapas_atendimento;
create trigger trg_etapa_liberar_financeiro
  after update of status, cliente_confirmou, profissional_confirmou on public.etapas_atendimento
  for each row
  execute function public.trg_etapa_liberar_financeiro();

create or replace function public.fn_financeiro_abrir_disputa(p_etapa_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solic record;
  v_n int;
begin
  select s.* into v_solic
  from public.etapas_atendimento e
  join public.solicitacoes s on s.id = e.solicitacao_id
  where e.id = p_etapa_id;
  if not found then
    return json_build_object('ok', false, 'erro', 'etapa_invalida');
  end if;

  if v_solic.cliente_id is distinct from auth.uid() then
    return json_build_object('ok', false, 'erro', 'apenas_cliente');
  end if;

  update public.pagamentos
    set status = 'em_disputa',
        dispute_motivo = nullif(trim(p_motivo), ''),
        updated_at = now()
  where etapa_id = p_etapa_id and status = 'pago_retido';

  get diagnostics v_n = row_count;
  if v_n = 0 then
    return json_build_object('ok', false, 'erro', 'sem_retencao_para_disputa');
  end if;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_financeiro_resolver_disputa_admin(p_etapa_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.is_administrator() then
    return json_build_object('ok', false, 'erro', 'admin_apenas');
  end if;

  update public.pagamentos
    set status = 'pago_retido', updated_at = now()
  where etapa_id = p_etapa_id and status = 'em_disputa';

  get diagnostics v_n = row_count;
  if v_n = 0 then
    return json_build_object('ok', false, 'erro', 'sem_disputa');
  end if;

  perform public.fn_financeiro_liberar_credito_etapa(p_etapa_id);

  return json_build_object('ok', true);
end;
$$;

-- Grants
revoke all on function public.fn_financeiro_definir_valor_total(uuid, numeric) from public;
revoke all on function public.fn_financeiro_criar_pagamento_pix(uuid) from public;
revoke all on function public.fn_financeiro_confirmar_pix_sandbox(uuid) from public;
revoke all on function public.fn_financeiro_liberar_credito_etapa(uuid) from public;
revoke all on function public.fn_financeiro_abrir_disputa(uuid, text) from public;
revoke all on function public.fn_financeiro_resolver_disputa_admin(uuid) from public;
revoke all on function public.distribuir_valor_etapas(uuid, numeric) from public;

grant execute on function public.fn_financeiro_definir_valor_total(uuid, numeric) to authenticated;
grant execute on function public.fn_financeiro_criar_pagamento_pix(uuid) to authenticated;
grant execute on function public.fn_financeiro_confirmar_pix_sandbox(uuid) to authenticated;
grant execute on function public.fn_financeiro_abrir_disputa(uuid, text) to authenticated;
grant execute on function public.fn_financeiro_resolver_disputa_admin(uuid) to authenticated;

-- Liberar e distribuir só internos (trigger / admin)
revoke all on function public.fn_financeiro_liberar_credito_etapa(uuid) from public;
revoke all on function public.distribuir_valor_etapas(uuid, numeric) from public;

comment on table public.pagamentos is 'RF39–RF43: pagamento Pix por etapa; comissão; repasse à carteira do prestador após confirmação mútua.';
comment on function public.fn_financeiro_abrir_disputa is 'RF45: retém repasse (status em_disputa) até análise.';
