-- ============================================================
-- Avaliações, denúncias, bloqueios e coluna estado em profiles
-- ============================================================

-- 1) Coluna estado (UF) em profiles. Cidade já existia.
alter table public.profiles add column if not exists estado text;

-- 2) Avaliações: cada participante de um atendimento concluído pode avaliar a contraparte
create table if not exists public.avaliacoes (
  id uuid default gen_random_uuid() primary key,
  atendimento_id uuid not null references public.solicitacoes(id) on delete cascade,
  avaliador_id uuid not null references public.profiles(id) on delete cascade,
  avaliado_id uuid not null references public.profiles(id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  created_at timestamptz default now(),
  unique (atendimento_id, avaliador_id)
);

create index if not exists idx_avaliacoes_avaliado on public.avaliacoes (avaliado_id);

alter table public.avaliacoes enable row level security;

-- Qualquer autenticado pode ler avaliações (são públicas para alimentar perfil)
drop policy if exists "avaliacoes_select_public" on public.avaliacoes;
create policy "avaliacoes_select_public" on public.avaliacoes
  for select to authenticated using (true);

-- Só insere se for participante do atendimento concluído e avaliando a contraparte
drop policy if exists "avaliacoes_insert_participante" on public.avaliacoes;
create policy "avaliacoes_insert_participante" on public.avaliacoes
  for insert to authenticated
  with check (
    avaliador_id = auth.uid()
    and avaliador_id <> avaliado_id
    and exists (
      select 1 from public.solicitacoes s
      where s.id = atendimento_id
        and s.status = 'concluida'
        and (
          (s.cliente_id = auth.uid() and s.profissional_id = avaliado_id)
          or (s.profissional_id = auth.uid() and s.cliente_id = avaliado_id)
        )
    )
  );

-- 3) Denúncias
create table if not exists public.denuncias (
  id uuid default gen_random_uuid() primary key,
  denunciante_id uuid not null references public.profiles(id) on delete cascade,
  denunciado_id uuid not null references public.profiles(id) on delete cascade,
  motivo text not null,
  descricao text,
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida', 'arquivada')),
  created_at timestamptz default now(),
  analisado_em timestamptz
);

create index if not exists idx_denuncias_denunciado on public.denuncias (denunciado_id);

alter table public.denuncias enable row level security;

drop policy if exists "denuncias_select_proprio_ou_admin" on public.denuncias;
create policy "denuncias_select_proprio_ou_admin" on public.denuncias
  for select to authenticated
  using (denunciante_id = auth.uid() or public.is_administrator());

drop policy if exists "denuncias_insert_proprio" on public.denuncias;
create policy "denuncias_insert_proprio" on public.denuncias
  for insert to authenticated
  with check (denunciante_id = auth.uid() and denunciante_id <> denunciado_id);

drop policy if exists "denuncias_update_admin" on public.denuncias;
create policy "denuncias_update_admin" on public.denuncias
  for update to authenticated
  using (public.is_administrator());

-- 4) Bloqueios (cliente bloqueia prestador ou vice-versa — some das listas)
create table if not exists public.bloqueios (
  bloqueador_id uuid not null references public.profiles(id) on delete cascade,
  bloqueado_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (bloqueador_id, bloqueado_id),
  check (bloqueador_id <> bloqueado_id)
);

alter table public.bloqueios enable row level security;

drop policy if exists "bloqueios_select_proprio" on public.bloqueios;
create policy "bloqueios_select_proprio" on public.bloqueios
  for select to authenticated using (bloqueador_id = auth.uid());

drop policy if exists "bloqueios_insert_proprio" on public.bloqueios;
create policy "bloqueios_insert_proprio" on public.bloqueios
  for insert to authenticated with check (bloqueador_id = auth.uid());

drop policy if exists "bloqueios_delete_proprio" on public.bloqueios;
create policy "bloqueios_delete_proprio" on public.bloqueios
  for delete to authenticated using (bloqueador_id = auth.uid());
