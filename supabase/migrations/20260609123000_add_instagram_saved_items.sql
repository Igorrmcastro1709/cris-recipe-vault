create table if not exists public.instagram_saved_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  external_source_id text not null,
  title text not null default 'Receita salva do Instagram',
  category text not null default 'Sem categoria',
  image text not null default '',
  collection_name text,
  raw_text text,
  notes text,
  tags text[] not null default '{}',
  status text not null default 'inbox',
  recipe_id uuid references public.recipes(id) on delete set null,
  import_batch_id uuid references public.recipe_import_batches(id) on delete set null,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_saved_items_status_check
    check (status in ('inbox', 'needs_text', 'ready_to_convert', 'converted', 'archived'))
);

create unique index if not exists instagram_saved_items_external_source_id_idx
  on public.instagram_saved_items (external_source_id);

create unique index if not exists instagram_saved_items_source_url_idx
  on public.instagram_saved_items (source_url);

create index if not exists instagram_saved_items_status_idx
  on public.instagram_saved_items (status);

create index if not exists instagram_saved_items_collection_idx
  on public.instagram_saved_items (collection_name);

alter table public.instagram_saved_items enable row level security;

drop policy if exists "Admins gerenciam salvos do Instagram" on public.instagram_saved_items;
create policy "Admins gerenciam salvos do Instagram"
  on public.instagram_saved_items for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists instagram_saved_items_set_updated_at on public.instagram_saved_items;
create trigger instagram_saved_items_set_updated_at
  before update on public.instagram_saved_items
  for each row execute function public.set_updated_at();
