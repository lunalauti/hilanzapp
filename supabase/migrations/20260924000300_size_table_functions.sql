-- Activar una tabla de talles de forma atómica: deja una sola activa por rango etario (Req 13.2).
create function public.activate_size_table(p_table uuid) returns void
language plpgsql security invoker as $$
declare
  r text;
begin
  select age_range into r from public.size_tables where id = p_table;
  if r is null then
    raise exception 'Tabla no encontrada' using errcode = 'P0002';
  end if;
  update public.size_tables set is_active = false where age_range = r and is_active and id <> p_table;
  update public.size_tables set is_active = true where id = p_table;
end $$;

revoke execute on function public.activate_size_table(uuid) from anon, public;
grant execute on function public.activate_size_table(uuid) to authenticated;
