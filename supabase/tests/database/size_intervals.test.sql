begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into size_tables (id, name, age_range) values ('66666666-0000-0000-0000-000000000001', 'Niñas', 'nino');
insert into size_table_sizes (id, table_id, label) values ('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '8');
insert into measure_definitions (id, key, name) values ('88888888-0000-0000-0000-000000000001', 'pecho', 'Contorno de pecho');

select lives_ok(
  $$insert into size_table_values (size_id, definition_id, value_cm, min_cm, max_cm) values ('77777777-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 73, 70, 76)$$,
  'permite cargar un intervalo válido'
);
select throws_ok(
  $$update size_table_values set min_cm = 80, max_cm = 70 where size_id = '77777777-0000-0000-0000-000000000001'$$,
  '23514', null, 'no permite min_cm > max_cm'
);
select lives_ok(
  $$update size_table_values set min_cm = null, max_cm = null where size_id = '77777777-0000-0000-0000-000000000001'$$,
  'permite dejar el intervalo vacío (celda sin rango)'
);
select is((select value_cm from size_table_values where size_id = '77777777-0000-0000-0000-000000000001'), 73.00, 'value_cm se conserva como punto medio');

select * from finish();
rollback;
