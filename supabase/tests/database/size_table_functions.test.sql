begin;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into size_tables (id, name, age_range, is_active) values
  ('66666666-0000-0000-0000-000000000001', 'Mujeres', 'mujer', true),
  ('66666666-0000-0000-0000-000000000002', 'Mujeres copia', 'mujer', false),
  ('66666666-0000-0000-0000-000000000003', 'Niños', 'nino', true);

select lives_ok($$select activate_size_table('66666666-0000-0000-0000-000000000002')$$, 'activa la copia');
select is((select array_agg(name order by name) from size_tables where is_active), array['Mujeres copia', 'Niños'], 'la anterior queda inactiva y otro rango no se toca');
select lives_ok($$select activate_size_table('66666666-0000-0000-0000-000000000002')$$, 'activar una ya activa es idempotente');
select is((select count(*)::int from size_tables where age_range = 'mujer' and is_active), 1, 'siempre una sola activa por rango');
select throws_ok($$select activate_size_table('66666666-0000-0000-0000-00000000ffff')$$, 'P0002', null, 'tabla inexistente');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok($$select activate_size_table('66666666-0000-0000-0000-000000000001')$$, 'P0002', null, 'B no puede activar tablas de A');

select * from finish();
rollback;
