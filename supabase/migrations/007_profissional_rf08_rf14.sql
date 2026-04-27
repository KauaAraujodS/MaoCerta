-- RF08 ao RF14: recursos do prestador por plano

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_solicitacao_profissional') then
    create type status_solicitacao_profissional as enum ('pendente', 'aceita', 'recusada', 'concluida');
  end if;

  if not exists (select 1 from pg_type where typname = 'status_documento_profissional') then
    create type status_documento_profissional as enum ('pendente', 'aprovado', 'rejeitado');
  end if;
end
$$;

alter table profiles
  add column if not exists experiencia_anos integer check (experiencia_anos is null or experiencia_anos >= 0),
  add column if not exists historico_profissional text;

alter table servicos
  add column if not exists titulo text;

update servicos
set titulo = coalesce(nullif(titulo, ''), descricao)
where titulo is null;

create table if not exists profissional_categorias (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id integer references categorias(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  constraint profissional_categorias_unica unique (profissional_id, categoria_id)
);

create table if not exists solicitacoes_profissionais (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references profiles(id) on delete cascade not null,
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id integer references categorias(id) on delete set null,
  titulo text not null,
  descricao text not null,
  data_preferida date,
  orcamento_sugerido numeric(10, 2),
  status status_solicitacao_profissional not null default 'pendente',
  created_at timestamp with time zone default now()
);

create table if not exists documentos_profissionais (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid references profiles(id) on delete cascade not null,
  tipo_documento text not null,
  nome_arquivo text not null,
  arquivo_path text not null unique,
  mime_type text,
  status status_documento_profissional not null default 'pendente',
  observacoes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_profissional_categorias_profissional_id
  on profissional_categorias (profissional_id);

create index if not exists idx_servicos_profissional_id
  on servicos (profissional_id);

create index if not exists idx_solicitacoes_profissionais_profissional_id
  on solicitacoes_profissionais (profissional_id);

create index if not exists idx_solicitacoes_profissionais_cliente_id
  on solicitacoes_profissionais (cliente_id);

create index if not exists idx_documentos_profissionais_profissional_id
  on documentos_profissionais (profissional_id);

create or replace function public.obter_limite_plano(plano plano_usuario, recurso text)
returns integer
language sql
immutable
as $$
  select case recurso
    when 'categorias' then case plano when 'free' then 1 when 'basico' then 3 else 999 end
    when 'servicos' then case plano when 'free' then 3 when 'basico' then 8 else 999 end
    when 'propostas_pendentes' then case plano when 'free' then 2 when 'basico' then 6 else 999 end
    when 'demandas_visiveis' then case plano when 'free' then 6 when 'basico' then 18 else 999 end
    else 999
  end;
$$;

create or replace function public.validar_limite_plano_profissional()
returns trigger
language plpgsql
as $$
declare
  plano_atual plano_usuario;
  limite integer;
  total_atual integer;
begin
  select coalesce(plano, 'free')
  into plano_atual
  from profiles
  where id = new.profissional_id;

  if plano_atual is null then
    plano_atual := 'free';
  end if;

  if tg_table_name = 'profissional_categorias' then
    limite := public.obter_limite_plano(plano_atual, 'categorias');

    select count(*)
    into total_atual
    from profissional_categorias
    where profissional_id = new.profissional_id;

    if total_atual >= limite then
      raise exception 'Seu plano permite cadastrar até % categoria(s) de atuação.', limite;
    end if;
  elsif tg_table_name = 'servicos' then
    limite := public.obter_limite_plano(plano_atual, 'servicos');

    select count(*)
    into total_atual
    from servicos
    where profissional_id = new.profissional_id;

    if total_atual >= limite then
      raise exception 'Seu plano permite cadastrar até % serviço(s).', limite;
    end if;
  elsif tg_table_name = 'propostas' then
    limite := public.obter_limite_plano(plano_atual, 'propostas_pendentes');

    select count(*)
    into total_atual
    from propostas
    where profissional_id = new.profissional_id
      and status = 'pendente';

    if total_atual >= limite then
      raise exception 'Seu plano permite manter até % proposta(s) pendente(s) ao mesmo tempo.', limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_limite_profissional_categorias on profissional_categorias;
create trigger validar_limite_profissional_categorias
  before insert on profissional_categorias
  for each row execute procedure public.validar_limite_plano_profissional();

drop trigger if exists validar_limite_servicos on servicos;
create trigger validar_limite_servicos
  before insert on servicos
  for each row execute procedure public.validar_limite_plano_profissional();

drop trigger if exists validar_limite_propostas on propostas;
create trigger validar_limite_propostas
  before insert on propostas
  for each row execute procedure public.validar_limite_plano_profissional();

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'documentos-profissionais') then
    insert into storage.buckets (id, name, public)
    values ('documentos-profissionais', 'documentos-profissionais', false);
  end if;
end
$$;

drop policy if exists "Profissional vê seus documentos" on storage.objects;
create policy "Profissional vê seus documentos"
  on storage.objects for select
  using (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profissional envia seus documentos" on storage.objects;
create policy "Profissional envia seus documentos"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profissional atualiza seus documentos" on storage.objects;
create policy "Profissional atualiza seus documentos"
  on storage.objects for update
  using (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profissional remove seus documentos" on storage.objects;
create policy "Profissional remove seus documentos"
  on storage.objects for delete
  using (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
