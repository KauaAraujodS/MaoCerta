-- RF30-RF38: Etapas de atendimento com propostas de data/horário e confirmação mútua
-- 
-- Estrutura:
-- - etapas_tipos: Tipos de etapas (vistoria, orçamento, execução)
-- - etapas_atendimento: Instâncias das etapas em um atendimento
-- - agendamento_proposta: Propostas de data/horário para cada etapa
-- - cancelamento_etapas: Registra por que uma etapa foi cancelada

-- ============================================================
-- 1) Tipo enum para tipos de etapas
-- ============================================================
create type public.tipo_etapa as enum ('vistoria', 'orcamento', 'execucao');

-- ============================================================
-- 2) Status da etapa
-- ============================================================
create type public.status_etapa as enum ('pendente', 'agendada', 'em_progresso', 'concluida', 'cancelada');

-- ============================================================
-- 3) Status do agendamento (proposta de data/horário)
-- ============================================================
create type public.status_agendamento as enum ('proposto_prestador', 'proposto_cliente', 'aceito_ambos', 'rejeitado', 'cancelado');

-- ============================================================
-- 4) Tabela de tipos de etapas (referência)
-- ============================================================
create table if not exists public.etapas_tipos (
  id serial primary key,
  tipo public.tipo_etapa not null unique,
  nome text not null,
  descricao text,
  sequencia int not null
);

insert into public.etapas_tipos (tipo, nome, descricao, sequencia) values
  ('vistoria', 'Vistoria/Consulta', 'Vistoria do local ou consulta com cliente', 1),
  ('orcamento', 'Orçamento', 'Apresentação do orçamento e negociação', 2),
  ('execucao', 'Execução', 'Realização do serviço', 3)
on conflict (tipo) do nothing;

-- ============================================================
-- 5) Tabela principal: etapas do atendimento
-- ============================================================
create table if not exists public.etapas_atendimento (
  id uuid default gen_random_uuid() primary key,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  tipo public.tipo_etapa not null,
  sequencia int not null, -- ordem da etapa (1, 2, 3)
  status public.status_etapa default 'pendente' not null,
  
  -- Datas propostas (última proposta aceita)
  data_proposta date,
  hora_proposta time,
  
  -- Quem propôs
  proposto_por uuid references public.profiles(id) on delete set null,
  
  -- Confirmação mútua
  cliente_confirmou boolean default false,
  profissional_confirmou boolean default false,
  data_confirmacao_cliente timestamptz,
  data_confirmacao_profissional timestamptz,
  
  -- Notas
  notas_inicial text,
  notas_conclusao text,
  
  -- Rastreio
  data_inicio timestamptz,
  data_conclusao timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint etapa_sequencia_unica unique (solicitacao_id, sequencia)
);

create index if not exists idx_etapas_atendimento_solicitacao
  on public.etapas_atendimento (solicitacao_id, sequencia);
create index if not exists idx_etapas_atendimento_status
  on public.etapas_atendimento (solicitacao_id, status);

alter table public.etapas_atendimento enable row level security;

-- RLS: Cliente ou Profissional da solicitação podem ler/escrever suas etapas
drop policy if exists "etapas_atendimento_select_participante" on public.etapas_atendimento;
create policy "etapas_atendimento_select_participante" on public.etapas_atendimento
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "etapas_atendimento_insert_participante" on public.etapas_atendimento;
create policy "etapas_atendimento_insert_participante" on public.etapas_atendimento
  for insert to authenticated
  with check (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "etapas_atendimento_update_participante" on public.etapas_atendimento;
create policy "etapas_atendimento_update_participante" on public.etapas_atendimento
  for update to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

-- ============================================================
-- 6) Propostas de agendamento (data/horário) para etapas
-- ============================================================
create table if not exists public.agendamento_propostas (
  id uuid default gen_random_uuid() primary key,
  etapa_id uuid not null references public.etapas_atendimento(id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  
  -- Proposta
  data_proposta date not null,
  hora_proposta time not null,
  proposto_por uuid not null references public.profiles(id) on delete cascade,
  
  status public.status_agendamento default 'proposto_prestador' not null,
  
  -- Quem aceitou/rejeitou
  respondido_por uuid references public.profiles(id) on delete set null,
  resposta_em timestamptz,
  motivo_rejeicao text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_agendamento_propostas_etapa
  on public.agendamento_propostas (etapa_id);
create index if not exists idx_agendamento_propostas_solicitacao
  on public.agendamento_propostas (solicitacao_id, status);

alter table public.agendamento_propostas enable row level security;

drop policy if exists "agendamento_propostas_select_participante" on public.agendamento_propostas;
create policy "agendamento_propostas_select_participante" on public.agendamento_propostas
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "agendamento_propostas_insert_participante" on public.agendamento_propostas;
create policy "agendamento_propostas_insert_participante" on public.agendamento_propostas
  for insert to authenticated
  with check (
    proposto_por = auth.uid()
    and exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "agendamento_propostas_update_participante" on public.agendamento_propostas;
create policy "agendamento_propostas_update_participante" on public.agendamento_propostas
  for update to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

-- ============================================================
-- 7) Tabela de cancelamentos de etapas
-- ============================================================
create table if not exists public.cancelamento_etapas (
  id uuid default gen_random_uuid() primary key,
  etapa_id uuid not null references public.etapas_atendimento(id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  
  cancelado_por uuid not null references public.profiles(id) on delete set null,
  motivo text,
  
  created_at timestamptz default now()
);

create index if not exists idx_cancelamento_etapas_etapa
  on public.cancelamento_etapas (etapa_id);
create index if not exists idx_cancelamento_etapas_solicitacao
  on public.cancelamento_etapas (solicitacao_id);

alter table public.cancelamento_etapas enable row level security;

drop policy if exists "cancelamento_etapas_select_participante" on public.cancelamento_etapas;
create policy "cancelamento_etapas_select_participante" on public.cancelamento_etapas
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "cancelamento_etapas_insert_participante" on public.cancelamento_etapas;
create policy "cancelamento_etapas_insert_participante" on public.cancelamento_etapas
  for insert to authenticated
  with check (
    cancelado_por = auth.uid()
    and exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

-- ============================================================
-- 8) Trigger: Quando confirma data (aceito_ambos), atualiza a etapa
-- ============================================================
create or replace function public.sync_agendamento_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aceito_ambos' then
    update public.etapas_atendimento
      set 
        status = 'agendada'::public.status_etapa,
        data_proposta = new.data_proposta,
        hora_proposta = new.hora_proposta,
        updated_at = now()
      where id = new.etapa_id;
  end if;
  
  if new.status = 'cancelado' then
    update public.etapas_atendimento
      set 
        status = 'cancelada'::public.status_etapa,
        updated_at = now()
      where id = new.etapa_id and status = 'pendente'::public.status_etapa;
  end if;
  
  return new;
end;
$$;

drop trigger if exists trg_sync_agendamento_confirmado on public.agendamento_propostas;
create trigger trg_sync_agendamento_confirmado
  after update of status on public.agendamento_propostas
  for each row execute function public.sync_agendamento_confirmado();

-- ============================================================
-- 9) Trigger: Quando etapa vai para em_progresso, registra data_inicio
-- ============================================================
create or replace function public.sync_etapa_em_progresso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'em_progresso' and (old.status is null or old.status <> 'em_progresso'::public.status_etapa) then
    new.data_inicio := now();
  end if;
  
  if new.status = 'concluida' and (old.status is null or old.status <> 'concluida'::public.status_etapa) then
    new.data_conclusao := now();
  end if;
  
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_etapa_em_progresso on public.etapas_atendimento;
create trigger trg_sync_etapa_em_progresso
  before update of status on public.etapas_atendimento
  for each row execute function public.sync_etapa_em_progresso();

-- ============================================================
-- 10) Função auxiliar: criar etapas padrão quando solicitação é aceita
-- ============================================================
create or replace function public.criar_etapas_padrao(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo public.tipo_etapa;
  v_seq int;
  v_tipos_array public.tipo_etapa[] := array['vistoria'::public.tipo_etapa, 'orcamento'::public.tipo_etapa, 'execucao'::public.tipo_etapa];
begin
  foreach v_tipo in array v_tipos_array
  loop
    select sequencia into v_seq from public.etapas_tipos where tipo = v_tipo;
    
    insert into public.etapas_atendimento 
      (solicitacao_id, tipo, sequencia, status)
    values
      (p_solicitacao_id, v_tipo, v_seq, 'pendente'::public.status_etapa)
    on conflict (solicitacao_id, sequencia) do nothing;
  end loop;
end;
$$;

-- ============================================================
-- 11) Trigger: Criar etapas quando solicitação é criada com status 'aceita'
-- ============================================================
create or replace function public.trigger_criar_etapas_na_aceicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aceita'::public.status_solicitacao then
    perform public.criar_etapas_padrao(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_criar_etapas_na_aceicao on public.solicitacoes;
create trigger trg_criar_etapas_na_aceicao
  after insert or update of status on public.solicitacoes
  for each row execute function public.trigger_criar_etapas_na_aceicao();
