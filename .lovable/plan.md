# Avaliação técnica e de UX — Receitas da Cris

## Diagnóstico atual

**Pontos fortes**
- Estrutura TanStack Start limpa, com rotas separadas (`/`, `/adicionar`, `/validar`).
- Design system coerente: tokens em `oklch`, fontes Fraunces + Inter, paleta acolhedora.
- Catálogo já com busca, filtro de categoria e filtro de fonte.
- Dados tipados em `src/lib/recipes.ts` a partir de JSON estático.

**Limitações principais**
- Receita não tem página/modal de detalhe — ingredientes e passos existem nos dados, mas o usuário nunca os vê.
- Card mostra pouca informação útil (sem porções, sem rating, sem status).
- Não há persistência real: `/adicionar` salva drafts em `localStorage`, `/validar` só lê do JSON.
- Sem sistema de avaliação nem status pessoal ("quero testar", "já fiz", "favorita").
- Formulário de adicionar é raso (URL + título + categoria + notas) — não captura ingredientes, passos, tempo, dificuldade, imagem.
- Mobile: header e grid funcionam, mas filtros viram 3 selects empilhados sem hierarquia; cards têm imagem 4:3 grande demais em telas pequenas.
- Acessibilidade: faltam `aria-label` nos selects/busca, foco visível fraco nos cards, contraste do badge "A validar" no `accent` precisa verificação, imagens sem fallback.
- SEO: só a home tem `head()`; rotas filhas reaproveitam metadata.

---

## Fase 1 — Fundamentos de UX no catálogo e card

Objetivo: tornar a navegação mais clara antes de adicionar features novas.

- Reformular barra de filtros: busca em destaque, categoria e fonte como **chips horizontais com scroll no mobile** (em vez de 3 selects).
- Adicionar contagem por categoria nos chips e estado "limpar filtros".
- Card mais útil: porções, rating médio (placeholder por enquanto), ícone de status pessoal, badge de fonte mais discreto.
- Skeleton loading e estado vazio ilustrado.
- Acessibilidade: `aria-label` em busca/filtros, `:focus-visible` consistente, `alt` descritivo nas imagens, contraste revisado.
- SEO: `head()` próprio em `/adicionar` e `/validar`.

## Fase 2 — Página de detalhe da receita

- Nova rota `src/routes/receita.$id.tsx` (deep-linkable, SSR-friendly, melhor que modal para SEO e compartilhamento).
- Layout: hero com imagem, título, categoria, tempo, dificuldade, porções, link para a fonte original (Instagram/PDF/vídeo).
- Seções: ingredientes (lista com checkboxes locais para "marcar enquanto cozinha"), passo a passo numerado, tags, notas pessoais.
- Botões de ação no topo: marcar status, avaliar, compartilhar, abrir fonte.
- `head()` dinâmico com `og:image` da receita.
- Card do catálogo passa a ser `<Link to="/receita/$id">`.

## Fase 3 — Avaliação (1–5 estrelas) e status pessoal

- Componente `<StarRating />` acessível (radiogroup, navegação por teclado).
- Status como enum: `quero-testar | ja-fiz | favorita | nenhum`.
- Filtros adicionais no catálogo: "Minhas favoritas", "Quero testar", "Já fiz", "Mais bem avaliadas".
- Persistência local primeiro (localStorage com chave por receita), preparada para migrar para backend na Fase 5.
- Ícones claros no card (coração para favorita, check para já fiz, bookmark para quero testar).

## Fase 4 — Formulário real de cadastro

- Refatorar `/adicionar` usando `react-hook-form` + `zod` (já no projeto via shadcn).
- Campos: título, categoria (com sugestão das existentes + criar nova), fonte + URL, imagem (upload ou URL), tempo, dificuldade, porções, tags, ingredientes (lista dinâmica), passos (lista dinâmica), notas.
- Modo "rascunho rápido" (só URL + título) e "receita completa" — toggle no topo.
- Pré-visualização ao vivo do card e da página de detalhe antes de salvar.
- Validação por etapa, mensagens de erro acessíveis, autosave em localStorage.

## Fase 5 — Backend com Lovable Cloud

Substituir o JSON estático e o localStorage por um backend real.

- Habilitar **Lovable Cloud**.
- Tabelas: `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`, `ratings`, `user_recipe_status`.
- Storage para imagens das receitas (bucket `recipe-images`).
- RLS preparada para multi-usuário desde já (mesmo antes do login: políticas públicas de leitura, escrita restrita por sessão anônima/owner).
- Migrar dados do `recipes.json` como seed inicial.
- Server functions (`createServerFn`) para listar, buscar, criar e atualizar receitas; React Query para cache no cliente.
- Página `/validar` passa a operar sobre o banco (aprovar = `validated = true`).

## Fase 6 — Login de usuários e personalização

- Auth do Lovable Cloud com email/senha + Google.
- Tabela `profiles` (perfil da Cris e convidadas) + tabela `user_roles` separada para `admin` vs `viewer` (a Cris valida; convidadas só veem e marcam status).
- Layout protegido `_authenticated/` para `/adicionar` e `/validar`.
- Avaliações e status passam a ser por usuário; catálogo mostra "média da comunidade" + "sua nota".
- Página de perfil: minhas favoritas, minhas avaliações, receitas que adicionei.

---

## Melhorias transversais (em todas as fases)

**Mobile**
- Header com menu hambúrguer abaixo de 640px.
- Filtros como bottom sheet no mobile (usar `Drawer` do shadcn).
- Card em layout horizontal compacto opcional para listas longas.
- Botões de ação principais com altura mínima 44px.

**Acessibilidade & legibilidade**
- Auditoria de contraste (WCAG AA) em todos os tokens; ajustar `--accent` se necessário.
- `prefers-reduced-motion` respeitado nas transições do card.
- Tamanhos de fonte fluidos (`clamp()`) para títulos.
- Navegação por teclado completa em filtros, cards e estrelas.
- `lang="pt-BR"` no root, landmarks semânticos (`<main>`, `<nav>`, `<search>`).

**Qualidade técnica**
- Extrair tipos compartilhados para `src/lib/types.ts`.
- Hook `useRecipes()` que abstrai fonte (JSON hoje, Cloud depois) — facilita a migração da Fase 5.
- Testes leves dos filtros e do rating com Vitest.

---

## Ordem sugerida de entrega

1. Fase 1 (rápida, alto impacto visível).
2. Fase 2 + Fase 3 juntas (detalhe da receita já nasce com avaliação e status).
3. Fase 4 (formulário decente para a Cris usar de verdade).
4. Fase 5 (backend — momento certo, depois que o modelo de dados está estável).
5. Fase 6 (login, só quando houver mais de uma usuária).

Me confirma se faz sentido nessa ordem ou se quer priorizar alguma fase antes (ex.: pular direto para backend + login).