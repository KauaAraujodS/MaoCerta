# Requer: token de acesso pessoal do Supabase + senha do banco (Settings -> Database)
# 1) Crie um token em: https://supabase.com/dashboard/account/tokens
# 2) Copie a senha do Postgres em: Project Settings -> Database -> Database password
#
# Uso (PowerShell):
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   $env:SUPABASE_DB_PASSWORD = "sua_senha_postgres"
#   .\scripts\aplicar-banco-supabase.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)" -ForegroundColor Yellow
  exit 1
}
if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Host "Defina SUPABASE_DB_PASSWORD (senha do Postgres no painel do projeto)" -ForegroundColor Yellow
  exit 1
}

Write-Host ">> Vinculando projeto amrhutneryrkwkxxinzz..." -ForegroundColor Cyan
npx supabase@latest link --project-ref amrhutneryrkwkxxinzz --password $env:SUPABASE_DB_PASSWORD --yes

Write-Host ">> Enviando migrations (supabase db push)..." -ForegroundColor Cyan
npx supabase@latest db push --yes

Write-Host ">> Concluído." -ForegroundColor Green
