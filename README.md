# Receitas da Cris

Catálogo online para salvar, validar e cozinhar receitas vindas de Instagram, PDFs, vídeos, imagens e links.

## O que o app faz

- Mostra um catálogo público apenas com receitas validadas.
- Permite que administradoras cadastrem rascunhos rápidos ou receitas completas.
- Mantém uma etapa de validação antes de publicar no catálogo.
- Guarda status pessoal e nota por receita para usuários logados.
- Usa Supabase para autenticação, banco de dados e regras de acesso.
- Usa TanStack Start/Vite para a aplicação React.

## Setup local

1. Instale dependências:

```bash
npm install
```

2. Crie o arquivo local de ambiente:

```bash
cp .env.example .env
```

3. Preencha as variáveis do Supabase em `.env`.

4. Rode o app:

```bash
npm run dev
```

## Variáveis de ambiente

Use `.env.example` como referência:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Não versione `.env`. Configure valores reais no ambiente local, Lovable/Cloudflare e Supabase.

## Banco de dados

As migrações ficam em `supabase/migrations`.

Regras importantes:

- Receitas validadas são públicas.
- Rascunhos não validados só aparecem para admins.
- Apenas admins criam, validam, atualizam e excluem receitas.
- Ratings e status pessoal pertencem ao usuário autenticado.

Depois de clonar em um novo projeto Supabase, aplique as migrações antes de usar a área administrativa.

## Primeiro admin

A primeira pessoa autenticada pode reivindicar o papel de admin automaticamente. Em produção, crie a conta da Cris antes de divulgar o link público.

Depois que um admin existir, novas contas não ganham admin automaticamente.

## Fluxo editorial

1. Entrar como admin.
2. Abrir `Adicionar`.
3. Cadastrar um rascunho rápido ou receita completa.
4. Abrir `Validar`.
5. Conferir fonte, ingredientes, passos e imagem.
6. Validar para publicar no catálogo.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
```

## Deploy

O projeto contém `wrangler.jsonc` para Cloudflare. Configure as mesmas variáveis de ambiente no provedor antes de publicar.

Se o `.env` já foi commitado alguma vez, considere rotacionar qualquer chave sensível e remover o arquivo do histórico antes de abrir o repositório para mais pessoas.
