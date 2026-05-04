-- RLS nas tabelas principais do app + correção de policies em solicitacoes
-- Storage: permitir update/delete no bucket documentos-validacao (upsert)

-- Evita recursão de RLS ao checar tipo administrador dentro de policies em profiles
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

-- ---------------------------------------------------------------------------
-- solicitacoes: remover FOR ALL do profissional (evita insert com profissional_id = self e cliente_id arbitrário)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- categorias (leitura para usuários logados)
-- ---------------------------------------------------------------------------
alter table categorias enable row level security;

drop policy if exists "categorias_select_auth" on categorias;
create policy "categorias_select_auth"
  on categorias for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- servicos (apenas o profissional dono)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- demandas
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- propostas
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Storage: documentos-validacao — update/delete para upsert e limpeza
-- ---------------------------------------------------------------------------
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
