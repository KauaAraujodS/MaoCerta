# Publica na Vercel com variáveis do Supabase (Production).
# Pré-requisito: `npx vercel login` e `npx vercel link` na raiz do repositório (conta/time corretos).
#
# Exemplo:
#   .\scripts\publish-vercel.ps1 -SupabaseUrl "https://xxxxx.supabase.co" -SupabaseKey "sb_publishable_..."

param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$SupabaseKey
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --value $SupabaseUrl --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --value $SupabaseKey --yes --sensitive
npx vercel deploy --prod --yes
