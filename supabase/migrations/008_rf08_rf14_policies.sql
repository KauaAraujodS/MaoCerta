-- RLS e policies para RF08..RF14

alter table profissional_categorias enable row level security;
alter table solicitacoes enable row level security;
alter table documentos_validacao enable row level security;

-- profissional_categorias
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

-- solicitacoes
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

-- documentos_validacao
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

-- bucket de documentos (idempotente)
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
