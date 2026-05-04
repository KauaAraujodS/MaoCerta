# MaoCerta

Aplicativo web para conectar pessoas que precisam de serviços com profissionais disponíveis na região. O cliente pode buscar um profissional ou postar uma demanda, o profissional encontra e os dois entram em contato para combinar os detalhes do serviço.

## Tecnologias usadas

- **Next.js 14** — framework React com rotas de API integradas
- **Supabase** — banco de dados PostgreSQL + autenticação + storage
- **Tailwind CSS** — estilização
- **Vercel** — hospedagem

## Como rodar o projeto localmente

### Pré-requisitos

- Node.js 18 ou superior
- Conta no [Supabase](https://supabase.com) com um projeto criado

### Passo a passo

1. **Clone o repositório**

```bash
git clone https://github.com/KauaAraujodS/MaoCerta.git
cd MaoCerta
```

2. **Instale as dependências**

```bash
npm install
```

3. **Configure as variáveis de ambiente**

Copie o arquivo de exemplo e preencha com as chaves do projeto no Supabase:

```bash
cp .env.local.example .env.local
```

As chaves ficam em **Supabase → Settings → API**. Para o time da mão certa, peça as chaves no grupo.

4. **Configure o banco de dados**

Há duas opções:

- **Opção rápida (recomendada):** rode o script único [supabase/ALINHAR_BANCO_EXISTENTE.sql](supabase/ALINHAR_BANCO_EXISTENTE.sql) no SQL Editor do Supabase. É idempotente — pode rodar várias vezes sem erro. Cobre tudo o que as migrations de 001 a 011 fariam.
- **Opção granular:** rode os arquivos de [supabase/migrations/](supabase/migrations/) na ordem numérica (001, 002, ..., 011), um por vez.

5. **Inicie o servidor**

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura do projeto

```
src/
  app/             # rotas (Next.js App Router) — uma pasta por rota
    cliente/       # área do cliente (busca, demandas, atendimentos, configurações)
    profissional/  # área do prestador (atendimentos, carteira, serviços, configurações)
    admin/         # área do administrador
  screens/         # componentes de tela (organizados por área)
  lib/             # utilitários, cliente Supabase, helpers
  types/           # tipos TypeScript compartilhados
supabase/
  migrations/      # SQL granulares (001 → 011)
  ALINHAR_BANCO_EXISTENTE.sql   # script único idempotente (atalho)
docs/
  requisitos-funcionais.md      # RFs por integrante
```

## Variáveis de ambiente necessárias

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto no Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon key) do Supabase |

## Fluxo para colaboradores

1. `git checkout main && git pull`
2. Crie uma branch: `git checkout -b feat/seu-nome-rf-XX`
3. Faça suas alterações + commits descritivos (`feat:`, `fix:`, `chore:`...)
4. `git push -u origin feat/seu-nome-rf-XX`
5. Abra um Pull Request no GitHub apontando para `main`
6. Aguarde revisão antes do merge

> Não comite na main direto sem alinhar com o time. Não comite `.env.local`.

## Requisitos funcionais

A divisão de RFs por integrante está em [docs/requisitos-funcionais.md](docs/requisitos-funcionais.md).
