-- Tipos enumerados
create type tipo_usuario as enum ('cliente', 'profissional');
create type status_demanda as enum ('aberta', 'em_andamento', 'concluida', 'cancelada');
create type status_proposta as enum ('pendente', 'aceita', 'recusada');
create type status_acordo as enum ('em_andamento', 'concluido', 'cancelado');

-- Perfis dos usuários (extende o auth.users do Supabase)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  tipo tipo_usuario not null,
  telefone text,
  bio text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Categorias de serviço (ex: elétrica, pintura, limpeza...)
create table categorias (
  id serial primary key,
  nome text not null unique
);

-- Serviços que o profissional oferece
create table servicos (
  id uuid default gen_random_uuid() primary key,
  profissional_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) not null,
  descricao text not null,
  valor_hora numeric(10, 2),
  created_at timestamp with time zone default now()
);

-- Demandas postadas por clientes
create table demandas (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references profiles(id) on delete cascade not null,
  categoria_id int references categorias(id) not null,
  titulo text not null,
  descricao text not null,
  status status_demanda default 'aberta' not null,
  created_at timestamp with time zone default now()
);

-- Propostas de profissionais para uma demanda
create table propostas (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid references demandas(id) on delete cascade not null,
  profissional_id uuid references profiles(id) on delete cascade not null,
  mensagem text not null,
  valor_proposto numeric(10, 2) not null,
  prazo text not null,
  status status_proposta default 'pendente' not null,
  created_at timestamp with time zone default now()
);

-- Acordo fechado entre cliente e profissional
create table acordos (
  id uuid default gen_random_uuid() primary key,
  demanda_id uuid references demandas(id),
  cliente_id uuid references profiles(id) not null,
  profissional_id uuid references profiles(id) not null,
  valor numeric(10, 2) not null,
  prazo text not null,
  status status_acordo default 'em_andamento' not null,
  created_at timestamp with time zone default now()
);

-- Mensagens entre cliente e profissional dentro de um acordo
create table mensagens (
  id uuid default gen_random_uuid() primary key,
  acordo_id uuid references acordos(id) on delete cascade not null,
  remetente_id uuid references profiles(id) not null,
  conteudo text not null,
  created_at timestamp with time zone default now()
);

-- Algumas categorias iniciais
insert into categorias (nome) values
  ('Elétrica'),
  ('Hidráulica'),
  ('Pintura'),
  ('Limpeza'),
  ('Marcenaria'),
  ('Jardinagem'),
  ('Informática'),
  ('Montagem de móveis'),
  ('Ar-condicionado'),
  ('Reforma geral');
