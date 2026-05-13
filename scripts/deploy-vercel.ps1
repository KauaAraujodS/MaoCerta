# Deploy de producao na Vercel (nao interativo).
#
# 1) Crie um token em https://vercel.com/account/tokens
# 2) No painel da Vercel, crie o projeto e importe o repo (ou use `vercel link` uma vez com login).
# 3) Configure as Environment Variables (mesmas chaves que .env.local.example).
#
# Uso:
#   $env:VERCEL_TOKEN = "..."
#   .\scripts\deploy-vercel.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $env:VERCEL_TOKEN) {
  Write-Host "Defina VERCEL_TOKEN (https://vercel.com/account/tokens)" -ForegroundColor Yellow
  exit 1
}

npx vercel@latest deploy --prod --yes --token $env:VERCEL_TOKEN
