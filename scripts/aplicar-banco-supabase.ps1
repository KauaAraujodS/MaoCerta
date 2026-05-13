# Aplica todas as migrations em supabase/migrations no projeto remoto amrhutneryrkwkxxinzz.
#
# O Supabase CLI NÃO usa "publishable key" ou strings "sb_secret_..." genéricas:
#   - SUPABASE_ACCESS_TOKEN = token pessoal da CONTA Supabase (formato sbp_...) em:
#     https://supabase.com/dashboard/account/tokens
#   - SUPABASE_DB_PASSWORD = senha do Postgres do projeto em:
#     Dashboard do projeto → Settings → Database → Database password
#
# Uso (PowerShell), na pasta do repositório:
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   $env:SUPABASE_DB_PASSWORD = "sua_senha_postgres"
#   .\scripts\aplicar-banco-supabase.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN (token pessoal sbp_... em https://supabase.com/dashboard/account/tokens)" -ForegroundColor Yellow
  exit 1
}
if ($env:SUPABASE_ACCESS_TOKEN -notmatch '^sbp_') {
  Write-Host "AVISO: o token de acesso do Supabase deve começar com sbp_. Verifique se copiou o token da pagina Account Tokens (nao a anon key do projeto)." -ForegroundColor Yellow
}
if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Host "Defina SUPABASE_DB_PASSWORD (senha do Postgres: Project Settings -> Database)" -ForegroundColor Yellow
  exit 1
}

Write-Host ">> Vinculando projeto amrhutneryrkwkxxinzz..." -ForegroundColor Cyan
npx supabase@latest link --project-ref amrhutneryrkwkxxinzz --password $env:SUPABASE_DB_PASSWORD --yes

Write-Host ">> Enviando migrations (supabase db push)..." -ForegroundColor Cyan
npx supabase@latest db push --yes

Write-Host ">> Concluído. Proximos passos:" -ForegroundColor Green
Write-Host "   1) Na Vercel, defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (Settings -> API do projeto Supabase)." -ForegroundColor Gray
Write-Host "   2) Agende um cron (ex. Vercel Cron ou pg_cron) para chamar fn_financeiro_processar_liberacoes_agendadas se usar a migracao 021." -ForegroundColor Gray
