-- Habilita Supabase Realtime para a tabela de mensagens.
-- Sem isso, o componente de chat não recebe INSERTs em tempo real
-- (precisa atualizar a página manualmente).

-- Garante que a publication existe (Supabase já cria por padrão)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;

-- Adiciona a tabela à publicação (se ainda não estiver)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mensagens_atendimento'
  ) then
    alter publication supabase_realtime add table public.mensagens_atendimento;
  end if;
end$$;

-- Garante REPLICA IDENTITY FULL para que payloads de DELETE/UPDATE também venham com dados antigos
alter table public.mensagens_atendimento replica identity full;
