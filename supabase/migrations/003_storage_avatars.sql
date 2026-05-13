-- Bucket público para fotos de perfil
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Qualquer pessoa pode ver os avatares (são públicos)
drop policy if exists "Avatars são visíveis publicamente" on storage.objects;
create policy "Avatars são visíveis publicamente"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- O dono só pode subir/atualizar/deletar arquivos dentro da sua própria pasta
-- Convenção: o caminho do arquivo começa com o id do usuário (ex: <user_id>/foto.jpg)
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
