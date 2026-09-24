begin;
select plan(10);

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
insert into mold_types (id, key, name, size_priority) values ('44444444-0000-0000-0000-000000000001', 'pantalon', 'Pantalón', 'cadera');
insert into designs (id, name) values ('55555555-0000-0000-0000-000000000001', 'Aurora');
insert into size_tables (id, name, age_range, is_active) values ('66666666-0000-0000-0000-000000000001', 'Mujeres', 'mujer', true);

-- Una sola tabla activa por rango etario
select throws_ok($$insert into size_tables (name, age_range, is_active) values ('Otra', 'mujer', true)$$, '23505', null, 'solo una tabla activa por rango etario');
select lives_ok($$insert into size_tables (name, age_range, is_active) values ('Mujeres copia', 'mujer', false)$$, 'se permiten tablas inactivas del mismo rango');

-- Asignaciones únicas, incluso sin diseño
select lives_ok($$insert into assignments (dancer_id, mold_type_id) values ('22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001')$$, 'asigna una prenda sin diseño');
select throws_ok($$insert into assignments (dancer_id, mold_type_id) values ('22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001')$$, '23505', null, 'no se duplica la asignación sin diseño');
select lives_ok($$insert into assignments (dancer_id, design_id, mold_type_id) values ('22222222-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001')$$, 'la misma prenda con otro diseño es otra asignación');
select throws_ok($$insert into assignments (dancer_id, design_id, mold_type_id) values ('22222222-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001')$$, '23505', null, 'no se duplica la asignación con diseño');

-- Fórmulas: una operación distinta de "direct" exige operando
select throws_ok($$insert into mold_formulas (mold_type_id, key, label, operand_a, op) values ('44444444-0000-0000-0000-000000000001', 'x', 'X', 'cadera', 'div')$$, '23514', null, 'div exige operando B');

-- Aislamiento entre usuarias
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from mold_types) + (select count(*)::int from designs) + (select count(*)::int from size_tables) + (select count(*)::int from assignments), 0, 'B no ve moldes, diseños, tablas ni asignaciones de A');
insert into mold_types (id, key, name) values ('44444444-0000-0000-0000-000000000002', 'pantalon', 'Pantalón de B');
select throws_ok($$insert into assignments (dancer_id, mold_type_id) values ('22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002')$$, '23503', null, 'B no puede asignar prendas a una bailarina de A');
select is((select count(*)::int from mold_types), 1, 'B puede tener su propio molde con la misma clave');

select * from finish();
rollback;
