-- Lock atômico: só um prestador pode aceitar uma demanda.
-- Quando aceita, demanda muda para 'em_andamento' (some das listas).
-- Se a solicitação for cancelada, demanda volta a 'aberta' para outros prestadores.
-- Chat de mensagens entre cliente da demanda e prestador que aceitou.

-- ============================================================
-- 1) Lock atômico: índice único garante UMA solicitação ativa por demanda
-- ============================================================
drop index if exists public.solicitacao_unica_por_demanda;
create unique index solicitacao_unica_por_demanda
  on public.solicitacoes (demanda_origem_id)
  where demanda_origem_id is not null
    and status in ('aceita', 'em_andamento');

-- ============================================================
-- 2) Trigger: aceitar demanda muda demanda.status -> em_andamento
--    Cancelar atendimento devolve a demanda para 'aberta'
-- ============================================================
create or replace function public.sync_status_demanda_via_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if new.demanda_origem_id is not null and new.status in ('aceita', 'em_andamento') then
      update public.demandas
        set status = 'em_andamento'::status_demanda
        where id = new.demanda_origem_id
          and status = 'aberta'::status_demanda;
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    -- Cancelamento: devolve a demanda para o pool aberto
    if new.demanda_origem_id is not null
       and new.status = 'cancelada'
       and coalesce(old.status, '') in ('aceita', 'em_andamento') then
      update public.demandas
        set status = 'aberta'::status_demanda
        where id = new.demanda_origem_id
          and status = 'em_andamento'::status_demanda;
    end if;

    -- Conclusão: marca demanda como concluída
    if new.demanda_origem_id is not null
       and new.status = 'concluida'
       and coalesce(old.status, '') in ('aceita', 'em_andamento') then
      update public.demandas
        set status = 'concluida'::status_demanda
        where id = new.demanda_origem_id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_demanda_via_solicitacao on public.solicitacoes;
create trigger trg_sync_demanda_via_solicitacao
  after insert or update on public.solicitacoes
  for each row execute function public.sync_status_demanda_via_solicitacao();

-- ============================================================
-- 3) Permitir que cliente também atualize sua solicitação para 'cancelada'
--    (necessário pra cliente cancelar pelo lado dele)
-- ============================================================
drop policy if exists "cliente cancela suas solicitacoes" on public.solicitacoes;
create policy "cliente cancela suas solicitacoes" on public.solicitacoes
  for update to authenticated
  using (auth.uid() = cliente_id)
  with check (auth.uid() = cliente_id);

-- ============================================================
-- 4) Chat de mensagens por atendimento (solicitação)
-- ============================================================
create table if not exists public.mensagens_atendimento (
  id uuid default gen_random_uuid() primary key,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  remetente_id uuid not null references public.profiles(id) on delete cascade,
  conteudo text not null check (length(trim(conteudo)) > 0),
  created_at timestamptz default now()
);

create index if not exists idx_mensagens_atendimento_solicitacao
  on public.mensagens_atendimento (solicitacao_id, created_at);

alter table public.mensagens_atendimento enable row level security;

-- Apenas cliente ou prestador da solicitação podem ler/escrever
drop policy if exists "mensagens_atendimento_select_participante" on public.mensagens_atendimento;
create policy "mensagens_atendimento_select_participante" on public.mensagens_atendimento
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );

drop policy if exists "mensagens_atendimento_insert_participante" on public.mensagens_atendimento;
create policy "mensagens_atendimento_insert_participante" on public.mensagens_atendimento
  for insert to authenticated
  with check (
    remetente_id = auth.uid()
    and exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and s.status in ('aceita', 'em_andamento')
        and (s.cliente_id = auth.uid() or s.profissional_id = auth.uid())
    )
  );
