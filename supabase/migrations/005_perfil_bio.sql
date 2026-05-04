-- Coluna de descrição/biografia do perfil (estava no 001 mas faltou no banco)
alter table profiles add column if not exists bio text;
