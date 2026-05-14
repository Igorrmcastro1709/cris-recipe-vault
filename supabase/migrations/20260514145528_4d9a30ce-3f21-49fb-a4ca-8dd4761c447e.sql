
-- 1. Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Perfis são públicos para leitura"
  on public.profiles for select using (true);
create policy "Usuário cria seu próprio perfil"
  on public.profiles for insert with check (auth.uid() = user_id);
create policy "Usuário atualiza seu próprio perfil"
  on public.profiles for update using (auth.uid() = user_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2. Roles (separate table - critical for security)
create type public.app_role as enum ('admin', 'viewer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Papéis visíveis para o próprio usuário"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Apenas admins gerenciam papéis"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 3. Tighten recipes RLS: only admin writes
drop policy if exists "Qualquer um pode adicionar receitas" on public.recipes;
drop policy if exists "Qualquer um pode atualizar receitas (temporário até Fase 6)" on public.recipes;

create policy "Apenas admins adicionam receitas"
  on public.recipes for insert
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Apenas admins atualizam receitas"
  on public.recipes for update
  using (public.has_role(auth.uid(), 'admin'));
create policy "Apenas admins apagam receitas"
  on public.recipes for delete
  using (public.has_role(auth.uid(), 'admin'));

-- 4. Ratings
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, user_id)
);
alter table public.ratings enable row level security;

create policy "Avaliações são públicas para leitura"
  on public.ratings for select using (true);
create policy "Usuário gerencia suas avaliações"
  on public.ratings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger ratings_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

create index ratings_recipe_idx on public.ratings(recipe_id);

-- 5. User recipe status
create type public.recipe_status as enum ('favorita', 'quero-testar', 'ja-fiz');

create table public.user_recipe_status (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null,
  status recipe_status not null,
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id, status)
);
alter table public.user_recipe_status enable row level security;

create policy "Usuário vê seus próprios status"
  on public.user_recipe_status for select
  using (auth.uid() = user_id);
create policy "Usuário gerencia seus próprios status"
  on public.user_recipe_status for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index user_recipe_status_user_idx on public.user_recipe_status(user_id);
