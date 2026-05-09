-- RF21–RF26: Fluxo de propostas em demandas públicas
-- - Adiciona status 'suplente' (RN07) no enum status_proposta
-- - Vincula solicitação ao seu pai (proposta) — facilita rastreio
-- - Permite cliente atualizar propostas das suas demandas (escolher / arquivar)

-- 1) Novo status 'suplente' (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'status_proposta' and e.enumlabel = 'suplente'
  ) then
    alter type public.status_proposta add value 'suplente';
  end if;
end$$;

-- 2) Vínculo opcional solicitacao → proposta de origem
alter table public.solicitacoes
  add column if not exists proposta_origem_id uuid references public.propostas(id) on delete set null;

-- 3) Permite o cliente da demanda atualizar (aceitar/marcar suplente) propostas
drop policy if exists "propostas_update_cliente_da_demanda" on public.propostas;
create policy "propostas_update_cliente_da_demanda"
  on public.propostas for update to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_id and d.cliente_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_id and d.cliente_id = auth.uid()
    )
  );

-- 4) Trigger: ao aceitar uma proposta, marca demais propostas da MESMA demanda como 'suplente'
create or replace function public.marcar_propostas_suplentes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aceita' and coalesce(old.status, '') <> 'aceita' then
    update public.propostas
      set status = 'suplente'
      where demanda_id = new.demanda_id
        and id <> new.id
        and status = 'pendente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propostas_suplentes on public.propostas;
create trigger trg_propostas_suplentes
  after update of status on public.propostas
  for each row execute function public.marcar_propostas_suplentes();
