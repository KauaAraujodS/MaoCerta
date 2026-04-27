-- Adiciona cidade ao perfil para uso na tela "Conta" do cliente
alter table profiles add column if not exists cidade text;
