-- Prendas propias "sin molde todavía": un molde sin fórmulas (has_pattern = false) cuyas
-- entradas son las medidas que la modista eligió. Se comportan como cualquier molde en
-- asignaciones, producción, consumo y costos. Al escribir fórmulas pasan a has_pattern = true;
-- link_placeholder_mold() las reapunta a un molde existente.
alter table public.mold_types add column has_pattern boolean not null default true;

create function public.link_placeholder_mold(p_from uuid, p_to uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_from public.mold_types;
  v_to public.mold_types;
  n_garments int;
  n_assignments int;
  n_sheets int;
begin
  select * into v_from from public.mold_types where id = p_from;
  if not found then raise exception 'Molde no encontrado' using errcode = 'P0002'; end if;
  select * into v_to from public.mold_types where id = p_to;
  if not found then raise exception 'Molde destino no encontrado' using errcode = 'P0002'; end if;

  if p_from = p_to or v_from.has_pattern then
    raise exception 'La prenda de origen ya tiene molde' using errcode = 'HZ004';
  end if;
  if not v_to.has_pattern then
    raise exception 'El molde destino todavía no tiene fórmulas' using errcode = 'HZ005';
  end if;
  if exists (
    select 1 from public.design_garments a join public.design_garments b on b.design_id = a.design_id
     where a.mold_type_id = p_from and b.mold_type_id = p_to
  ) then
    raise exception 'Un diseño ya tiene una prenda con el molde destino' using errcode = 'HZ002';
  end if;
  if exists (
    select 1 from public.assignments a
      join public.assignments b on b.dancer_id = a.dancer_id and b.design_id is not distinct from a.design_id
     where a.mold_type_id = p_from and b.mold_type_id = p_to
  ) then
    raise exception 'Una bailarina ya tiene asignado el molde destino' using errcode = 'HZ003';
  end if;

  update public.design_garments set mold_type_id = p_to where mold_type_id = p_from;
  get diagnostics n_garments = row_count;
  update public.assignments set mold_type_id = p_to where mold_type_id = p_from;
  get diagnostics n_assignments = row_count;
  update public.pattern_sheets set mold_type_id = p_to where mold_type_id = p_from;
  get diagnostics n_sheets = row_count;
  delete from public.mold_types where id = p_from;

  return jsonb_build_object('garments', n_garments, 'assignments', n_assignments, 'sheets', n_sheets);
end $$;

revoke execute on function public.link_placeholder_mold(uuid, uuid) from anon, public;
grant execute on function public.link_placeholder_mold(uuid, uuid) to authenticated;
