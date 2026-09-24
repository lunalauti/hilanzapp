-- Talles, moldes, diseños, asignaciones y hojas de molde (Req 4, 5, 6, 7, 11, 12, 13).
-- Todas las tablas llevan owner_id y claves foráneas compuestas (id, owner_id) para que
-- una usuaria nunca pueda referenciar filas de otra.

-- Tablas de talles -----------------------------------------------------
create table public.size_tables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  age_range text not null check (age_range in ('bebe', 'nino', 'adolescente', 'mujer', 'otro')),
  source text,
  is_active boolean not null default false,
  base_table_id uuid,
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (base_table_id, owner_id) references public.size_tables (id, owner_id) on delete set null (base_table_id)
);
create unique index size_tables_one_active_per_range on public.size_tables (owner_id, age_range) where is_active;

create table public.size_table_sizes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_id uuid not null,
  label text not null check (length(btrim(label)) > 0),
  descriptor text,
  sort int not null default 0,
  unique (id, owner_id),
  unique (table_id, label),
  foreign key (table_id, owner_id) references public.size_tables (id, owner_id) on delete cascade
);

create table public.size_table_values (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  size_id uuid not null,
  definition_id uuid not null,
  value_cm numeric(7, 2) not null check (value_cm >= 0),
  origin text not null default 'source' check (origin in ('source', 'interpolated', 'extrapolated', 'user')),
  unique (size_id, definition_id),
  foreign key (size_id, owner_id) references public.size_table_sizes (id, owner_id) on delete cascade,
  foreign key (definition_id, owner_id) references public.measure_definitions (id, owner_id) on delete cascade
);

alter table public.dancers
  add foreign key (size_table_id, owner_id) references public.size_tables (id, owner_id) on delete set null (size_table_id);

-- Moldes y fórmulas (datos editables) ------------------------------------
create table public.mold_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(btrim(name)) > 0),
  category text not null default 'otro' check (category in ('cuerpo', 'manga', 'pantalon', 'falda', 'vestido', 'otro')),
  size_priority text not null default 'pecho' check (size_priority in ('pecho', 'cadera', 'both')),
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, key)
);

create table public.mold_inputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mold_type_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  source text not null check (source in ('measure', 'standard', 'manual', 'choice')),
  definition_id uuid,
  options jsonb,
  default_option_id text,
  required boolean not null default true,
  sort int not null default 0,
  unique (mold_type_id, key),
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade,
  foreign key (definition_id, owner_id) references public.measure_definitions (id, owner_id) on delete set null (definition_id)
);

create table public.mold_formulas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mold_type_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  section text,
  operand_a text not null,
  op text not null check (op in ('direct', 'div', 'mul', 'add', 'sub')),
  operand_b text,
  adjustment_cm numeric(7, 2) not null default 0,
  decimals int not null default 1 check (decimals between 0 and 4),
  sort int not null default 0,
  template_default jsonb,
  unique (mold_type_id, key),
  check (op = 'direct' or operand_b is not null),
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade
);

-- Diseños de vestuario ---------------------------------------------------
create table public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('neckline', 'sleeve', 'skirt')),
  label text not null check (length(btrim(label)) > 0),
  is_custom boolean not null default false,
  unique (id, owner_id),
  unique (owner_id, category, label)
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  notes text,
  construction_details text,
  neckline_id uuid,
  sleeve_id uuid,
  skirt_id uuid,
  has_ruffle boolean not null default false,
  is_asymmetric boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (neckline_id, owner_id) references public.catalog_options (id, owner_id) on delete set null (neckline_id),
  foreign key (sleeve_id, owner_id) references public.catalog_options (id, owner_id) on delete set null (sleeve_id),
  foreign key (skirt_id, owner_id) references public.catalog_options (id, owner_id) on delete set null (skirt_id)
);

create table public.design_garments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  design_id uuid not null,
  mold_type_id uuid not null,
  labor_cost numeric(12, 2) check (labor_cost >= 0),
  sort int not null default 0,
  unique (id, owner_id),
  unique (design_id, mold_type_id),
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete cascade,
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade
);

create table public.design_special_measures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  design_id uuid not null,
  definition_id uuid not null,
  unique (design_id, definition_id),
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete cascade,
  foreign key (definition_id, owner_id) references public.measure_definitions (id, owner_id) on delete cascade
);

create table public.group_designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  design_id uuid not null,
  unique (group_id, design_id),
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade,
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete cascade
);

-- Asignaciones (prenda de una bailarina) y hojas de molde --------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dancer_id uuid not null,
  design_id uuid,
  mold_type_id uuid not null,
  manual_size_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (dancer_id, design_id, mold_type_id),
  foreign key (dancer_id, owner_id) references public.dancers (id, owner_id) on delete cascade,
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete cascade,
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade
);
create index assignments_dancer_idx on public.assignments (dancer_id);

create table public.pattern_sheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dancer_id uuid not null,
  mold_type_id uuid not null,
  design_id uuid,
  size_label text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (dancer_id, owner_id) references public.dancers (id, owner_id) on delete cascade,
  foreign key (mold_type_id, owner_id) references public.mold_types (id, owner_id) on delete cascade,
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete set null (design_id)
);
create index pattern_sheets_dancer_idx on public.pattern_sheets (dancer_id, created_at desc);

create trigger size_tables_updated before update on public.size_tables for each row execute function public.set_updated_at();
create trigger mold_types_updated before update on public.mold_types for each row execute function public.set_updated_at();
create trigger designs_updated before update on public.designs for each row execute function public.set_updated_at();
create trigger assignments_updated before update on public.assignments for each row execute function public.set_updated_at();

-- RLS ----------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'size_tables', 'size_table_sizes', 'size_table_values', 'mold_types', 'mold_inputs', 'mold_formulas',
    'catalog_options', 'designs', 'design_garments', 'design_special_measures', 'group_designs',
    'assignments', 'pattern_sheets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
