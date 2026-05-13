-- RF16/RF17: carteira interna + solicitações de saque
-- Atendimentos (RF15) reaproveitam a tabela `solicitacoes` (status: aceita / em_andamento / concluida / cancelada)

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  saldo numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('credito', 'debito')),
  valor numeric(10,2) not null check (valor > 0),
  descricao text not null,
  referencia text,
  created_at timestamptz default now()
);

create table if not exists public.saques (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente','processado','cancelado')),
  observacao text,
  created_at timestamptz default now(),
  processado_em timestamptz
);

-- Cria wallet automaticamente quando alguém vira profissional
create or replace function public.criar_wallet_se_profissional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'profissional' then
    insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_wallet_on_profissional on public.profiles;
create trigger ensure_wallet_on_profissional
  after insert or update of tipo on public.profiles
  for each row execute function public.criar_wallet_se_profissional();

-- Backfill: profissionais existentes ganham wallet
insert into public.wallets (user_id)
select id from public.profiles where tipo = 'profissional'
on conflict (user_id) do nothing;

-- RLS
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.saques enable row level security;

drop policy if exists "wallet_select_own" on public.wallets;
create policy "wallet_select_own" on public.wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
create policy "wallet_transactions_select_own" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "saques_select_own" on public.saques;
create policy "saques_select_own" on public.saques
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "saques_insert_own" on public.saques;
create policy "saques_insert_own" on public.saques
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "saques_cancel_own" on public.saques;
create policy "saques_cancel_own" on public.saques
  for update to authenticated
  using (user_id = auth.uid() and status = 'pendente')
  with check (user_id = auth.uid() and status in ('pendente','cancelado'));
