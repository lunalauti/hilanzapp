-- Categorías de grupo (para renovar temporada sin perder el historial) y archivado de grupos.
create table public.group_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, name)
);

alter table public.groups
  add column category_id uuid,
  add column archived_at timestamptz;

alter table public.groups
  add foreign key (category_id, owner_id) references public.group_categories (id, owner_id) on delete set null (category_id);

create index groups_category_idx on public.groups (category_id);

alter table public.group_categories enable row level security;
create policy group_categories_owner on public.group_categories for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.group_categories from anon;
