-- Permite que o prestador aceite ou recuse demandas públicas direto.
-- Aceitar: cria uma solicitação com status 'aceita' ligada à demanda → vira atendimento.
-- Recusar: registra a recusa, demanda some só para esse prestador.

-- 1) Vínculo solicitação → demanda de origem
alter table public.solicitacoes
  add column if not exists demanda_origem_id uuid references public.demandas(id) on delete set null;

-- 2) Recusas individuais (uma demanda recusada por um prestador some só pra ele)
create table if not exists public.demanda_recusas (
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  profissional_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (demanda_id, profissional_id)
);

alter table public.demanda_recusas enable row level security;

drop policy if exists "demanda_recusas_select_own" on public.demanda_recusas;
create policy "demanda_recusas_select_own" on public.demanda_recusas
  for select to authenticated using (profissional_id = auth.uid());

drop policy if exists "demanda_recusas_insert_own" on public.demanda_recusas;
create policy "demanda_recusas_insert_own" on public.demanda_recusas
  for insert to authenticated with check (profissional_id = auth.uid());

-- 3) Permitir que o prestador insira uma solicitação quando aceita uma demanda aberta
drop policy if exists "profissional aceita demanda cria solicitacao" on public.solicitacoes;
create policy "profissional aceita demanda cria solicitacao" on public.solicitacoes
  for insert to authenticated
  with check (
    auth.uid() = profissional_id
    and demanda_origem_id is not null
    and exists (
      select 1 from public.demandas d
      where d.id = demanda_origem_id
        and d.status = 'aberta'::status_demanda
    )
  );
