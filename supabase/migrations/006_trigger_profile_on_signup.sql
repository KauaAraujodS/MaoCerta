-- Cria automaticamente uma linha em profiles quando um novo usuário se cadastra.
-- Os dados nome/telefone/tipo vêm do raw_user_meta_data passado no signUp.

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
  for each row execute procedure public.handle_new_user();

-- Backfill: cria linhas para usuários que já existem mas não têm profile
insert into public.profiles (id, nome, telefone, tipo)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'telefone',
  coalesce((u.raw_user_meta_data->>'tipo')::tipo_usuario, 'cliente')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
