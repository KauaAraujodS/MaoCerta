-- RF04: incluir o tipo "administrador" no enum de perfis
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

-- RF07: controle de plano do usuário
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plano_usuario') then
    create type plano_usuario as enum ('free', 'basico', 'premium');
  end if;
end$$;

alter table profiles
  add column if not exists plano plano_usuario not null default 'free',
  add column if not exists plano_atualizado_em timestamp with time zone default now();
