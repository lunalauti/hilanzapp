begin;
select plan(18);

-- Dos usuarias de prueba
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Datos de la usuaria A
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$insert into groups (id, name) values ('11111111-0000-0000-0000-000000000001', 'Ágata')$$, 'A crea un grupo');
select lives_ok($$insert into dancers (id, group_id, name, age) values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Martina', 16)$$, 'A crea una bailarina');
select lives_ok($$insert into measure_definitions (id, key, name, required) values
  ('33333333-0000-0000-0000-000000000001', 'pecho', 'Contorno de pecho', true),
  ('33333333-0000-0000-0000-000000000002', 'cintura', 'Contorno de cintura', true)$$, 'A define medidas requeridas');

-- Aislamiento
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from groups), 0, 'B no ve los grupos de A');
select is((select count(*)::int from dancers), 0, 'B no ve las bailarinas de A');
update groups set name = 'hack';
select throws_ok($$insert into dancers (group_id, name) values ('11111111-0000-0000-0000-000000000001', 'Intrusa')$$, '23503', null, 'B no puede colgar bailarinas de un grupo de A');
select throws_ok($$select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 80)$$, 'P0002', null, 'B no puede cargar medidas a una bailarina de A');

-- Versionado (usuaria A)
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select is((select name from groups), 'Ágata', 'B no pudo modificar el grupo de A');
select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 86);
select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 88);
select is((select count(*)::int from measurement_versions where is_current), 1, 'queda una sola versión vigente');
select is((select count(*)::int from measurement_versions), 2, 'la versión anterior se conserva');
select is((select value_cm from measurement_versions where is_current), 88.00, 'el valor vigente es el último');

select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 90);
select restore_measurement((select id from measurement_versions where value_cm = 86));
select is((select value_cm from measurement_versions where is_current), 86.00, 'restaurar deja vigente el valor viejo');
select is((select count(*)::int from measurement_versions), 4, 'restaurar agrega una versión nueva');

select throws_ok($$select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', -1)$$, '23514', null, 'rechaza valores negativos');
select throws_ok($$update measurement_versions set value_cm = 1 where is_current$$, '23001', null, 'no se puede pisar el valor de una versión');

-- Estado de medidas: 1 de 2 requeridas => parcial; 2 de 2 => completa
select is((select status from dancer_measure_status), 'partial', 'estado parcial con una medida requerida cargada');
select set_measurement('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 70);
select is((select status from dancer_measure_status), 'complete', 'estado completa con todas las requeridas');

-- Cascada al borrar el grupo
delete from groups where id = '11111111-0000-0000-0000-000000000001';
select is((select count(*)::int from measurement_versions) + (select count(*)::int from dancers), 0, 'borrar el grupo elimina bailarinas y medidas');

select * from finish();
rollback;
