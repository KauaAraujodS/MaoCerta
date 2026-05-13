-- Produção “perfeita”: escrow legal + 48h disputa/liberação, idempotência webhook, auditoria encadeada,
-- limites/rate limit, bloqueio de carteira, snapshots, fiscal stub, reembolso, futuro payment_methods/currency,
-- saque agendado, antecipação (placeholder), moderação de avaliações, painel admin.

-- ---------------------------------------------------------------------------
-- 1) Colunas em etapas / pagamentos / config
-- ---------------------------------------------------------------------------
alter table public.etapas_atendimento add column if not exists conclusao_mutua_em timestamptz;

alter table public.pagamentos add column if not exists currency text not null default 'BRL';
alter table public.pagamentos add column if not exists payment_method_id smallint;
alter table public.pagamentos add column if not exists escrow_terms_version text;
alter table public.pagamentos add column if not exists escrow_accepted_at timestamptz;
alter table public.pagamentos add column if not exists client_ip text;
alter table public.pagamentos add column if not exists client_user_agent text;
alter table public.pagamentos add column if not exists device_fingerprint text;
alter table public.pagamentos add column if not exists liberacao_agendada_em timestamptz;

alter table public.config_financeiro add column if not exists valor_max_etapa_sem_revisao numeric(12,2) not null default 15000.00;
alter table public.config_financeiro add column if not exists limite_geracao_pix_por_minuto int not null default 10;
alter table public.config_financeiro add column if not exists dias_reembolso_pos_liberacao int not null default 7;
alter table public.config_financeiro add column if not exists escrow_terms_version_atual text not null default 'escrow-v1-2026';

-- ---------------------------------------------------------------------------
-- 2) Métodos de pagamento (futuro) + consentimento débito automático (estrutura)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id smallserial primary key,
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true
);

insert into public.payment_methods (codigo, nome, ativo) values
  ('pix', 'Pix', true),
  ('cartao', 'Cartão (futuro)', false),
  ('boleto', 'Boleto (futuro)', false),
  ('carteira_cliente', 'Saldo carteira cliente (futuro)', false)
on conflict (codigo) do nothing;

alter table public.pagamentos
  add column if not exists payment_method_id smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'pagamentos' and c.conname = 'pagamentos_payment_method_fk'
  ) then
    alter table public.pagamentos
      add constraint pagamentos_payment_method_fk
      foreign key (payment_method_id) references public.payment_methods(id);
  end if;
end$$;

alter table public.payment_methods enable row level security;
drop policy if exists "payment_methods_select_all" on public.payment_methods;
create policy "payment_methods_select_all" on public.payment_methods for select to authenticated using (true);

create table if not exists public.payment_autopay_consents (
  id uuid default gen_random_uuid() primary key,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  ativo boolean not null default true,
  versao_termos text not null default 'autopay-v0',
  created_at timestamptz default now()
);

create unique index if not exists ux_autopay_solicitacao on public.payment_autopay_consents (solicitacao_id);

alter table public.payment_autopay_consents enable row level security;
drop policy if exists "autopay_select_own" on public.payment_autopay_consents;
create policy "autopay_select_own" on public.payment_autopay_consents
  for select to authenticated using (cliente_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Antecipação (placeholder premium)
-- ---------------------------------------------------------------------------
create table if not exists public.anticipations (
  id uuid default gen_random_uuid() primary key,
  prestador_id uuid not null references public.profiles(id) on delete cascade,
  valor_solicitado numeric(12,2) not null,
  taxa_percentual numeric(5,2) not null default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'pago', 'cancelado')),
  created_at timestamptz default now()
);

alter table public.anticipations enable row level security;
drop policy if exists "anticipations_select_own" on public.anticipations;
create policy "anticipations_select_own" on public.anticipations
  for select to authenticated using (prestador_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Saque agendado
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  valor_minimo numeric(10,2) not null default 50,
  metodo text not null default 'pix',
  ativo boolean not null default true,
  created_at timestamptz default now()
);

alter table public.scheduled_withdrawals enable row level security;
drop policy if exists "scheduled_wd_select_own" on public.scheduled_withdrawals;
create policy "scheduled_wd_select_own" on public.scheduled_withdrawals
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "scheduled_wd_mutate_own" on public.scheduled_withdrawals;
create policy "scheduled_wd_mutate_own" on public.scheduled_withdrawals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) Bloqueio de carteira (supervisor)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_locks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  motivo text not null,
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_wallet_locks_user_active on public.wallet_locks (user_id) where released_at is null;

alter table public.wallet_locks enable row level security;
drop policy if exists "wallet_locks_select" on public.wallet_locks;
create policy "wallet_locks_select" on public.wallet_locks
  for select to authenticated using (user_id = auth.uid() or public.is_administrator());

-- ---------------------------------------------------------------------------
-- 6) Auditoria encadeada (append-only lógico)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_chain (
  id bigserial primary key,
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  acao text not null,
  payload jsonb not null default '{}'::jsonb,
  prev_hash text,
  row_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_chain_entity on public.audit_chain (entity_type, entity_id, created_at desc);

alter table public.audit_chain enable row level security;
drop policy if exists "audit_chain_admin" on public.audit_chain;
create policy "audit_chain_admin" on public.audit_chain
  for select to authenticated using (public.is_administrator());

create or replace function public.fn_audit_chain_append(
  p_entity_type text,
  p_entity_id uuid,
  p_actor uuid,
  p_acao text,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_row text;
begin
  select row_hash into v_prev
  from public.audit_chain
  order by id desc limit 1;

  v_row := encode(
    digest(
      coalesce(v_prev, 'GENESIS')
        || '|' || p_entity_type || '|' || p_entity_id::text || '|' || coalesce(p_actor::text, '')
        || '|' || p_acao || '|' || coalesce(p_payload::text, ''),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_chain (entity_type, entity_id, actor_id, acao, payload, prev_hash, row_hash)
  values (p_entity_type, p_entity_id, p_actor, p_acao, coalesce(p_payload, '{}'::jsonb), v_prev, v_row);
end;
$$;

revoke all on function public.fn_audit_chain_append(text, uuid, uuid, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 7) Idempotência webhook + DLQ
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_idempotency_keys (
  idempotency_key text primary key,
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  resultado jsonb,
  created_at timestamptz default now()
);

create table if not exists public.webhook_dead_letter (
  id uuid default gen_random_uuid() primary key,
  idempotency_key text,
  payload jsonb not null,
  erro text,
  tentativas int not null default 0,
  created_at timestamptz default now()
);

alter table public.webhook_dead_letter enable row level security;
drop policy if exists "webhook_dlq_admin" on public.webhook_dead_letter;
create policy "webhook_dlq_admin" on public.webhook_dead_letter
  for select to authenticated using (public.is_administrator());

-- ---------------------------------------------------------------------------
-- 8) Snapshots de saldo
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_balance_snapshots (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  saldo_disponivel numeric(12,2) not null,
  saldo_bloqueado numeric(12,2) not null,
  snapshot_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz default now(),
  unique (user_id, snapshot_date)
);

create or replace function public.fn_financeiro_snapshot_saldos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  r record;
  v_d date := (timezone('utc', now()))::date;
begin
  for r in select user_id, saldo, saldo_bloqueado from public.wallets loop
    insert into public.wallet_balance_snapshots (user_id, saldo_disponivel, saldo_bloqueado, snapshot_date)
    values (r.user_id, r.saldo, r.saldo_bloqueado, v_d)
    on conflict (user_id, snapshot_date)
    do update set saldo_disponivel = excluded.saldo_disponivel, saldo_bloqueado = excluded.saldo_bloqueado, created_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.fn_financeiro_snapshot_saldos() from public;
grant execute on function public.fn_financeiro_snapshot_saldos() to service_role;

-- ---------------------------------------------------------------------------
-- 9) Recibo cliente + reembolso (estrutura)
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_recibos (
  id uuid default gen_random_uuid() primary key,
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  valor_total numeric(12,2) not null,
  comissao_plataforma numeric(12,2) not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create unique index if not exists ux_fiscal_recibos_pagamento_id on public.fiscal_recibos (pagamento_id);

create table if not exists public.reembolso_pedidos (
  id uuid default gen_random_uuid() primary key,
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  solicitante_id uuid not null references public.profiles(id) on delete cascade,
  motivo text,
  status text not null default 'aberto' check (status in ('aberto', 'em_mediacao', 'aprovado', 'negado')),
  prazo_mediacao_ate timestamptz,
  created_at timestamptz default now()
);

alter table public.fiscal_recibos enable row level security;
drop policy if exists "fiscal_recibo_select" on public.fiscal_recibos;
create policy "fiscal_recibo_select" on public.fiscal_recibos
  for select to authenticated using (cliente_id = auth.uid() or public.is_administrator());

alter table public.reembolso_pedidos enable row level security;
drop policy if exists "reembolso_select" on public.reembolso_pedidos;
create policy "reembolso_select" on public.reembolso_pedidos
  for select to authenticated using (solicitante_id = auth.uid() or public.is_administrator());

-- ---------------------------------------------------------------------------
-- 10) Rate limit geração Pix
-- ---------------------------------------------------------------------------
create table if not exists public.pix_generation_ratelimit (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_pix_rl_user_time on public.pix_generation_ratelimit (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 11) Moderação avaliações
-- ---------------------------------------------------------------------------
alter table public.avaliacoes add column if not exists moderacao_oculto boolean not null default false;
alter table public.avaliacoes add column if not exists moderacao_motivo text;
alter table public.avaliacoes add column if not exists client_ip text;
alter table public.avaliacoes add column if not exists device_fingerprint text;

-- Disputas: no máximo um registro por etapa (regra na RPC; sem índice único para evitar falha se já houver histórico duplicado)

-- ---------------------------------------------------------------------------
-- 12) View conciliação admin
-- ---------------------------------------------------------------------------
create or replace view public.vw_admin_conciliacao_financeira as
select
  count(*) filter (where status = 'aguardando_pagamento') as qtd_aguardando,
  count(*) filter (where status = 'em_escrow') as qtd_escrow,
  count(*) filter (where status = 'liberado') as qtd_liberado,
  count(*) filter (where status = 'contestado') as qtd_contestado,
  coalesce(sum(valor_bruto) filter (where pago_em is not null), 0) as volume_bruto_confirmado,
  coalesce(sum(valor_comissao) filter (where pago_em is not null), 0) as total_comissoes
from public.pagamentos;

alter view public.vw_admin_conciliacao_financeira set (security_invoker = true);

revoke all on public.vw_admin_conciliacao_financeira from public;
grant select on public.vw_admin_conciliacao_financeira to authenticated;

-- ---------------------------------------------------------------------------
-- 14) Admin override saldo + ocultar avaliação
-- ---------------------------------------------------------------------------
create or replace function public.fn_admin_carteira_ajuste(
  p_user_id uuid,
  p_delta numeric,
  p_justificativa text
) returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    return json_build_object('ok', false, 'erro', 'admin_apenas');
  end if;
  if p_justificativa is null or length(trim(p_justificativa)) < 10 then
    return json_build_object('ok', false, 'erro', 'justificativa_curta');
  end if;

  insert into public.wallets (user_id, saldo, saldo_bloqueado)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set saldo = saldo + p_delta,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.wallet_transactions (user_id, tipo, valor, descricao, referencia)
  values (
    p_user_id,
    case when p_delta >= 0 then 'credito' else 'debito' end,
    abs(p_delta),
    'Ajuste admin: ' || trim(p_justificativa),
    'admin_adjust'
  );

  perform public.fn_audit_chain_append('wallet', p_user_id, auth.uid(), 'admin_ajuste_saldo',
    jsonb_build_object('delta', p_delta, 'justificativa', p_justificativa));

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_admin_ocultar_avaliacao(p_avaliacao_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    return json_build_object('ok', false, 'erro', 'admin_apenas');
  end if;
  update public.avaliacoes
  set moderacao_oculto = true, moderacao_motivo = nullif(trim(p_motivo), '')
  where id = p_avaliacao_id;
  perform public.fn_audit_chain_append('avaliacao', p_avaliacao_id, auth.uid(), 'ocultar', jsonb_build_object('motivo', p_motivo));
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.fn_admin_carteira_ajuste(uuid, numeric, text) from public;
revoke all on function public.fn_admin_ocultar_avaliacao(uuid, text) from public;
grant execute on function public.fn_admin_carteira_ajuste(uuid, numeric, text) to authenticated;
grant execute on function public.fn_admin_ocultar_avaliacao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15) Processar liberações agendadas (48h pós confirmação mútua)
-- ---------------------------------------------------------------------------
create or replace function public.fn_financeiro_processar_liberacoes_agendadas()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    select p.etapa_id
    from public.pagamentos p
    where p.status = 'em_escrow'
      and p.liberacao_agendada_em is not null
      and p.liberacao_agendada_em <= now()
  loop
    perform public.fn_financeiro_liberar_credito_etapa(r.etapa_id);
    v_n := v_n + 1;
  end loop;
  return json_build_object('ok', true, 'processados', v_n);
end;
$$;

revoke all on function public.fn_financeiro_processar_liberacoes_agendadas() from public;
grant execute on function public.fn_financeiro_processar_liberacoes_agendadas() to service_role;
grant execute on function public.fn_financeiro_processar_liberacoes_agendadas() to authenticated;

-- ---------------------------------------------------------------------------
-- 16) Substituir trigger: agendar liberação em 48h (não liberar na hora)
-- ---------------------------------------------------------------------------
create or replace function public.trg_etapa_liberar_financeiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_t timestamptz;
begin
  if new.status = 'concluida' and new.cliente_confirmou and new.profissional_confirmou then
    v_t := greatest(
      coalesce(new.data_confirmacao_cliente, now()),
      coalesce(new.data_confirmacao_profissional, now())
    );

    update public.etapas_atendimento
    set conclusao_mutua_em = coalesce(conclusao_mutua_em, v_t)
    where id = new.id;

    select * into v_p from public.pagamentos
    where etapa_id = new.id and status = 'em_escrow'
    order by created_at desc limit 1 for update;

    if found then
      update public.pagamentos
      set liberacao_agendada_em = coalesce(liberacao_agendada_em, v_t + interval '48 hours'),
          updated_at = now()
      where id = v_p.id;

      perform public.fn_notificar_financeiro(
        (select profissional_id from public.solicitacoes where id = new.solicitacao_id limit 1),
        'liberacao_agendada',
        'Liberação programada',
        'Em até 48 horas o valor será liberado se não houver contestação.',
        jsonb_build_object('pagamento_id', v_p.id)
      );
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 17) Liberar: idempotente + recibo fiscal stub
-- ---------------------------------------------------------------------------
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
  where etapa_id = p_etapa_id and status = 'em_escrow'
  order by created_at desc limit 1 for update;
  if not found then return; end if;

  if v_p.status = 'liberado' then
    return;
  end if;

  update public.pagamentos
  set status = 'liberado', liberado_em = now(), updated_at = now()
  where id = v_p.id;

  update public.wallets
  set
    saldo_bloqueado = greatest(0, saldo_bloqueado - v_p.valor_liquido_prestador),
    saldo = saldo + v_p.valor_liquido_prestador,
    updated_at = now()
  where user_id = v_p.profissional_id;

  insert into public.wallet_transactions (
    user_id, tipo, valor, descricao, referencia, etapa_id, bloqueado_ate
  ) values (
    v_p.profissional_id,
    'liberacao_escrow',
    v_p.valor_liquido_prestador,
    'Liberação após janela de contestação / confirmação',
    v_p.id::text,
    v_p.etapa_id,
    now()
  );

  insert into public.fiscal_recibos (pagamento_id, cliente_id, valor_total, comissao_plataforma, payload_json)
  values (
    v_p.id,
    v_p.cliente_id,
    v_p.valor_bruto,
    v_p.valor_comissao,
    jsonb_build_object('moeda', v_p.currency, 'etapa_id', v_p.etapa_id)
  )
  on conflict (pagamento_id) do nothing;

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'valor_liberado', 'Valor liberado', 'Crédito disponível na carteira.', jsonb_build_object('pagamento_id', v_p.id));
  perform public.fn_notificar_financeiro(v_p.cliente_id, 'pedir_avaliacao', 'Avalie o prestador', 'O pagamento foi liberado. Sua opinião importa.', jsonb_build_object('pagamento_id', v_p.id));

  perform public.fn_audit_chain_append('pagamento', v_p.id, null, 'liberacao_escrow', jsonb_build_object('etapa_id', p_etapa_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 18) Abrir disputa: uma por etapa + janela 48h após confirmação mútua (se já agendada)
-- ---------------------------------------------------------------------------
create or replace function public.fn_financeiro_abrir_disputa(p_etapa_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solic record;
  v_p record;
  v_disp uuid;
  v_e record;
begin
  select * into v_e from public.etapas_atendimento where id = p_etapa_id;
  if not found then
    return json_build_object('ok', false, 'erro', 'etapa_invalida');
  end if;

  select s.* into v_solic from public.solicitacoes s where s.id = v_e.solicitacao_id;
  if v_solic.cliente_id is distinct from auth.uid() then
    return json_build_object('ok', false, 'erro', 'apenas_cliente');
  end if;

  if exists (select 1 from public.disputas where etapa_id = p_etapa_id) then
    return json_build_object('ok', false, 'erro', 'disputa_ja_existe');
  end if;

  select * into v_p from public.pagamentos
  where etapa_id = p_etapa_id and status = 'em_escrow'
  order by created_at desc limit 1 for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'sem_retencao_para_disputa');
  end if;

  if v_p.liberacao_agendada_em is not null and now() > v_p.liberacao_agendada_em then
    return json_build_object('ok', false, 'erro', 'prazo_disputa_expirado');
  end if;

  update public.pagamentos
  set status = 'contestado',
      dispute_motivo = nullif(trim(p_motivo), ''),
      updated_at = now()
  where id = v_p.id;

  insert into public.disputas (
    pagamento_id, etapa_id, solicitacao_id, aberto_por, motivo, status,
    prazo_prestador_ate, prazo_cliente_ate
  ) values (
    v_p.id, p_etapa_id, v_solic.id, auth.uid(), nullif(trim(p_motivo), ''),
    'aguardando_prestador',
    now() + interval '3 days',
    null
  )
  returning id into v_disp;

  perform public.fn_notificar_financeiro(v_solic.profissional_id, 'disputa_aberta', 'Disputa aberta', 'Cliente abriu contestação. Anexe provas no prazo.', jsonb_build_object('disputa_id', v_disp));
  perform public.fn_notificar_financeiro(v_solic.cliente_id, 'disputa_aberta', 'Contestação registrada', 'Acompanhe a disputa no atendimento.', jsonb_build_object('disputa_id', v_disp));
  perform public.fn_audit_chain_append('disputa', v_disp, auth.uid(), 'abrir', jsonb_build_object('etapa_id', p_etapa_id));

  return json_build_object('ok', true, 'disputa_id', v_disp);
end;
$$;

-- ---------------------------------------------------------------------------
-- 19) Criar Pix: aceite obrigatório, rate limit, limite valor, metadados
-- ---------------------------------------------------------------------------
create or replace function public.fn_financeiro_criar_pagamento_pix(
  p_etapa_id uuid,
  p_escrow_terms_accepted boolean default false,
  p_terms_version text default null,
  p_client_ip text default null,
  p_user_agent text default null,
  p_fingerprint text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa record;
  v_solic record;
  v_cfg record;
  v_pct numeric(5,2);
  v_comissao numeric(10,2);
  v_liquido numeric(10,2);
  v_bruto numeric(10,2);
  v_pix text;
  v_txid text;
  v_id uuid;
  v_hash text;
  v_lim int;
  v_cnt int;
  v_pm smallint;
begin
  if p_escrow_terms_accepted is distinct from true then
    return json_build_object('ok', false, 'erro', 'escrow_terms_nao_aceitos');
  end if;

  select * into v_cfg from public.config_financeiro where id = 1;

  select count(*) into v_cnt
  from public.pix_generation_ratelimit
  where user_id = auth.uid() and created_at > now() - interval '1 minute';
  if v_cnt >= coalesce(v_cfg.limite_geracao_pix_por_minuto, 10) then
    return json_build_object('ok', false, 'erro', 'rate_limit_pix');
  end if;

  select * into v_etapa from public.etapas_atendimento where id = p_etapa_id for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'etapa_invalida');
  end if;

  select * into v_solic from public.solicitacoes where id = v_etapa.solicitacao_id;
  if v_solic.cliente_id <> auth.uid() then
    return json_build_object('ok', false, 'erro', 'apenas_cliente');
  end if;

  if v_etapa.status not in ('agendada'::public.status_etapa, 'em_progresso'::public.status_etapa) then
    return json_build_object('ok', false, 'erro', 'etapa_nao_pagavel');
  end if;

  v_bruto := coalesce(v_etapa.valor_acordado, 0);
  if v_bruto <= 0 then
    return json_build_object('ok', false, 'erro', 'valor_etapa_nao_definido');
  end if;

  if v_bruto > coalesce(v_cfg.valor_max_etapa_sem_revisao, 15000) then
    return json_build_object('ok', false, 'erro', 'valor_acima_limite_revisao');
  end if;

  if exists (
    select 1 from public.pagamentos
    where etapa_id = p_etapa_id
      and status in ('aguardando_pagamento', 'pago', 'em_escrow', 'contestado')
  ) then
    return json_build_object('ok', false, 'erro', 'ja_existe_pagamento');
  end if;

  v_pct := public.fn_comissao_percentual_para_solicitacao(v_solic.id);
  v_comissao := round(v_bruto * coalesce(v_pct, 10) / 100.0, 2);
  v_liquido := round(v_bruto - v_comissao, 2);
  if v_liquido < 0 then v_liquido := 0; end if;

  select id into v_pm from public.payment_methods where codigo = 'pix' limit 1;

  v_txid := 'SANDBOX-' || encode(gen_random_bytes(8), 'hex');
  v_pix := '00020126580014BR.GOV.BCB.PIX0136' || v_txid
    || '5204000053039865802BR5920MaoCerta Pix Demo6009SAO PAULO62070503***6304'
    || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  v_hash := encode(digest(v_pix, 'sha256'), 'hex');

  insert into public.pagamentos (
    solicitacao_id, etapa_id, cliente_id, profissional_id,
    valor_bruto, valor_etapa, comissao_percentual, valor_comissao, valor_liquido_prestador,
    metodo, status, pix_copia_e_cola, pix_txid, pix_payload_hash,
    qr_expires_at, dispute_motivo,
    currency, payment_method_id,
    escrow_terms_version, escrow_accepted_at,
    client_ip, client_user_agent, device_fingerprint
  ) values (
    v_solic.id, p_etapa_id, v_solic.cliente_id, v_solic.profissional_id,
    v_bruto, v_bruto, coalesce(v_pct, 10), v_comissao, v_liquido,
    'pix', 'aguardando_pagamento', v_pix, v_txid, v_hash,
    now() + interval '15 minutes', null,
    'BRL', v_pm,
    coalesce(nullif(trim(p_terms_version), ''), v_cfg.escrow_terms_version_atual),
    now(),
    nullif(trim(p_client_ip), ''),
    nullif(trim(p_user_agent), ''),
    nullif(trim(p_fingerprint), '')
  )
  returning id into v_id;

  insert into public.pix_generation_ratelimit (user_id) values (auth.uid());

  perform public.fn_notificar_financeiro(v_solic.profissional_id, 'pix_gerado', 'Pix da etapa gerado', 'Cliente iniciou pagamento.', jsonb_build_object('pagamento_id', v_id));
  perform public.fn_audit_chain_append('pagamento', v_id, auth.uid(), 'criar_pix', jsonb_build_object('etapa_id', p_etapa_id));

  return json_build_object(
    'ok', true,
    'pagamento_id', v_id,
    'pix_copia_e_cola', v_pix,
    'valor_bruto', v_bruto,
    'valor_comissao', v_comissao,
    'valor_liquido_prestador', v_liquido,
    'comissao_percentual', coalesce(v_pct, 10),
    'qr_expires_at', (select qr_expires_at from public.pagamentos where id = v_id),
    'pix_payload_hash', v_hash
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 20) Confirmar sandbox / webhook: idempotência interna
-- ---------------------------------------------------------------------------
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

  if exists (
    select 1 from public.wallet_transactions
    where referencia = v_p.id::text and tipo = 'recebimento_etapa'
  ) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  if v_p.status <> 'aguardando_pagamento' then
    return json_build_object('ok', false, 'erro', 'status_invalido');
  end if;

  update public.pagamentos
  set
    status = 'em_escrow',
    pago_em = now(),
    updated_at = now()
  where id = p_pagamento_id;

  insert into public.wallets (user_id, saldo, saldo_bloqueado)
  values (v_p.profissional_id, 0, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set saldo_bloqueado = saldo_bloqueado + v_p.valor_liquido_prestador,
      updated_at = now()
  where user_id = v_p.profissional_id;

  insert into public.wallet_transactions (
    user_id, tipo, valor, descricao, referencia, etapa_id, bloqueado_ate
  ) values (
    v_p.profissional_id,
    'recebimento_etapa',
    v_p.valor_liquido_prestador,
    'Recebimento etapa (escrow) — bruto R$ ' || v_p.valor_bruto::text || ', comissão R$ ' || v_p.valor_comissao::text,
    v_p.id::text,
    v_p.etapa_id,
    null
  );

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'pagamento_recebido', 'Pagamento confirmado', 'Valor em retenção.', jsonb_build_object('pagamento_id', v_p.id));
  perform public.fn_notificar_financeiro(v_p.cliente_id, 'pagamento_recebido', 'Pagamento registrado', 'Pix confirmado.', jsonb_build_object('pagamento_id', v_p.id));
  perform public.fn_audit_chain_append('pagamento', v_p.id, auth.uid(), 'confirmar_pix_sandbox', '{}'::jsonb);

  return json_build_object('ok', true);
end;
$$;

drop function if exists public.fn_financeiro_webhook_confirmar_pix(text, text);
drop function if exists public.fn_financeiro_webhook_confirmar_pix(text, text, text);

create or replace function public.fn_financeiro_webhook_confirmar_pix(
  p_pix_txid text,
  p_webhook_ref text,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_key text := coalesce(nullif(trim(p_idempotency_key), ''), encode(digest(coalesce(p_webhook_ref, '') || '|' || p_pix_txid, 'sha256'), 'hex'));
  v_idem record;
begin
  insert into public.webhook_idempotency_keys (idempotency_key, pagamento_id, resultado)
  values (v_key, null, '{}'::jsonb)
  on conflict (idempotency_key) do nothing;

  select * into v_idem from public.webhook_idempotency_keys where idempotency_key = v_key for update;
  if v_idem.pagamento_id is not null then
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  select * into v_p from public.pagamentos
  where pix_txid = p_pix_txid and status = 'aguardando_pagamento'
  order by created_at desc limit 1 for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
  end if;

  if exists (
    select 1 from public.wallet_transactions
    where referencia = v_p.id::text and tipo = 'recebimento_etapa'
  ) then
    update public.webhook_idempotency_keys set pagamento_id = v_p.id, resultado = jsonb_build_object('duplicate', true)
    where idempotency_key = v_key;
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  update public.pagamentos
  set status = 'em_escrow', pago_em = now(), webhook_ref = p_webhook_ref, updated_at = now()
  where id = v_p.id;

  insert into public.wallets (user_id, saldo, saldo_bloqueado)
  values (v_p.profissional_id, 0, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set saldo_bloqueado = saldo_bloqueado + v_p.valor_liquido_prestador,
      updated_at = now()
  where user_id = v_p.profissional_id;

  insert into public.wallet_transactions (
    user_id, tipo, valor, descricao, referencia, etapa_id, bloqueado_ate
  ) values (
    v_p.profissional_id,
    'recebimento_etapa',
    v_p.valor_liquido_prestador,
    'Recebimento etapa (webhook)',
    v_p.id::text,
    v_p.etapa_id,
    null
  );

  update public.webhook_idempotency_keys
  set pagamento_id = v_p.id, resultado = jsonb_build_object('ok', true, 'pagamento_id', v_p.id)
  where idempotency_key = v_key;

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'pagamento_recebido', 'Pix confirmado (webhook)', 'Valor retido.', jsonb_build_object('pagamento_id', v_p.id));

  return json_build_object('ok', true, 'pagamento_id', v_p.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 21) Saque: bloqueio + “risco” (stub)
-- ---------------------------------------------------------------------------
create or replace function public.fn_wallet_solicitar_saque(p_valor numeric, p_metodo text, p_observacao text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric;
  v_saldo numeric;
  v_disp numeric;
  v_saque_id uuid;
  v_wid uuid;
  v_tipo text;
  v_risco text := 'ok';
begin
  if exists (select 1 from public.wallet_locks where user_id = v_uid and released_at is null) then
    return json_build_object('ok', false, 'erro', 'carteira_bloqueada');
  end if;

  select tipo into v_tipo from public.profiles where id = v_uid;
  if v_tipo is distinct from 'profissional'::tipo_usuario then
    insert into public.audit_financeiro (actor_id, acao, detalhe)
    values (v_uid, 'saque_negado_nao_prestador', jsonb_build_object('valor', p_valor));
    return json_build_object('ok', false, 'erro', 'apenas_prestador');
  end if;

  if exists (select 1 from public.disputas d join public.solicitacoes s on s.id = d.solicitacao_id where s.profissional_id = v_uid and d.status in ('aberta','aguardando_prestador','aguardando_cliente','em_analise') limit 1) then
    v_risco := 'disputas_abertas';
  end if;

  select valor_minimo_saque into v_min from public.config_financeiro where id = 1;
  if p_valor is null or p_valor < coalesce(v_min, 50) then
    return json_build_object('ok', false, 'erro', 'abaixo_minimo', 'valor_minimo', coalesce(v_min, 50));
  end if;

  select saldo into v_saldo from public.wallets where user_id = v_uid for update;
  v_disp := coalesce(v_saldo, 0);

  if p_valor > v_disp then
    return json_build_object('ok', false, 'erro', 'saldo_insuficiente');
  end if;

  insert into public.saques (user_id, valor, status, observacao, metodo, anti_fraude_status)
  values (v_uid, p_valor, 'pendente', nullif(trim(p_observacao), ''), coalesce(nullif(trim(p_metodo), ''), 'pix'),
    case when v_risco = 'ok' then 'pendente' else 'pendente' end)
  returning id into v_saque_id;

  insert into public.wallet_withdrawals (user_id, saque_id, valor, metodo, status, observacao, valor_minimo_aplicado)
  values (v_uid, v_saque_id, p_valor, coalesce(nullif(trim(p_metodo), ''), 'pix'), 'em_analise', nullif(trim(p_observacao), ''), coalesce(v_min, 50))
  returning id into v_wid;

  perform public.fn_notificar_financeiro(v_uid, 'saque_solicitado', 'Saque solicitado', 'Em análise.', jsonb_build_object('saque_id', v_saque_id, 'risco', v_risco));
  perform public.fn_audit_chain_append('wallet', v_uid, v_uid, 'solicitar_saque', jsonb_build_object('valor', p_valor, 'risco', v_risco));

  return json_build_object('ok', true, 'saque_id', v_saque_id, 'wallet_withdrawal_id', v_wid);
end;
$$;

-- ---------------------------------------------------------------------------
-- 22) Avaliação: anti auto-avaliação + IP opcional
-- ---------------------------------------------------------------------------
create or replace function public.fn_avaliacao_criar_pos_etapa(
  p_solicitacao_id uuid,
  p_nota_qualidade int,
  p_nota_prazo int,
  p_nota_comunicacao int,
  p_comentario text,
  p_client_ip text default null,
  p_fingerprint text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
  v_cli uuid := auth.uid();
  v_media int;
  v_ultima uuid;
  v_pag_ok boolean;
begin
  select * into v_sol from public.solicitacoes where id = p_solicitacao_id;
  if not found then return json_build_object('ok', false, 'erro', 'atendimento_invalido'); end if;
  if v_sol.cliente_id <> v_cli then return json_build_object('ok', false, 'erro', 'apenas_cliente'); end if;
  if v_sol.cliente_id = v_sol.profissional_id then
    return json_build_object('ok', false, 'erro', 'autoavaliacao');
  end if;

  select id into v_ultima from public.etapas_atendimento
  where solicitacao_id = p_solicitacao_id
  order by sequencia desc limit 1;

  select exists (
    select 1 from public.pagamentos p
    join public.etapas_atendimento e on e.id = p.etapa_id
    where e.solicitacao_id = p_solicitacao_id
      and e.id = v_ultima
      and p.status = 'liberado'
  ) into v_pag_ok;

  if not v_pag_ok then
    return json_build_object('ok', false, 'erro', 'etapa_final_nao_liberada');
  end if;

  if exists (select 1 from public.avaliacoes where atendimento_id = p_solicitacao_id and avaliador_id = v_cli) then
    return json_build_object('ok', false, 'erro', 'ja_avaliado');
  end if;

  if p_nota_qualidade not between 1 and 5 or p_nota_prazo not between 1 and 5 or p_nota_comunicacao not between 1 and 5 then
    return json_build_object('ok', false, 'erro', 'notas_invalidas');
  end if;

  v_media := round((p_nota_qualidade + p_nota_prazo + p_nota_comunicacao) / 3.0);

  insert into public.avaliacoes (
    atendimento_id, avaliador_id, avaliado_id, nota,
    nota_qualidade, nota_prazo, nota_comunicacao, comentario, bloqueio_edicao_ate,
    client_ip, device_fingerprint
  ) values (
    p_solicitacao_id, v_cli, v_sol.profissional_id, v_media,
    p_nota_qualidade, p_nota_prazo, p_nota_comunicacao, nullif(trim(p_comentario), ''),
    now() + interval '7 days',
    nullif(trim(p_client_ip), ''),
    nullif(trim(p_fingerprint), '')
  );

  perform public.fn_atualizar_score_prestador(v_sol.profissional_id);
  perform public.fn_notificar_financeiro(v_sol.profissional_id, 'nova_avaliacao', 'Nova avaliação', coalesce(nullif(trim(p_comentario), ''), 'Cliente avaliou seu atendimento.'), jsonb_build_object('solicitacao_id', p_solicitacao_id));
  perform public.fn_audit_chain_append('avaliacao', p_solicitacao_id, v_cli, 'criar', jsonb_build_object('nota', v_media));

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants webhook + criar pix nova assinatura + processar liberações
-- ---------------------------------------------------------------------------
revoke all on function public.fn_financeiro_webhook_confirmar_pix(text, text, text) from public;
grant execute on function public.fn_financeiro_webhook_confirmar_pix(text, text, text) to service_role;

revoke all on function public.fn_financeiro_criar_pagamento_pix(uuid, boolean, text, text, text, text) from public;
grant execute on function public.fn_financeiro_criar_pagamento_pix(uuid, boolean, text, text, text, text) to authenticated;

revoke all on function public.fn_avaliacao_criar_pos_etapa(uuid, int, int, int, text, text, text) from public;
grant execute on function public.fn_avaliacao_criar_pos_etapa(uuid, int, int, int, text, text, text) to authenticated;

create index if not exists idx_pagamentos_liberacao on public.pagamentos (liberacao_agendada_em)
  where status = 'em_escrow' and liberacao_agendada_em is not null;

-- Backfill: pagamentos em escrow já com etapa concluída e ambos confirmados → liberar na hora (compat)
update public.pagamentos p
set liberacao_agendada_em = now()
from public.etapas_atendimento e
where p.etapa_id = e.id
  and p.status = 'em_escrow'
  and e.status = 'concluida'
  and e.cliente_confirmou and e.profissional_confirmou
  and p.liberacao_agendada_em is null;
