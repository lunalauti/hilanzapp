-- Núcleo: grupos, bailarinas, definiciones de medidas y medidas versionadas (Req 1, 2, 3, 8, 10).

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Grupos ---------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- Bailarinas -----------------------------------------------------------
create table public.dancers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  age int check (age between 0 and 120),
  measured_on date,
  manual_size_label text,
  size_table_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade
);
create index dancers_group_idx on public.dancers (group_id);

-- Definiciones de medidas (base, personalizadas y estándares de tabla) --
create table public.measure_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'body' check (kind in ('body', 'standard')),
  is_base boolean not null default false,
  required boolean not null default false,
  sort int not null default 0,
  unit text not null default 'cm',
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, key)
);

-- Medidas versionadas: nunca se pisa el valor, cada cambio es una versión nueva -----
create table public.measurement_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dancer_id uuid not null,
  definition_id uuid not null,
  value_cm numeric(7, 2) not null check (value_cm >= 0),
  note text,
  taken_on date not null default current_date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (dancer_id, owner_id) references public.dancers (id, owner_id) on delete cascade,
  foreign key (definition_id, owner_id) references public.measure_definitions (id, owner_id) on delete cascade
);
create unique index measurement_versions_one_current
  on public.measurement_versions (dancer_id, definition_id) where is_current;
create index measurement_versions_history_idx
  on public.measurement_versions (dancer_id, definition_id, created_at desc);

create function public.measurement_versions_immutable() returns trigger
language plpgsql as $$
begin
  if new.value_cm is distinct from old.value_cm
     or new.dancer_id is distinct from old.dancer_id
     or new.definition_id is distinct from old.definition_id
     or new.taken_on is distinct from old.taken_on then
    raise exception 'Las versiones de medidas no se modifican: se crea una versión nueva'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
create trigger measurement_versions_immutable
  before update on public.measurement_versions
  for each row execute function public.measurement_versions_immutable();

create trigger groups_updated before update on public.groups for each row execute function public.set_updated_at();
create trigger dancers_updated before update on public.dancers for each row execute function public.set_updated_at();
create trigger measure_definitions_updated before update on public.measure_definitions for each row execute function public.set_updated_at();

-- Funciones atómicas ---------------------------------------------------
create function public.set_measurement(
  p_dancer uuid, p_definition uuid, p_value numeric, p_note text default null, p_taken_on date default current_date
) returns public.measurement_versions
language plpgsql security invoker as $$
declare
  v public.measurement_versions;
begin
  if not exists (select 1 from public.dancers where id = p_dancer) then
    raise exception 'Bailarina no encontrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.measure_definitions where id = p_definition) then
    raise exception 'Medida no encontrada' using errcode = 'P0002';
  end if;

  update public.measurement_versions set is_current = false
   where dancer_id = p_dancer and definition_id = p_definition and is_current;

  insert into public.measurement_versions (dancer_id, definition_id, value_cm, note, taken_on)
  values (p_dancer, p_definition, p_value, p_note, p_taken_on)
  returning * into v;
  return v;
end $$;

create function public.restore_measurement(p_version uuid) returns public.measurement_versions
language plpgsql security invoker as $$
declare
  old public.measurement_versions;
begin
  select * into old from public.measurement_versions where id = p_version;
  if not found then
    raise exception 'Versión no encontrada' using errcode = 'P0002';
  end if;
  return public.set_measurement(
    old.dancer_id, old.definition_id, old.value_cm,
    trim(both ' ' from coalesce(old.note, '') || ' (restaurada)'), current_date
  );
end $$;

-- Estado de medidas por bailarina (ninguna / parcial / completa) -------
create view public.dancer_measure_status with (security_invoker = true) as
select d.id as dancer_id, d.group_id, s.required_total, s.required_done,
       case when s.required_done = 0 then 'none'
            when s.required_done < s.required_total then 'partial'
            else 'complete' end as status
  from public.dancers d
 cross join lateral (
   select count(*)::int as required_total, count(mv.id)::int as required_done
     from public.measure_definitions md
     left join public.measurement_versions mv
       on mv.definition_id = md.id and mv.dancer_id = d.id and mv.is_current
    where md.required and md.kind = 'body'
 ) s;

-- RLS: cada usuaria ve y modifica solo lo suyo ---------------------------
alter table public.groups enable row level security;
alter table public.dancers enable row level security;
alter table public.measure_definitions enable row level security;
alter table public.measurement_versions enable row level security;

create policy groups_owner on public.groups for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy dancers_owner on public.dancers for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy measure_definitions_owner on public.measure_definitions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy measurement_versions_owner on public.measurement_versions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.groups, public.dancers, public.measure_definitions, public.measurement_versions,
  public.dancer_measure_status from anon;
revoke execute on function public.set_measurement(uuid, uuid, numeric, text, date) from anon, public;
revoke execute on function public.restore_measurement(uuid) from anon, public;
grant execute on function public.set_measurement(uuid, uuid, numeric, text, date) to authenticated;
grant execute on function public.restore_measurement(uuid) to authenticated;
