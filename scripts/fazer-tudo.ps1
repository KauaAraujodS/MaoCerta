# Aplica migrations no Supabase (projeto amrhutneryrkwkxxinzz) e, se configurado, deploy na Vercel.
#
# Antes:
#   1) Copie scripts\secrets.ps1.example para scripts\secrets.ps1
#   2) Preencha SUPABASE_ACCESS_TOKEN (sbp_...), SUPABASE_DB_PASSWORD e opcionalmente VERCEL_TOKEN
#
# Depois, na raiz do repo:
#   .\scripts\fazer-tudo.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$secretsPath = Join-Path $PSScriptRoot "secrets.ps1"
if (-not (Test-Path $secretsPath)) {
  Write-Host ""
  Write-Host "Falta scripts\secrets.ps1" -ForegroundColor Red
  Write-Host "  Copie:  copy scripts\secrets.ps1.example scripts\secrets.ps1" -ForegroundColor Yellow
  Write-Host "  Edite secrets.ps1 com token sbp_ e senha do Postgres." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

. $secretsPath

if (-not $env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_ACCESS_TOKEN -eq "sbp_COLE_AQUI") {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN valido (sbp_...) em scripts\secrets.ps1" -ForegroundColor Red
  exit 1
}
if ($env:SUPABASE_ACCESS_TOKEN -notmatch '^sbp_') {
  Write-Host "SUPABASE_ACCESS_TOKEN deve comecar com sbp_ (token em Account -> Access Tokens, NAO a anon key do projeto)." -ForegroundColor Red
  exit 1
}
if (-not $env:SUPABASE_DB_PASSWORD -or $env:SUPABASE_DB_PASSWORD -eq "COLE_AQUI") {
  Write-Host "Defina SUPABASE_DB_PASSWORD em scripts\secrets.ps1 (senha Postgres no painel do projeto)." -ForegroundColor Red
  exit 1
}

Write-Host ">> Supabase: link + db push (migrations)..." -ForegroundColor Cyan
npx supabase@latest link --project-ref amrhutneryrkwkxxinzz --password $env:SUPABASE_DB_PASSWORD --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx supabase@latest db push --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> Banco configurado (migrations aplicadas)." -ForegroundColor Green

if ($env:VERCEL_TOKEN -and $env:VERCEL_TOKEN.Trim().Length -gt 0) {
  Write-Host ">> Vercel: deploy --prod..." -ForegroundColor Cyan
  npx vercel@latest deploy --prod --yes --token $env:VERCEL_TOKEN
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host ">> Deploy Vercel concluido." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "VERCEL_TOKEN vazio - deploy pelo CLI ignorado." -ForegroundColor Yellow
  Write-Host "  Opcao A: adicione VERCEL_TOKEN em scripts\secrets.ps1 e rode de novo este script." -ForegroundColor Gray
  Write-Host '  Opcao B: na Vercel, importe o repo, defina env vars (NEXT_PUBLIC_* e SUPABASE_SERVICE_ROLE_KEY) e de Git push.' -ForegroundColor Gray
  Write-Host ""
}

Write-Host 'Lembrete: na Vercel, configure as variaveis do Supabase (Settings -> API do projeto):' -ForegroundColor Cyan
Write-Host '  NEXT_PUBLIC_SUPABASE_URL=https://amrhutneryrkwkxxinzz.supabase.co' -ForegroundColor Gray
Write-Host '  NEXT_PUBLIC_SUPABASE_ANON_KEY=(anon public, JWT comecando com eyJ)' -ForegroundColor Gray
Write-Host '  SUPABASE_SERVICE_ROLE_KEY=(service_role secret, JWT comecando com eyJ)' -ForegroundColor Gray
