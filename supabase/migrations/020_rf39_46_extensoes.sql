-- RF39–RF46 + S1–S5: extensões (status padronizado, escrow na carteira, disputas formais,
-- comissão por categoria, cancelamento Pix 15 min, webhook stub, notificações, auditoria,
-- avaliação detalhada, wallet_withdrawals, moderação de mensagens financeiras externas)

-- ---------------------------------------------------------------------------
-- 0) Config: saque mínimo (S1)
-- ---------------------------------------------------------------------------
alter table public.config_financeiro
  add column if not exists valor_minimo_saque numeric(10,2) not null default 50.00;

comment on column public.config_financeiro.valor_minimo_saque is 'S1: valor mínimo para solicitar saque (PIX/TED).';

-- ---------------------------------------------------------------------------
-- 1) Status de pagamento (RF39.2 / RF40) — renomear estados legados
-- ---------------------------------------------------------------------------
drop index if exists public.ux_pagamento_etapa_em_aberto;

alter table public.pagamentos drop constraint if exists pagamentos_status_check;

update public.pagamentos set status = case status::text
  when 'aguardando_pix' then 'aguardando_pagamento'
  when 'pago_retido' then 'em_escrow'
  when 'em_disputa' then 'contestado'
  else status::text
end;

-- Garantir tipo texto compatível antes do novo check
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamentos' and column_name = 'status'
      and data_type <> 'text'
  ) then
    alter table public.pagamentos alter column status type text using status::text;
  end if;
end$$;

alter table public.pagamentos
  add constraint pagamentos_status_check check (status in (
    'aguardando_pagamento', 'pago', 'em_escrow', 'liberado', 'cancelado', 'contestado'
  ));

create unique index if not exists ux_pagamento_etapa_em_aberto
  on public.pagamentos (etapa_id)
  where status in ('aguardando_pagamento', 'pago', 'em_escrow', 'contestado');

-- Campos adicionais RF40.4 / RF41.1 / RF40.3
alter table public.pagamentos add column if not exists valor_etapa numeric(10,2);
alter table public.pagamentos add column if not exists pix_payload_hash text;
alter table public.pagamentos add column if not exists qr_expires_at timestamptz;
alter table public.pagamentos add column if not exists pago_em timestamptz;
alter table public.pagamentos add column if not exists webhook_ref text;

update public.pagamentos set valor_etapa = valor_bruto where valor_etapa is null;

-- ---------------------------------------------------------------------------
-- 2) Carteira: saldo bloqueado vs disponível (RF43)
-- ---------------------------------------------------------------------------
alter table public.wallets add column if not exists saldo_bloqueado numeric(10,2) not null default 0;

comment on column public.wallets.saldo_bloqueado is 'RF43: valores em escrow até liberação da etapa.';
comment on column public.wallets.saldo is 'Saldo disponível para saque (após liberação).';

-- ---------------------------------------------------------------------------
-- 3) wallet_transactions — tipos estendidos + rastreio (RF43.4)
-- ---------------------------------------------------------------------------
alter table public.wallet_transactions drop constraint if exists wallet_transactions_tipo_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_tipo_check check (tipo in (
    'credito', 'debito',
    'recebimento_etapa', 'liberacao_escrow', 'estorno_disputa', 'reembolso_admin', 'saque'
  ));

alter table public.wallet_transactions add column if not exists etapa_id uuid references public.etapas_atendimento(id) on delete set null;
alter table public.wallet_transactions add column if not exists bloqueado_ate timestamptz;

-- ---------------------------------------------------------------------------
-- 4) Comissão por categoria (RF42.1) — fallback em config_financeiro
-- ---------------------------------------------------------------------------
create table if not exists public.comissao_por_categoria (
  categoria_id int primary key references public.categorias(id) on delete cascade,
  comissao_percentual numeric(5,2) not null check (comissao_percentual >= 0 and comissao_percentual <= 100),
  updated_at timestamptz default now()
);

alter table public.comissao_por_categoria enable row level security;
drop policy if exists "comissao_categoria_select_auth" on public.comissao_por_categoria;
create policy "comissao_categoria_select_auth" on public.comissao_por_categoria
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5) Disputas formais (RF45.4)
-- ---------------------------------------------------------------------------
create table if not exists public.disputas (
  id uuid default gen_random_uuid() primary key,
  pagamento_id uuid references public.pagamentos(id) on delete cascade,
  etapa_id uuid not null references public.etapas_atendimento(id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  aberto_por uuid not null references public.profiles(id) on delete cascade,
  motivo text,
  status text not null default 'aberta' check (status in ('aberta', 'aguardando_prestador', 'aguardando_cliente', 'em_analise', 'liberada', 'estornada', 'arquivada')),
  prazo_prestador_ate timestamptz,
  prazo_cliente_ate timestamptz,
  evidencia_prestador text,
  replica_cliente text,
  decisao text,
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  log_interno jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_disputas_etapa on public.disputas (etapa_id);
create index if not exists idx_disputas_status on public.disputas (status);

alter table public.disputas enable row level security;
drop policy if exists "disputas_select_participantes" on public.disputas;
create policy "disputas_select_participantes" on public.disputas
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid() or public.is_administrator())
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Saques estendidos + wallet_withdrawals (S1) — espelha solicitação anti-fraude
-- ---------------------------------------------------------------------------
alter table public.saques add column if not exists metodo text not null default 'pix' check (metodo in ('pix', 'ted'));
alter table public.saques add column if not exists anti_fraude_status text not null default 'pendente'
  check (anti_fraude_status in ('pendente', 'aprovado', 'rejeitado'));

create table if not exists public.wallet_withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  saque_id uuid references public.saques(id) on delete set null,
  valor numeric(10,2) not null check (valor > 0),
  metodo text not null default 'pix' check (metodo in ('pix', 'ted')),
  status text not null default 'solicitado' check (status in ('solicitado', 'em_analise', 'pago', 'cancelado')),
  observacao text,
  valor_minimo_aplicado numeric(10,2),
  created_at timestamptz default now(),
  processado_em timestamptz
);

create index if not exists idx_wallet_withdrawals_user on public.wallet_withdrawals (user_id, created_at desc);

alter table public.wallet_withdrawals enable row level security;
drop policy if exists "wallet_withdrawals_select_own" on public.wallet_withdrawals;
create policy "wallet_withdrawals_select_own" on public.wallet_withdrawals
  for select to authenticated using (user_id = auth.uid() or public.is_administrator());

-- ---------------------------------------------------------------------------
-- 7) Notificações financeiras (S2) — fila simples
-- ---------------------------------------------------------------------------
create table if not exists public.notificacoes_financeiras (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text,
  payload jsonb default '{}'::jsonb,
  lida_em timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notif_fin_user on public.notificacoes_financeiras (user_id, created_at desc);

alter table public.notificacoes_financeiras enable row level security;
drop policy if exists "notif_fin_select_own" on public.notificacoes_financeiras;
create policy "notif_fin_select_own" on public.notificacoes_financeiras
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notif_fin_update_own" on public.notificacoes_financeiras;
create policy "notif_fin_update_own" on public.notificacoes_financeiras
  for update to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8) Auditoria tentativas indevidas (RF44.3)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_financeiro (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  acao text not null,
  detalhe jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.audit_financeiro enable row level security;
drop policy if exists "audit_fin_admin" on public.audit_financeiro;
create policy "audit_fin_admin" on public.audit_financeiro
  for select to authenticated using (public.is_administrator());

-- ---------------------------------------------------------------------------
-- 9) Chat: alerta pagamento externo (RF39.1)
-- ---------------------------------------------------------------------------
alter table public.mensagens_atendimento add column if not exists alerta_pagamento_externo boolean not null default false;
alter table public.mensagens_atendimento add column if not exists motivo_moderacao text;

-- ---------------------------------------------------------------------------
-- 10) Avaliações estendidas (RF46.2–46.5)
-- ---------------------------------------------------------------------------
alter table public.avaliacoes add column if not exists nota_qualidade smallint check (nota_qualidade is null or nota_qualidade between 1 and 5);
alter table public.avaliacoes add column if not exists nota_prazo smallint check (nota_prazo is null or nota_prazo between 1 and 5);
alter table public.avaliacoes add column if not exists nota_comunicacao smallint check (nota_comunicacao is null or nota_comunicacao between 1 and 5);
alter table public.avaliacoes add column if not exists bloqueio_edicao_ate timestamptz;
alter table public.avaliacoes add column if not exists resposta_prestador text;
alter table public.avaliacoes add column if not exists resposta_prestador_em timestamptz;

update public.avaliacoes
set
  nota_qualidade = coalesce(nota_qualidade, nota),
  nota_prazo = coalesce(nota_prazo, nota),
  nota_comunicacao = coalesce(nota_comunicacao, nota),
  bloqueio_edicao_ate = coalesce(bloqueio_edicao_ate, created_at + interval '7 days')
where nota_qualidade is null or nota_prazo is null or nota_comunicacao is null;

-- Prestador: score agregado para busca (RF46.4)
alter table public.profiles add column if not exists score_prioridade_busca numeric(6,3) not null default 0;

-- ---------------------------------------------------------------------------
-- 11) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.fn_comissao_percentual_para_solicitacao(p_solicitacao_id uuid)
returns numeric(5,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select cpc.comissao_percentual
      from public.solicitacoes sol
      left join public.demandas d on d.id = sol.demanda_origem_id
      left join public.comissao_por_categoria cpc on cpc.categoria_id = d.categoria_id
      where sol.id = p_solicitacao_id
      limit 1
    ),
    (select comissao_percentual from public.config_financeiro where id = 1 limit 1),
    10.00
  );
$$;

create or replace function public.fn_notificar_financeiro(p_user uuid, p_tipo text, p_titulo text, p_corpo text, p_payload jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.notificacoes_financeiras (user_id, tipo, titulo, corpo, payload)
  values (p_user, p_tipo, p_titulo, p_corpo, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.fn_atualizar_score_prestador(p_prestador uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media numeric;
  v_n int;
begin
  select count(*), avg(
    (coalesce(nota_qualidade, nota) + coalesce(nota_prazo, nota) + coalesce(nota_comunicacao, nota))::numeric / 3.0
  )
  into v_n, v_media
  from public.avaliacoes
  where avaliado_id = p_prestador;

  update public.profiles
  set score_prioridade_busca = coalesce(round(coalesce(v_media, 0)::numeric, 3), 0)
      + case when coalesce(v_n, 0) >= 5 and coalesce(v_media, 0) >= 4.5 then 0.5 else 0 end
  where id = p_prestador and tipo = 'profissional'::tipo_usuario;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12) Trigger: mensagem suspeita (RF39.1)
-- ---------------------------------------------------------------------------
create or replace function public.trg_mensagem_detectar_pagamento_externo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := lower(coalesce(new.conteudo, ''));
  suspeito boolean := false;
begin
  if t ~ '(pix\s*(?:fora|externo|direto)|chave\s*pix|transfer(ê|e)ncia\s*(?:direta|fora)|paga\s*(?:no|fora)\s*(?:whatsapp|zap|wpp)|\bpix\b.*\b(direto|externo)\b|dinheiro\s*(?:vivo|em\s*mãos)|fora\s+da\s+plataforma)' then
    suspeito := true;
  elsif position('pix' in t) > 0 and (position('000201' in t) > 0 or position('@' in t) > 0 or t ~ '\b\d{11}\b') then
    suspeito := true;
  end if;

  if suspeito then
    new.alerta_pagamento_externo := true;
    new.motivo_moderacao := 'Possível tentativa de pagamento fora da plataforma (RN18).';
    perform public.fn_notificar_financeiro(
      (select cliente_id from public.solicitacoes where id = new.solicitacao_id limit 1),
      'moderacao_chat',
      'Mensagem sinalizada',
      'Evite combinar Pix ou pagamentos fora da MaoCerta. Use apenas o fluxo oficial por etapa.',
      jsonb_build_object('solicitacao_id', new.solicitacao_id, 'mensagem_id', new.id)
    );
    perform public.fn_notificar_financeiro(
      (select profissional_id from public.solicitacoes where id = new.solicitacao_id limit 1),
      'moderacao_chat',
      'Mensagem sinalizada',
      'Uma mensagem foi sinalizada por possível pagamento externo. Mantenha tudo pela plataforma.',
      jsonb_build_object('solicitacao_id', new.solicitacao_id, 'mensagem_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mensagem_detectar_pagamento_externo on public.mensagens_atendimento;
create trigger trg_mensagem_detectar_pagamento_externo
  before insert on public.mensagens_atendimento
  for each row execute function public.trg_mensagem_detectar_pagamento_externo();

-- ---------------------------------------------------------------------------
-- 13) Trigger: etapa anterior paga/liberada antes de em_progresso (RF39.3)
-- ---------------------------------------------------------------------------
create or replace function public.trg_etapa_validar_pagamento_anterior()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev public.etapas_atendimento%rowtype;
begin
  if new.status = 'em_progresso'::public.status_etapa
     and (old.status is distinct from 'em_progresso'::public.status_etapa) then

    if coalesce(new.valor_acordado, 0) > 0 then
      if not exists (
        select 1 from public.pagamentos p
        where p.etapa_id = new.id and p.status in ('em_escrow', 'liberado')
      ) then
        raise exception 'ETAPA_SEM_PAGAMENTO_CONFIRMADO' using errcode = 'P0001';
      end if;
    end if;

    select * into v_prev
    from public.etapas_atendimento
    where solicitacao_id = new.solicitacao_id
      and sequencia = new.sequencia - 1
    limit 1;

    if found and coalesce(v_prev.valor_acordado, 0) > 0 then
      if v_prev.status = 'cancelada'::public.status_etapa then
        return new;
      end if;
      if not exists (
        select 1 from public.pagamentos p
        where p.etapa_id = v_prev.id and p.status = 'liberado'
      ) then
        raise exception 'ETAPA_ANTERIOR_NAO_LIBERADA' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_etapa_validar_pagamento_anterior on public.etapas_atendimento;
create trigger trg_etapa_validar_pagamento_anterior
  before update of status on public.etapas_atendimento
  for each row execute function public.trg_etapa_validar_pagamento_anterior();

-- ---------------------------------------------------------------------------
-- 14) Funções financeiras (substitui lógica da 019 com novos status + escrow carteira)
-- ---------------------------------------------------------------------------

create or replace function public.fn_financeiro_criar_pagamento_pix(p_etapa_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa record;
  v_solic record;
  v_pct numeric(5,2);
  v_comissao numeric(10,2);
  v_liquido numeric(10,2);
  v_bruto numeric(10,2);
  v_pix text;
  v_txid text;
  v_id uuid;
  v_hash text;
begin
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

  v_txid := 'SANDBOX-' || encode(gen_random_bytes(8), 'hex');
  v_pix := '00020126580014BR.GOV.BCB.PIX0136' || v_txid
    || '5204000053039865802BR5920MaoCerta Pix Demo6009SAO PAULO62070503***6304'
    || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  v_hash := encode(digest(v_pix, 'sha256'), 'hex');

  insert into public.pagamentos (
    solicitacao_id, etapa_id, cliente_id, profissional_id,
    valor_bruto, valor_etapa, comissao_percentual, valor_comissao, valor_liquido_prestador,
    metodo, status, pix_copia_e_cola, pix_txid, pix_payload_hash,
    qr_expires_at, dispute_motivo
  ) values (
    v_solic.id, p_etapa_id, v_solic.cliente_id, v_solic.profissional_id,
    v_bruto, v_bruto, coalesce(v_pct, 10), v_comissao, v_liquido,
    'pix', 'aguardando_pagamento', v_pix, v_txid, v_hash,
    now() + interval '15 minutes', null
  )
  returning id into v_id;

  perform public.fn_notificar_financeiro(v_solic.profissional_id, 'pix_gerado', 'Pix da etapa gerado', 'O cliente iniciou um pagamento por etapa.', jsonb_build_object('pagamento_id', v_id));

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

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'pagamento_recebido', 'Pagamento confirmado', 'Valor em retenção até a conclusão da etapa.', jsonb_build_object('pagamento_id', v_p.id));
  perform public.fn_notificar_financeiro(v_p.cliente_id, 'pagamento_recebido', 'Pagamento registrado', 'Seu Pix foi confirmado. O repasse ao prestador segue em escrow.', jsonb_build_object('pagamento_id', v_p.id));

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_financeiro_cancelar_pix_pendente(p_pagamento_id uuid)
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
  if v_p.status <> 'aguardando_pagamento' then
    return json_build_object('ok', false, 'erro', 'status_invalido');
  end if;
  if v_p.qr_expires_at is not null and v_p.qr_expires_at < now() then
    update public.pagamentos set status = 'cancelado', updated_at = now() where id = p_pagamento_id;
    return json_build_object('ok', true, 'motivo', 'expirado');
  end if;
  if extract(epoch from (now() - v_p.created_at)) > 900 then
    return json_build_object('ok', false, 'erro', 'prazo_cancelamento_expirado');
  end if;

  update public.pagamentos set status = 'cancelado', updated_at = now() where id = p_pagamento_id;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_financeiro_webhook_confirmar_pix(
  p_pix_txid text,
  p_webhook_ref text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  select * into v_p from public.pagamentos
  where pix_txid = p_pix_txid and status = 'aguardando_pagamento'
  order by created_at desc limit 1 for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
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
    'Recebimento etapa (webhook) — comissão R$ ' || v_p.valor_comissao::text,
    v_p.id::text,
    v_p.etapa_id,
    null
  );

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'pagamento_recebido', 'Pix confirmado (webhook)', 'Valor retido até liberação da etapa.', jsonb_build_object('pagamento_id', v_p.id));

  return json_build_object('ok', true, 'pagamento_id', v_p.id);
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
  where etapa_id = p_etapa_id and status = 'em_escrow'
  order by created_at desc limit 1 for update;
  if not found then return; end if;

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
    'Liberação após confirmação mútua da etapa',
    v_p.id::text,
    v_p.etapa_id,
    now()
  );

  perform public.fn_notificar_financeiro(v_p.profissional_id, 'valor_liberado', 'Valor liberado', 'O valor da etapa está disponível na sua carteira.', jsonb_build_object('pagamento_id', v_p.id));
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
  v_p record;
  v_disp uuid;
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

  select * into v_p from public.pagamentos
  where etapa_id = p_etapa_id and status = 'em_escrow'
  order by created_at desc limit 1 for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'sem_retencao_para_disputa');
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

  perform public.fn_notificar_financeiro(v_solic.profissional_id, 'disputa_aberta', 'Disputa aberta', 'Um cliente abriu contestação. Prazo de 3 dias para evidências.', jsonb_build_object('disputa_id', v_disp));
  perform public.fn_notificar_financeiro(v_solic.cliente_id, 'disputa_aberta', 'Contestação registrada', 'Sua solicitação foi registrada. Acompanhe os prazos na área do atendimento.', jsonb_build_object('disputa_id', v_disp));

  return json_build_object('ok', true, 'disputa_id', v_disp);
end;
$$;

create or replace function public.fn_disputa_prestador_evidencia(p_disputa_id uuid, p_texto text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from public.disputas where id = p_disputa_id for update;
  if not found then return json_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if not exists (
    select 1 from public.solicitacoes s
    where s.id = d.solicitacao_id and s.profissional_id = auth.uid()
  ) then
    return json_build_object('ok', false, 'erro', 'apenas_prestador');
  end if;
  if d.status <> 'aguardando_prestador' then
    return json_build_object('ok', false, 'erro', 'status_invalido');
  end if;
  if d.prazo_prestador_ate is not null and d.prazo_prestador_ate < now() then
    return json_build_object('ok', false, 'erro', 'prazo_expirado');
  end if;

  update public.disputas
  set
    evidencia_prestador = nullif(trim(p_texto), ''),
    status = 'aguardando_cliente',
    prazo_cliente_ate = now() + interval '2 days',
    updated_at = now()
  where id = p_disputa_id;

  perform public.fn_notificar_financeiro(
    (select cliente_id from public.solicitacoes where id = d.solicitacao_id),
    'disputa_replica', 'Réplica do prestador', 'O prestador enviou evidências. Você tem 2 dias para réplica.',
    jsonb_build_object('disputa_id', p_disputa_id)
  );

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_disputa_cliente_replica(p_disputa_id uuid, p_texto text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from public.disputas where id = p_disputa_id for update;
  if not found then return json_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if not exists (
    select 1 from public.solicitacoes s
    where s.id = d.solicitacao_id and s.cliente_id = auth.uid()
  ) then
    return json_build_object('ok', false, 'erro', 'apenas_cliente');
  end if;
  if d.status <> 'aguardando_cliente' then
    return json_build_object('ok', false, 'erro', 'status_invalido');
  end if;
  if d.prazo_cliente_ate is not null and d.prazo_cliente_ate < now() then
    return json_build_object('ok', false, 'erro', 'prazo_expirado');
  end if;

  update public.disputas
  set
    replica_cliente = nullif(trim(p_texto), ''),
    status = 'em_analise',
    updated_at = now()
  where id = p_disputa_id;

  return json_build_object('ok', true);
end;
$$;

drop function if exists public.fn_financeiro_resolver_disputa_admin(uuid);

create or replace function public.fn_financeiro_resolver_disputa_admin(p_etapa_id uuid, p_acao text default 'liberar')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  d record;
begin
  if not public.is_administrator() then
    return json_build_object('ok', false, 'erro', 'admin_apenas');
  end if;

  select * into v_p from public.pagamentos
  where etapa_id = p_etapa_id and status = 'contestado'
  order by created_at desc limit 1 for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'sem_disputa');
  end if;

  select * into d from public.disputas
  where etapa_id = p_etapa_id and status in ('aberta', 'aguardando_prestador', 'aguardando_cliente', 'em_analise')
  order by created_at desc limit 1 for update;

  if p_acao = 'liberar' then
    update public.pagamentos set status = 'em_escrow', updated_at = now() where id = v_p.id;
    if d.id is not null then
      update public.disputas set status = 'liberada', decisao = 'Liberar repasse ao prestador', decidido_por = auth.uid(), decidido_em = now(), updated_at = now() where id = d.id;
    end if;
    perform public.fn_financeiro_liberar_credito_etapa(p_etapa_id);
    return json_build_object('ok', true, 'resultado', 'liberado');
  elsif p_acao = 'estornar' then
    update public.wallets
    set saldo_bloqueado = greatest(0, saldo_bloqueado - v_p.valor_liquido_prestador), updated_at = now()
    where user_id = v_p.profissional_id;

    insert into public.wallet_transactions (user_id, tipo, valor, descricao, referencia, etapa_id)
    values (
      v_p.profissional_id,
      'estorno_disputa',
      v_p.valor_liquido_prestador,
      'Estorno disputa — etapa ' || p_etapa_id::text,
      v_p.id::text,
      p_etapa_id
    );

    update public.pagamentos set status = 'cancelado', updated_at = now() where id = v_p.id;
    if d.id is not null then
      update public.disputas set status = 'estornada', decisao = 'Estorno ao cliente', decidido_por = auth.uid(), decidido_em = now(), updated_at = now() where id = d.id;
    end if;

    perform public.fn_notificar_financeiro(v_p.cliente_id, 'estorno', 'Estorno registrado', 'A disputa foi resolvida a favor do reembolso.', jsonb_build_object('pagamento_id', v_p.id));

    return json_build_object('ok', true, 'resultado', 'estornado');
  end if;

  return json_build_object('ok', false, 'erro', 'acao_invalida');
end;
$$;

-- RPC: saque com mínimo + anti-fraude pendente (S1) + RF44
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
  v_bloq numeric;
  v_disp numeric;
  v_saque_id uuid;
  v_wid uuid;
  v_tipo text;
begin
  select tipo into v_tipo from public.profiles where id = v_uid;
  if v_tipo is distinct from 'profissional'::tipo_usuario then
    insert into public.audit_financeiro (actor_id, acao, detalhe)
    values (v_uid, 'saque_negado_nao_prestador', jsonb_build_object('valor', p_valor));
    return json_build_object('ok', false, 'erro', 'apenas_prestador');
  end if;

  select valor_minimo_saque into v_min from public.config_financeiro where id = 1;
  if p_valor is null or p_valor < coalesce(v_min, 50) then
    return json_build_object('ok', false, 'erro', 'abaixo_minimo', 'valor_minimo', coalesce(v_min, 50));
  end if;

  select saldo, saldo_bloqueado into v_saldo, v_bloq from public.wallets where user_id = v_uid for update;
  v_disp := coalesce(v_saldo, 0);

  if p_valor > v_disp then
    return json_build_object('ok', false, 'erro', 'saldo_insuficiente');
  end if;

  insert into public.saques (user_id, valor, status, observacao, metodo, anti_fraude_status)
  values (v_uid, p_valor, 'pendente', nullif(trim(p_observacao), ''), coalesce(nullif(trim(p_metodo), ''), 'pix'), 'pendente')
  returning id into v_saque_id;

  insert into public.wallet_withdrawals (user_id, saque_id, valor, metodo, status, observacao, valor_minimo_aplicado)
  values (v_uid, v_saque_id, p_valor, coalesce(nullif(trim(p_metodo), ''), 'pix'), 'em_analise', nullif(trim(p_observacao), ''), coalesce(v_min, 50))
  returning id into v_wid;

  perform public.fn_notificar_financeiro(v_uid, 'saque_solicitado', 'Saque solicitado', 'Sua solicitação está em análise anti-fraude.', jsonb_build_object('saque_id', v_saque_id));

  return json_build_object('ok', true, 'saque_id', v_saque_id, 'wallet_withdrawal_id', v_wid);
end;
$$;

-- Avaliação pós-liberação (RF46)
create or replace function public.fn_avaliacao_criar_pos_etapa(
  p_solicitacao_id uuid,
  p_nota_qualidade int,
  p_nota_prazo int,
  p_nota_comunicacao int,
  p_comentario text
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
    nota_qualidade, nota_prazo, nota_comunicacao, comentario, bloqueio_edicao_ate
  ) values (
    p_solicitacao_id, v_cli, v_sol.profissional_id, v_media,
    p_nota_qualidade, p_nota_prazo, p_nota_comunicacao, nullif(trim(p_comentario), ''),
    now() + interval '7 days'
  );

  perform public.fn_atualizar_score_prestador(v_sol.profissional_id);

  return json_build_object('ok', true);
end;
$$;

create or replace function public.fn_avaliacao_responder_prestador(p_avaliacao_id uuid, p_texto text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  select * into a from public.avaliacoes where id = p_avaliacao_id for update;
  if not found then return json_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if a.avaliado_id <> auth.uid() then return json_build_object('ok', false, 'erro', 'nao_autorizado'); end if;
  if a.resposta_prestador is not null then return json_build_object('ok', false, 'erro', 'ja_respondeu'); end if;

  update public.avaliacoes
  set resposta_prestador = nullif(trim(p_texto), ''), resposta_prestador_em = now()
  where id = p_avaliacao_id;

  return json_build_object('ok', true);
end;
$$;

-- View relatório comissões (RF42.3)
create or replace view public.vw_relatorio_comissoes_mes as
select
  date_trunc('month', p.pago_em) as mes,
  p.profissional_id,
  p.solicitacao_id,
  sum(p.valor_comissao) as total_comissao,
  count(*) as qtd_pagamentos
from public.pagamentos p
where p.status in ('em_escrow', 'liberado', 'contestado')
  and p.pago_em is not null
group by 1, 2, 3;

alter view public.vw_relatorio_comissoes_mes set (security_invoker = true);

-- Grants
revoke all on function public.fn_financeiro_cancelar_pix_pendente(uuid) from public;
revoke all on function public.fn_financeiro_webhook_confirmar_pix(text, text) from public;
revoke all on function public.fn_disputa_prestador_evidencia(uuid, text) from public;
revoke all on function public.fn_disputa_cliente_replica(uuid, text) from public;
revoke all on function public.fn_wallet_solicitar_saque(numeric, text, text) from public;
revoke all on function public.fn_financeiro_resolver_disputa_admin(uuid, text) from public;
revoke all on function public.fn_avaliacao_criar_pos_etapa(uuid, int, int, int, text) from public;
revoke all on function public.fn_avaliacao_responder_prestador(uuid, text) from public;
revoke all on function public.fn_comissao_percentual_para_solicitacao(uuid) from public;
revoke all on function public.fn_notificar_financeiro(uuid, text, text, text, jsonb) from public;
revoke all on function public.fn_atualizar_score_prestador(uuid) from public;

grant execute on function public.fn_financeiro_cancelar_pix_pendente(uuid) to authenticated;
grant execute on function public.fn_disputa_prestador_evidencia(uuid, text) to authenticated;
grant execute on function public.fn_disputa_cliente_replica(uuid, text) to authenticated;
grant execute on function public.fn_wallet_solicitar_saque(numeric, text, text) to authenticated;
grant execute on function public.fn_avaliacao_criar_pos_etapa(uuid, int, int, int, text) to authenticated;
grant execute on function public.fn_financeiro_resolver_disputa_admin(uuid, text) to authenticated;
grant execute on function public.fn_financeiro_webhook_confirmar_pix(text, text) to service_role;

revoke all on public.vw_relatorio_comissoes_mes from public;
grant select on public.vw_relatorio_comissoes_mes to service_role;

comment on view public.vw_relatorio_comissoes_mes is 'RF42.3: base para relatório mensal de comissões (admin filtra no app).';

-- RF46: inserts em avaliacoes apenas via RPC (bloqueia caminho antigo)
drop policy if exists "avaliacoes_insert_participante" on public.avaliacoes;
drop policy if exists "avaliacoes_insert_bloqueado_usuario" on public.avaliacoes;
create policy "avaliacoes_insert_bloqueado_usuario" on public.avaliacoes
  for insert to authenticated with check (false);

-- RF44 / S1: saques apenas via RPC (valor mínimo + anti-fraude)
drop policy if exists "saques_insert_own" on public.saques;
drop policy if exists "saques_insert_bloqueado_direto" on public.saques;
create policy "saques_insert_bloqueado_direto" on public.saques
  for insert to authenticated with check (false);

-- Admin enxerga pagamentos / disputas (relatórios RF42.3 / RF45)
drop policy if exists "pagamentos_select_admin" on public.pagamentos;
create policy "pagamentos_select_admin" on public.pagamentos
  for select to authenticated using (public.is_administrator());

drop policy if exists "disputas_select_admin" on public.disputas;
create policy "disputas_select_admin" on public.disputas
  for select to authenticated using (public.is_administrator());

drop policy if exists "disputas_update_admin" on public.disputas;
create policy "disputas_update_admin" on public.disputas
  for update to authenticated using (public.is_administrator());

drop policy if exists "wallet_withdrawals_select_admin" on public.wallet_withdrawals;
create policy "wallet_withdrawals_select_admin" on public.wallet_withdrawals
  for select to authenticated using (public.is_administrator());
