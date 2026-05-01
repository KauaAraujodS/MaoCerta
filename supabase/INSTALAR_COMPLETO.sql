-- =============================================================================
-- MaoCerta — instalação completa do banco (UMA vez no Supabase SQL Editor)
-- Dashboard → SQL Editor → New query → colar este arquivo → Run
--
-- Se algum erro disser que já existe (types/tables), seu banco já tinha parte
-- do schema: comente só o bloco que falhou ou peça ajuda com a mensagem exata.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------- 001
-- Tipos enumerados
create type tipo_usuario as enum ('cliente', 'profissional');
create type status_demanda as enum ('aberta', 'em_andamento', 'concluida', 'cancelada');
create type status_proposta as enum ('pendente', 'aceita', 'recusada');
create type status_acordo as enum ('em_andamento', 'concluido', 'cancelado');

-- Perfis dos usuários (extende o auth.users do Supabase)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  tipo tipo_usuario not null,
  telefone text,
  bio text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Categorias de serviço (ex: elétrica, pintura, limpeza...)
create table categorias (
  id serial primary key,
  nome text not null unique
);

-- Serviços que o profissional oferece
create table servicos (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) not null,
  descricao text not null,
  valor_hora numeric(10, 2),
  created_at timestamp with time zone default now()
);

-- Demandas postadas por clientes
create table demandas (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) not null,
  titulo text not null,
  descricao text not null,
  status status_demanda default 'aberta' not null,
  created_at timestamp with time zone default now()
);

-- Propostas de profissionais para uma demanda
create table propostas (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid references demandas(id) on delete cascade not null,
  profissional_id uuid references profiles(id) on delete cascade not null,
  mensagem text not null,
  valor_proposto numeric(10, 2) not null,
  prazo text not null,
  status status_proposta default 'pendente' not null,
  created_at timestamp with time zone default now()
);

-- Acordo fechado entre cliente e profissional
create table acordos (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid references demandas(id),
  cliente_id uuid references profiles(id) not null,
  profissional_id uuid references profiles(id) not null,
  valor numeric(10, 2) not null,
  prazo text not null,
  status status_acordo default 'em_andamento' not null,
  created_at timestamp with time zone default now()
);

-- Mensagens entre cliente e profissional dentro de um acordo
create table mensagens (
  id uuid default gen_random_uuid() primary key,
  acordo_id uuid references acordos(id) on delete cascade not null,
  remetente_id uuid references profiles(id) not null,
  conteudo text not null,
  created_at timestamp with time zone default now()
);

-- Algumas categorias iniciais
insert into categorias (nome) values
  ('Elétrica'),
  ('Hidráulica'),
  ('Pintura'),
  ('Limpeza'),
  ('Marcenaria'),
  ('Jardinagem'),
  ('Informática'),
  ('Montagem de móveis'),
  ('Ar-condicionado'),
  ('Reforma geral');

-- --------------------------------------------------------------------------- 002
alter table profiles add column if not exists cidade text;

-- --------------------------------------------------------------------------- 003
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars são visíveis publicamente" on storage.objects;
create policy "Avatars são visíveis publicamente"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Usuário envia seu próprio avatar" on storage.objects;
create policy "Usuário envia seu próprio avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Usuário atualiza seu próprio avatar" on storage.objects;
create policy "Usuário atualiza seu próprio avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Usuário remove seu próprio avatar" on storage.objects;
create policy "Usuário remove seu próprio avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------------------- 004
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_usuario') then
    create type tipo_usuario as enum ('cliente', 'profissional', 'administrador');
  else
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'tipo_usuario' and e.enumlabel = 'administrador'
    ) then
      alter type tipo_usuario add value 'administrador';
    end if;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plano_usuario') then
    create type plano_usuario as enum ('free', 'basico', 'premium');
  end if;
end$$;

alter table profiles
  add column if not exists plano plano_usuario not null default 'free',
  add column if not exists plano_atualizado_em timestamp with time zone default now();

-- --------------------------------------------------------------------------- 005
alter table profiles add column if not exists bio text;

-- --------------------------------------------------------------------------- 006
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
    coalesce((new.raw_user_meta_data->>'tipo')::tipo_usuario, 'cliente')
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
  coalesce((u.raw_user_meta_data->>'tipo')::tipo_usuario, 'cliente')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- --------------------------------------------------------------------------- 007
create table if not exists profissional_categorias (
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (profissional_id, categoria_id)
);

alter table profiles
  add column if not exists experiencia_anos int,
  add column if not exists historico_profissional text;

create table if not exists solicitacoes (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references profiles(id) on delete cascade not null,
  profissional_id uuid references profiles(id) on delete cascade not null,
  titulo text not null,
  descricao text not null,
  status text not null default 'pendente',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists documentos_validacao (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid references profiles(id) on delete cascade not null,
  tipo_documento text not null,
  arquivo_url text not null,
  observacao text,
  status text not null default 'enviado',
  criado_em timestamp with time zone default now(),
  analisado_em timestamp with time zone
);

-- --------------------------------------------------------------------------- 008
alter table profissional_categorias enable row level security;
alter table solicitacoes enable row level security;
alter table documentos_validacao enable row level security;

drop policy if exists "profissional gerencia suas categorias" on profissional_categorias;
create policy "profissional gerencia suas categorias"
on profissional_categorias
for all
to authenticated
using (auth.uid() = profissional_id)
with check (auth.uid() = profissional_id);

drop policy if exists "categorias profissionais visiveis" on profissional_categorias;
create policy "categorias profissionais visiveis"
on profissional_categorias
for select
to authenticated
using (true);

drop policy if exists "cliente cria solicitacao" on solicitacoes;
create policy "cliente cria solicitacao"
on solicitacoes
for insert
to authenticated
with check (auth.uid() = cliente_id);

drop policy if exists "cliente ve suas solicitacoes" on solicitacoes;
create policy "cliente ve suas solicitacoes"
on solicitacoes
for select
to authenticated
using (auth.uid() = cliente_id);

drop policy if exists "profissional ve e atualiza solicitacoes recebidas" on solicitacoes;
create policy "profissional ve e atualiza solicitacoes recebidas"
on solicitacoes
for all
to authenticated
using (auth.uid() = profissional_id)
with check (auth.uid() = profissional_id);

drop policy if exists "profissional gerencia documentos" on documentos_validacao;
create policy "profissional gerencia documentos"
on documentos_validacao
for all
to authenticated
using (auth.uid() = profissional_id)
with check (auth.uid() = profissional_id);

drop policy if exists "admin visualiza documentos" on documentos_validacao;
create policy "admin visualiza documentos"
on documentos_validacao
for select
to authenticated
using (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.tipo = 'administrador'
  )
);

insert into storage.buckets (id, name, public)
values ('documentos-validacao', 'documentos-validacao', true)
on conflict (id) do nothing;

drop policy if exists "upload proprio documento" on storage.objects;
create policy "upload proprio documento"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos-validacao'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ver proprio documento" on storage.objects;
create policy "ver proprio documento"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos-validacao'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- --------------------------------------------------------------------------- 009
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

drop policy if exists "profissional ve e atualiza solicitacoes recebidas" on solicitacoes;

create policy "profissional ve solicitacoes recebidas"
  on solicitacoes for select
  to authenticated
  using (auth.uid() = profissional_id);

create policy "profissional atualiza solicitacoes recebidas"
  on solicitacoes for update
  to authenticated
  using (auth.uid() = profissional_id)
  with check (auth.uid() = profissional_id);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin"
  on profiles for select
  to authenticated
  using (id = auth.uid() or public.is_administrator());

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin"
  on profiles for update
  to authenticated
  using (id = auth.uid() or public.is_administrator())
  with check (id = auth.uid() or public.is_administrator());

alter table categorias enable row level security;

drop policy if exists "categorias_select_auth" on categorias;
create policy "categorias_select_auth"
  on categorias for select
  to authenticated
  using (true);

alter table servicos enable row level security;

drop policy if exists "servicos_select_own" on servicos;
create policy "servicos_select_own"
  on servicos for select
  to authenticated
  using (profissional_id = auth.uid());

drop policy if exists "servicos_insert_own" on servicos;
create policy "servicos_insert_own"
  on servicos for insert
  to authenticated
  with check (profissional_id = auth.uid());

drop policy if exists "servicos_update_own" on servicos;
create policy "servicos_update_own"
  on servicos for update
  to authenticated
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

drop policy if exists "servicos_delete_own" on servicos;
create policy "servicos_delete_own"
  on servicos for delete
  to authenticated
  using (profissional_id = auth.uid());

alter table demandas enable row level security;

drop policy if exists "demandas_select_cliente_ou_abertas" on demandas;
create policy "demandas_select_cliente_ou_abertas"
  on demandas for select
  to authenticated
  using (
    cliente_id = auth.uid()
    or status = 'aberta'::status_demanda
  );

drop policy if exists "demandas_insert_cliente" on demandas;
create policy "demandas_insert_cliente"
  on demandas for insert
  to authenticated
  with check (cliente_id = auth.uid());

drop policy if exists "demandas_update_cliente" on demandas;
create policy "demandas_update_cliente"
  on demandas for update
  to authenticated
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

alter table propostas enable row level security;

drop policy if exists "propostas_select_participantes" on propostas;
create policy "propostas_select_participantes"
  on propostas for select
  to authenticated
  using (
    profissional_id = auth.uid()
    or exists (
      select 1 from demandas d
      where d.id = demanda_id and d.cliente_id = auth.uid()
    )
  );

drop policy if exists "propostas_insert_profissional" on propostas;
create policy "propostas_insert_profissional"
  on propostas for insert
  to authenticated
  with check (
    auth.uid() = profissional_id
    and exists (
      select 1 from demandas d
      where d.id = demanda_id
        and d.status = 'aberta'::status_demanda
        and d.cliente_id <> auth.uid()
    )
  );

drop policy if exists "propostas_update_profissional" on propostas;
create policy "propostas_update_profissional"
  on propostas for update
  to authenticated
  using (profissional_id = auth.uid())
  with check (profissional_id = auth.uid());

drop policy if exists "atualiza proprio documento validacao" on storage.objects;
create policy "atualiza proprio documento validacao"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documentos-validacao'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documentos-validacao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "remove proprio documento validacao" on storage.objects;
create policy "remove proprio documento validacao"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documentos-validacao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------------------- 010
insert into categorias (nome) values
  ('Babá e cuidados infantis'),
  ('Cuidador de idosos'),
  ('Personal trainer'),
  ('Fotografia e vídeo'),
  ('Design gráfico'),
  ('Marketing digital'),
  ('Contabilidade e MEI'),
  ('Consultoria jurídica'),
  ('Motoboy e entregas'),
  ('Motorista aplicativo'),
  ('Chaveiro'),
  ('Serralheria e grades'),
  ('Gesso e drywall'),
  ('Impermeabilização'),
  ('Dedetização e controle de pragas'),
  ('Lavagem de estofados e carpetes'),
  ('Costura e ajustes de roupas'),
  ('Som, luz e eventos'),
  ('Buffet e cozinha para eventos'),
  ('Nutrição'),
  ('Psicologia (online ou presencial)'),
  ('Aulas particulares'),
  ('Tradução e revisão de textos'),
  ('Pet shop e banho e tosa'),
  ('Móveis planejados'),
  ('Mecânica automotiva'),
  ('Estética automotiva'),
  ('TI e suporte em informática'),
  ('Instalação de câmeras e alarmes'),
  ('Passadeira e arrumação'),
  ('Organização de ambientes'),
  ('Paisagismo'),
  ('Reforma de banheiro'),
  ('Reforma de cozinha'),
  ('Pisos e revestimentos'),
  ('Solda e manutenção industrial'),
  ('Limpeza pós-obra'),
  ('Frete e mudanças'),
  ('Montagem de equipamentos de academia'),
  ('Instalação de TV e painéis'),
  ('Automação residencial'),
  ('Cerca elétrica e interfone'),
  ('Telhados e calhas'),
  ('Demolição leve'),
  ('Forro PVC e mineral'),
  ('Instalação de ventilador de teto'),
  ('Conserto de eletrodomésticos'),
  ('Costura de cortinas'),
  ('Podologia'),
  ('Massoterapia e quiropraxia'),
  ('Cabeleireiro e barbearia'),
  ('Manicure e design de sobrancelhas'),
  ('Confeitaria e bolos sob encomenda'),
  ('Catering corporativo')
on conflict (nome) do nothing;

-- =============================================================================
-- Fim. Verifique em Table Editor: profiles, categorias, demandas, etc.
-- =============================================================================
