-- Keep draft recipes private while still allowing admins to review them.
drop policy if exists "Receitas são públicas para leitura" on public.recipes;

create policy "Receitas validadas são públicas; rascunhos só para admins"
  on public.recipes for select
  using (validated = true or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Avaliações são públicas para leitura" on public.ratings;

create policy "Usuário vê suas próprias avaliações"
  on public.ratings for select
  using (auth.uid() = user_id);

-- The UI treats personal status as one current value per recipe/user.
-- Collapse any existing duplicates before changing the constraint.
delete from public.user_recipe_status urs
using (
  select id,
    row_number() over (
      partition by recipe_id, user_id
      order by created_at desc, id desc
    ) as rn
  from public.user_recipe_status
) ranked
where urs.id = ranked.id
  and ranked.rn > 1;

alter table public.user_recipe_status
  drop constraint if exists user_recipe_status_recipe_id_user_id_status_key;

alter table public.user_recipe_status
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_recipe_status
  add constraint user_recipe_status_recipe_user_unique unique (recipe_id, user_id);

drop trigger if exists user_recipe_status_updated_at on public.user_recipe_status;
create trigger user_recipe_status_updated_at
  before update on public.user_recipe_status
  for each row execute function public.set_updated_at();

-- Avoid a race where two simultaneous first signups could both try to become admin.
create or replace function public.claim_admin_if_first()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  has_any_admin boolean;
begin
  if uid is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('receitas-da-cris:first-admin'));

  select exists(select 1 from public.user_roles where role = 'admin') into has_any_admin;
  if has_any_admin then
    return false;
  end if;

  insert into public.user_roles (user_id, role) values (uid, 'admin')
    on conflict (user_id, role) do nothing;
  return true;
end;
$$;

revoke execute on function public.claim_admin_if_first() from public, anon;
grant execute on function public.claim_admin_if_first() to authenticated;
