alter table public.recipes
add column if not exists extraction_status text not null default 'manual',
add column if not exists raw_source_text text,
add column if not exists extraction_warnings text[] not null default '{}',
add column if not exists extracted_at timestamptz;

alter table public.recipes
drop constraint if exists recipes_extraction_status_check;

alter table public.recipes
add constraint recipes_extraction_status_check
check (extraction_status in ('manual', 'ai_extracted', 'needs_review'));
