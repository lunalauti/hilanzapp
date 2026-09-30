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
insert into groups (id, name) values ('11111111-0000-0000-0000-000000000001', 'Ágata');
insert into dancers (id, group_id, name) values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Martina');
insert into mold_types (id, key, name) values ('44444444-0000-0000-0000-000000000001', 'cuerpo', 'Cuerpo base');
insert into assignments (id, dancer_id, mold_type_id, manual_size_label) values ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '10');

select lives_ok(
  $$insert into production_stages (group_id, mold_type_id, size_label, pattern_done_at) values ('11111111-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '10', now())$$,
  'marca un patrón como listo para talle 10'
);
select throws_ok(
  $$insert into production_stages (group_id, mold_type_id, size_label) values ('11111111-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '10')$$,
  '23505', null, 'no se duplica la combinación grupo+prenda+talle'
);
select lives_ok(
  $$insert into production_units (assignment_id) values ('55555555-0000-0000-0000-000000000001')$$,
  'marca una prenda individual como cosida (existe = hecha)'
);
select throws_ok(
  $$insert into production_units (assignment_id) values ('55555555-0000-0000-0000-000000000001')$$,
  '23505', null, 'no se duplica la unidad por asignación'
);

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from production_stages) + (select count(*)::int from production_units), 0, 'B no ve el progreso de producción de A');
insert into groups (id, name) values ('11111111-0000-0000-0000-000000000002', 'Jade');
select throws_ok(
  $$insert into production_stages (group_id, mold_type_id, size_label) values ('11111111-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', '10')$$,
  '23503', null, 'B no puede referenciar una prenda de A'
);

select * from finish();
rollback;
