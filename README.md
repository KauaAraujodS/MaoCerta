# MaoCerta

Aplicativo web para conectar pessoas que precisam de serviços com profissionais disponíveis na região. O cliente pode buscar um profissional ou postar uma demanda, o profissional encontra e os dois entram em contato para combinar os detalhes do serviço.

## Tecnologias usadas

- **Next.js 14** — framework React com rotas de API integradas
- **Supabase** — banco de dados PostgreSQL + autenticação
- **Tailwind CSS** — estilização
- **Vercel** — hospedagem

## Como rodar o projeto localmente

### Pré-requisitos

- Node.js 18 ou superior
- Conta no [Supabase](https://supabase.com)

### Passo a passo

1. Clone o repositório

```bash
git clone https://github.com/KauaAraujodS/MaoCerta.git
cd MaoCerta
```

2. Instale as dependências

```bash
npm install
```

3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com as chaves do projeto no Supabase:

```bash
cp .env.local.example .env.local
```

As chaves ficam em: **Supabase → Settings → API**

4. Configure o banco de dados

Execute os arquivos SQL da pasta `supabase/migrations/` na ordem numérica, pelo editor SQL do Supabase.

5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura do projeto

```
src/
  app/          # páginas e rotas da aplicação
  components/   # componentes reutilizáveis
  lib/          # configuração do Supabase
  types/        # tipagens TypeScript
supabase/
  migrations/   # scripts SQL para criação das tabelas
```

## Variáveis de ambiente necessárias

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto no Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon key) do Supabase |
