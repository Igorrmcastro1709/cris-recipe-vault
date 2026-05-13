create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  source text not null check (source in ('instagram','pdf','video','image','link')),
  source_url text not null default '#',
  image text not null default '',
  time text not null default '',
  difficulty text not null default 'Fácil',
  servings int,
  tags text[] not null default '{}',
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  notes text,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_validated_idx on public.recipes (validated);
create index recipes_category_idx on public.recipes (category);

alter table public.recipes enable row level security;

create policy "Receitas são públicas para leitura"
  on public.recipes for select using (true);

create policy "Qualquer um pode adicionar receitas"
  on public.recipes for insert with check (true);

create policy "Qualquer um pode atualizar receitas (temporário até Fase 6)"
  on public.recipes for update using (true) with check (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();