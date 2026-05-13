-- =============================================================================
-- MaoCerta — alinhar banco JÁ EXISTENTE ao app (idempotente / seguro para re-run)
-- Cole no Supabase → SQL Editor → Run (pode rodar mais de uma vez)
--
-- Corrige: enums, profiles (colunas + tipo text→enum), trigger signup, storage,
-- tabelas RF08+, RLS principal, categorias extras.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------- 1) Enums de status (não dependem de profiles)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_demanda') then
    create type public.status_demanda as enum ('aberta', 'em_andamento', 'concluida', 'cancelada');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_proposta') then
    create type public.status_proposta as enum ('pendente', 'aceita', 'recusada');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_acordo') then
    create type public.status_acordo as enum ('em_andamento', 'concluido', 'cancelado');
  end if;
end$$;

-- --------------------------------------------------------------------------- 2) Enum tipo_usuario (cliente, profissional, + administrador)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_usuario') then
    create type public.tipo_usuario as enum ('cliente', 'profissional', 'administrador');
  else
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'tipo_usuario' and e.enumlabel = 'administrador'
    ) then
      alter type public.tipo_usuario add value if not exists 'administrador';
    end if;
  end if;
end$$;

-- --------------------------------------------------------------------------- 3) Enum plano
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plano_usuario') then
    create type public.plano_usuario as enum ('free', 'basico', 'premium');
  end if;
end$$;

-- --------------------------------------------------------------------------- 4) Tabela profiles (criar OU ajustar colunas / tipo)
create table if not exists public.profiles (
  id uuid references auth.users (id) on delete cascade primary key,
  nome text not null,
  tipo public.tipo_usuario not null default 'cliente'::tipo_usuario,
  telefone text,
  bio text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Colunas que o app usa e podem faltar em versões antigas do seu SQL
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists cidade text;
alter table public.profiles add column if not exists plano public.plano_usuario not null default 'free'::plano_usuario;
alter table public.profiles add column if not exists plano_atualizado_em timestamptz default now();
alter table public.profiles add column if not exists experiencia_anos int;
alter table public.profiles add column if not exists historico_profissional text;

-- Telefone opcional (cadastro / trigger podem deixar null)
alter table public.profiles alter column telefone drop not null;

-- Se "tipo" ainda for text/varchar (seu snippet antigo), converte para enum
do $$
declare
  t text;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into t
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles' and a.attname = 'tipo' and a.attnum > 0 and not a.attisdropped;

  if t is not null and (t ilike '%varchar%' or t = 'text') then
    alter table public.profiles
      alter column tipo type public.tipo_usuario
      using (trim(lower(tipo::text))::tipo_usuario);
  end if;
exception
  when others then
    raise notice 'Ajuste manual da coluna tipo pode ser necessário: %', sqlerrm;
end$$;

-- --------------------------------------------------------------------------- 5) Demais tabelas núcleo
create table if not exists public.categorias (
  id serial primary key,
  nome text not null unique
);

create table if not exists public.servicos (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid not null references public.profiles (id) on delete cascade,
  categoria_id int not null references public.categorias (id),
  descricao text not null,
  valor_hora numeric(10, 2),
  created_at timestamptz default now()
);

create table if not exists public.demandas (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references public.profiles (id) on delete cascade,
  categoria_id int not null references public.categorias (id),
  titulo text not null,
  descricao text not null,
  status public.status_demanda not null default 'aberta'::status_demanda,
  created_at timestamptz default now()
);

create table if not exists public.propostas (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  profissional_id uuid not null references public.profiles (id) on delete cascade,
  mensagem text not null,
  valor_proposto numeric(10, 2) not null,
  prazo text not null,
  status public.status_proposta not null default 'pendente'::status_proposta,
  created_at timestamptz default now()
);

create table if not exists public.acordos (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid references public.demandas (id),
  cliente_id uuid not null references public.profiles (id),
  profissional_id uuid not null references public.profiles (id),
  valor numeric(10, 2) not null,
  prazo text not null,
  status public.status_acordo not null default 'em_andamento'::status_acordo,
  created_at timestamptz default now()
);

create table if not exists public.mensagens (
  id uuid default gen_random_uuid() primary key,
  acordo_id uuid not null references public.acordos (id) on delete cascade,
  remetente_id uuid not null references public.profiles (id),
  conteudo text not null,
  created_at timestamptz default now()
);

-- Categorias iniciais (ignora duplicata)
insert into public.categorias (nome) values
  ('Elétrica'), ('Hidráulica'), ('Pintura'), ('Limpeza'), ('Marcenaria'),
  ('Jardinagem'), ('Informática'), ('Montagem de móveis'), ('Ar-condicionado'), ('Reforma geral')
on conflict (nome) do nothing;

-- --------------------------------------------------------------------------- 6) RF08 / RF14 — tabelas extras
create table if not exists public.profissional_categorias (
  profissional_id uuid not null references public.profiles (id) on delete cascade,
  categoria_id int not null references public.categorias (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (profissional_id, categoria_id)
);

create table if not exists public.solicitacoes (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references public.profiles (id) on delete cascade,
  profissional_id uuid not null references public.profiles (id) on delete cascade,
  titulo text not null,
  descricao text not null,
  status text not null default 'pendente',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documentos_validacao (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid not null references public.profiles (id) on delete cascade,
  tipo_documento text not null,
  arquivo_url text not null,
  observacao text,
  status text not null default 'enviado',
  criado_em timestamptz default now(),
  analisado_em timestamptz
);

-- --------------------------------------------------------------------------- 7) Trigger: novo usuário → profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, telefone, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'telefone',
    coalesce((new.raw_user_meta_data->>'tipo')::tipo_usuario, 'cliente'::tipo_usuario)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, nome, telefone, tipo)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'telefone',
  coalesce((u.raw_user_meta_data->>'tipo')::tipo_usuario, 'cliente'::tipo_usuario)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- --------------------------------------------------------------------------- 8) Storage — avatars + documentos
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documentos-validacao', 'documentos-validacao', true)
on conflict (id) do nothing;

drop policy if exists "Avatars são visíveis publicamente" on storage.objects;
create policy "Avatars são visíveis publicamente"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Usuário envia seu próprio avatar" on storage.objects;
create policy "Usuário envia seu próprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Usuário atualiza seu próprio avatar" on storage.objects;
create policy "Usuário atualiza seu próprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Usuário remove seu próprio avatar" on storage.objects;
create policy "Usuário remove seu próprio avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "upload proprio documento" on storage.objects;
create policy "upload proprio documento"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-validacao' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ver proprio documento" on storage.objects;
create policy "ver proprio documento"
  on storage.objects for select to authenticated
  using (bucket_id = 'documentos-validacao' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "atualiza proprio documento validacao" on storage.objects;
create policy "atualiza proprio documento validacao"
  on storage.objects for update to authenticated
  using (bucket_id = 'documentos-validacao' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documentos-validacao' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "remove proprio documento validacao" on storage.objects;
create policy "remove proprio documento validacao"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-validacao' and (storage.foldername(name))[1] = auth.uid()::text);

-- --------------------------------------------------------------------------- 9) Função admin (evita recursão RLS em profiles)
create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tipo = 'administrador'::tipo_usuario from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_administrator() from public;
grant execute on function public.is_administrator() to authenticated;

-- --------------------------------------------------------------------------- 10) RLS — substitui políticas antigas simples de profiles
alter table public.profiles enable row level security;

drop policy if exists "Usuário vê só o próprio perfil" on public.profiles;
drop policy if exists "Usuário edita só o próprio perfil" on public.profiles;
drop policy if exists "Usuário insere o próprio perfil" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_administrator());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_administrator())
  with check (id = auth.uid() or public.is_administrator());

-- --------------------------------------------------------------------------- 11) RLS demais tabelas (RF08 + núcleo)
alter table public.profissional_categorias enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.documentos_validacao enable row level security;

drop policy if exists "profissional gerencia suas categorias" on public.profissional_categorias;
create policy "profissional gerencia suas categorias"
  on public.profissional_categorias for all to authenticated
  using (auth.uid() = profissional_id) with check (auth.uid() = profissional_id);

drop policy if exists "categorias profissionais visiveis" on public.profissional_categorias;
create policy "categorias profissionais visiveis"
  on public.profissional_categorias for select to authenticated using (true);

drop policy if exists "cliente cria solicitacao" on public.solicitacoes;
create policy "cliente cria solicitacao"
  on public.solicitacoes for insert to authenticated with check (auth.uid() = cliente_id);

drop policy if exists "cliente ve suas solicitacoes" on public.solicitacoes;
create policy "cliente ve suas solicitacoes"
  on public.solicitacoes for select to authenticated using (auth.uid() = cliente_id);

drop policy if exists "profissional ve e atualiza solicitacoes recebidas" on public.solicitacoes;
drop policy if exists "profissional ve solicitacoes recebidas" on public.solicitacoes;
drop policy if exists "profissional atualiza solicitacoes recebidas" on public.solicitacoes;

create policy "profissional ve solicitacoes recebidas"
  on public.solicitacoes for select to authenticated using (auth.uid() = profissional_id);

create policy "profissional atualiza solicitacoes recebidas"
  on public.solicitacoes for update to authenticated
  using (auth.uid() = profissional_id) with check (auth.uid() = profissional_id);

drop policy if exists "profissional gerencia documentos" on public.documentos_validacao;
create policy "profissional gerencia documentos"
  on public.documentos_validacao for all to authenticated
  using (auth.uid() = profissional_id) with check (auth.uid() = profissional_id);

drop policy if exists "admin visualiza documentos" on public.documentos_validacao;
create policy "admin visualiza documentos"
  on public.documentos_validacao for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.tipo = 'administrador'::tipo_usuario
  ));

alter table public.categorias enable row level security;
drop policy if exists "categorias_select_auth" on public.categorias;
create policy "categorias_select_auth" on public.categorias for select to authenticated using (true);

alter table public.servicos enable row level security;
drop policy if exists "servicos_select_own" on public.servicos;
drop policy if exists "servicos_insert_own" on public.servicos;
drop policy if exists "servicos_update_own" on public.servicos;
drop policy if exists "servicos_delete_own" on public.servicos;
create policy "servicos_select_own" on public.servicos for select to authenticated using (profissional_id = auth.uid());
create policy "servicos_insert_own" on public.servicos for insert to authenticated with check (profissional_id = auth.uid());
create policy "servicos_update_own" on public.servicos for update to authenticated
  using (profissional_id = auth.uid()) with check (profissional_id = auth.uid());
create policy "servicos_delete_own" on public.servicos for delete to authenticated using (profissional_id = auth.uid());

alter table public.demandas enable row level security;
drop policy if exists "demandas_select_cliente_ou_abertas" on public.demandas;
drop policy if exists "demandas_insert_cliente" on public.demandas;
drop policy if exists "demandas_update_cliente" on public.demandas;
create policy "demandas_select_cliente_ou_abertas" on public.demandas for select to authenticated
  using (cliente_id = auth.uid() or status = 'aberta'::status_demanda);
create policy "demandas_insert_cliente" on public.demandas for insert to authenticated with check (cliente_id = auth.uid());
create policy "demandas_update_cliente" on public.demandas for update to authenticated
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

alter table public.propostas enable row level security;
drop policy if exists "propostas_select_participantes" on public.propostas;
drop policy if exists "propostas_insert_profissional" on public.propostas;
drop policy if exists "propostas_update_profissional" on public.propostas;
create policy "propostas_select_participantes" on public.propostas for select to authenticated
  using (
    profissional_id = auth.uid()
    or exists (select 1 from public.demandas d where d.id = demanda_id and d.cliente_id = auth.uid())
  );
create policy "propostas_insert_profissional" on public.propostas for insert to authenticated
  with check (
    auth.uid() = profissional_id
    and exists (
      select 1 from public.demandas d
      where d.id = demanda_id and d.status = 'aberta'::status_demanda and d.cliente_id <> auth.uid()
    )
  );
create policy "propostas_update_profissional" on public.propostas for update to authenticated
  using (profissional_id = auth.uid()) with check (profissional_id = auth.uid());

-- --------------------------------------------------------------------------- 12) Categorias extras (mesmo bloco do 010)
insert into public.categorias (nome) values
  ('Babá e cuidados infantis'), ('Cuidador de idosos'), ('Personal trainer'), ('Fotografia e vídeo'),
  ('Design gráfico'), ('Marketing digital'), ('Contabilidade e MEI'), ('Consultoria jurídica'),
  ('Motoboy e entregas'), ('Motorista aplicativo'), ('Chaveiro'), ('Serralheria e grades'),
  ('Gesso e drywall'), ('Impermeabilização'), ('Dedetização e controle de pragas'),
  ('Lavagem de estofados e carpetes'), ('Costura e ajustes de roupas'), ('Som, luz e eventos'),
  ('Buffet e cozinha para eventos'), ('Nutrição'), ('Psicologia (online ou presencial)'),
  ('Aulas particulares'), ('Tradução e revisão de textos'), ('Pet shop e banho e tosa'),
  ('Móveis planejados'), ('Mecânica automotiva'), ('Estética automotiva'), ('TI e suporte em informática'),
  ('Instalação de câmeras e alarmes'), ('Passadeira e arrumação'), ('Organização de ambientes'),
  ('Paisagismo'), ('Reforma de banheiro'), ('Reforma de cozinha'), ('Pisos e revestimentos'),
  ('Solda e manutenção industrial'), ('Limpeza pós-obra'), ('Frete e mudanças'),
  ('Montagem de equipamentos de academia'), ('Instalação de TV e painéis'), ('Automação residencial'),
  ('Cerca elétrica e interfone'), ('Telhados e calhas'), ('Demolição leve'), ('Forro PVC e mineral'),
  ('Instalação de ventilador de teto'), ('Conserto de eletrodomésticos'), ('Costura de cortinas'),
  ('Podologia'), ('Massoterapia e quiropraxia'), ('Cabeleireiro e barbearia'),
  ('Manicure e design de sobrancelhas'), ('Confeitaria e bolos sob encomenda'), ('Catering corporativo')
on conflict (nome) do nothing;

-- =============================================================================
-- Fim do alinhamento. Se algum ALTER TYPE tipo falhar, envie a mensagem de erro.
-- =============================================================================
