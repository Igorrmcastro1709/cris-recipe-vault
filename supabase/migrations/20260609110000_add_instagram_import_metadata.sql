create table if not exists public.recipe_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('instagram')),
  source_name text not null default '',
  source_path text not null default '',
  total_found int not null default 0,
  total_imported int not null default 0,
  total_skipped int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.recipe_import_batches enable row level security;

drop policy if exists "Admins gerenciam lotes de importacao" on public.recipe_import_batches;
create policy "Admins gerenciam lotes de importacao"
  on public.recipe_import_batches for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

alter table public.recipes
add column if not exists import_batch_id uuid references public.recipe_import_batches(id) on delete set null,
add column if not exists external_source_id text,
add column if not exists source_collection text;

create index if not exists recipes_import_batch_id_idx on public.recipes (import_batch_id);
create index if not exists recipes_source_collection_idx on public.recipes (source_collection);

create unique index if not exists recipes_source_external_source_id_unique
  on public.recipes (source, external_source_id)
  where external_source_id is not null;
