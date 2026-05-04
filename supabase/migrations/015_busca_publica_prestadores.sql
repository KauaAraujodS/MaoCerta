-- Permite que qualquer usuário autenticado liste perfis de prestadores
-- (necessário pra tela de busca do cliente). O cliente só pode ver
-- profiles do tipo 'profissional' que não sejam o dele próprio.

drop policy if exists "profiles_select_prestadores_publicos" on public.profiles;
create policy "profiles_select_prestadores_publicos"
  on public.profiles for select
  to authenticated
  using (
    tipo = 'profissional'::tipo_usuario
  );

-- Garante que categorias e profissional_categorias são legíveis por todos
-- (já existiam policies em migrations anteriores, idempotente)
drop policy if exists "categorias_select_auth" on public.categorias;
create policy "categorias_select_auth" on public.categorias
  for select to authenticated using (true);

drop policy if exists "categorias profissionais visiveis" on public.profissional_categorias;
create policy "categorias profissionais visiveis"
  on public.profissional_categorias for select
  to authenticated using (true);
