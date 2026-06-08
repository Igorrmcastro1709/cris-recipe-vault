-- Keep published recipes readable by visitors without requiring anon users to call admin helpers.
drop policy if exists "Receitas validadas são públicas; rascunhos só para admins" on public.recipes;

create policy "Receitas validadas são públicas"
  on public.recipes for select
  to anon, authenticated
  using (validated = true);

create policy "Admins leem todas as receitas"
  on public.recipes for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select on table public.recipes to anon, authenticated;
