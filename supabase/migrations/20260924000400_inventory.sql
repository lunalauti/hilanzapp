-- Inventario, consumo de tela y costos (Req 15).

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  unit text not null default 'm' check (length(btrim(unit)) > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  stock_qty numeric(12, 3) not null default 0 check (stock_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- Consumo por unidad de prenda de un diseño; size_label nulo = todos los talles.
create table public.consumption_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  design_garment_id uuid not null,
  material_id uuid not null,
  size_label text,
  quantity numeric(10, 3) not null check (quantity > 0),
  unique nulls not distinct (design_garment_id, material_id, size_label),
  foreign key (design_garment_id, owner_id) references public.design_garments (id, owner_id) on delete cascade,
  foreign key (material_id, owner_id) references public.materials (id, owner_id) on delete cascade
);
create index consumption_rules_garment_idx on public.consumption_rules (design_garment_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  material_id uuid not null,
  delta numeric(12, 3) not null check (delta <> 0),
  reason text not null check (reason in ('manual', 'production')),
  group_id uuid,
  design_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (material_id, owner_id) references public.materials (id, owner_id) on delete cascade,
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete set null (group_id),
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete set null (design_id)
);
create index stock_movements_material_idx on public.stock_movements (material_id, created_at desc);

create trigger materials_updated before update on public.materials for each row execute function public.set_updated_at();

-- Movimiento de stock atómico: actualiza el stock y deja el registro; nunca queda negativo.
create function public.apply_stock_movement(
  p_material uuid, p_delta numeric, p_reason text default 'manual', p_note text default null,
  p_group uuid default null, p_design uuid default null
) returns public.materials
language plpgsql security invoker as $$
declare
  m public.materials;
begin
  select * into m from public.materials where id = p_material for update;
  if not found then
    raise exception 'Material no encontrado' using errcode = 'P0002';
  end if;
  if m.stock_qty + p_delta < 0 then
    raise exception 'Stock insuficiente de %', m.name using errcode = 'HZ001', detail = m.name;
  end if;
  update public.materials set stock_qty = stock_qty + p_delta where id = p_material returning * into m;
  insert into public.stock_movements (material_id, delta, reason, group_id, design_id, note)
  values (p_material, p_delta, p_reason, p_group, p_design, p_note);
  return m;
end $$;

-- Confirma una producción descontando todos los materiales o ninguno (una sola transacción).
create function public.confirm_production(p_group uuid, p_design uuid, p_items jsonb) returns int
language plpgsql security invoker as $$
declare
  item jsonb;
  n int := 0;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    if (item->>'qty')::numeric > 0 then
      perform public.apply_stock_movement((item->>'material_id')::uuid, -(item->>'qty')::numeric, 'production', 'Producción confirmada', p_group, p_design);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

do $$
declare t text;
begin
  foreach t in array array['materials', 'consumption_rules', 'stock_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_owner', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

revoke execute on function public.apply_stock_movement(uuid, numeric, text, text, uuid, uuid) from anon, public;
revoke execute on function public.confirm_production(uuid, uuid, jsonb) from anon, public;
grant execute on function public.apply_stock_movement(uuid, numeric, text, text, uuid, uuid) to authenticated;
grant execute on function public.confirm_production(uuid, uuid, jsonb) to authenticated;
