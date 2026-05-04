-- RF08..RF14: estruturas adicionais para operação do profissional

-- Categorias de atuação por profissional (RF08)
create table if not exists profissional_categorias (
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (profissional_id, categoria_id)
);

-- Extensões de perfil para RF10 (experiência e histórico)
alter table profiles
  add column if not exists experiencia_anos int,
  add column if not exists historico_profissional text;

-- Solicitações diretas de cliente para profissional (RF12)
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

-- Documentação para validação do profissional (RF11)
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
