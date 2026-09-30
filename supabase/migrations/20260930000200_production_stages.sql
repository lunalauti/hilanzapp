-- Producción en dos etapas (Req 7): patrón listo por (prenda, talle) del grupo,
-- confección lista por asignación individual (bailarina, prenda).

alter table public.assignments add constraint assignments_id_owner_id_key unique (id, owner_id);

create table public.production_stages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  mold_type_id uuid not null,
  size_label text not null check (length(btrim(size_label)) > 0),
  pattern_done_at timestamptz,
  unique (group_id, mold_type_id, size_label),
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade,
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade
);

create table public.production_units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  sewn_done_at timestamptz not null default now(),
  unique (assignment_id),
  foreign key (assignment_id, owner_id) references public.assignments (id, owner_id) on delete cascade
);

alter table public.production_stages enable row level security;
alter table public.production_units enable row level security;
create policy production_stages_owner on public.production_stages for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy production_units_owner on public.production_units for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.production_stages, public.production_units from anon;
