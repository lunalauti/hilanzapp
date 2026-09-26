begin;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into mold_types (id, key, name, has_pattern) values
  ('44444444-0000-0000-0000-000000000001', 'propia_evase', 'Vestido evasé', false),
  ('44444444-0000-0000-0000-000000000002', 'vestido_a', 'Vestido línea A', true),
  ('44444444-0000-0000-0000-000000000003', 'sin_formulas', 'Otro vacío', false);
insert into groups (id, name) values ('11111111-0000-0000-0000-000000000001', 'Amatista');
insert into dancers (id, group_id, name) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Emi'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Ana');
insert into designs (id, name) values ('55555555-0000-0000-0000-000000000001', 'Jardín');
insert into design_garments (id, design_id, mold_type_id, labor_cost) values
  ('88888888-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 14000);
insert into assignments (dancer_id, design_id, mold_type_id, manual_size_label) values
  ('22222222-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '42'),
  ('22222222-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', null);

select is((select has_pattern from mold_types where key = 'vestido_a'), true, 'has_pattern se puede fijar');
select is((select has_pattern from mold_types where key = 'propia_evase'), false, 'una prenda propia no tiene patrón');

-- Errores de validación
select throws_ok($$select link_placeholder_mold('44444444-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001')$$, 'HZ004', null, 'el origen debe ser una prenda sin molde');
select throws_ok($$select link_placeholder_mold('44444444-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000003')$$, 'HZ005', null, 'el destino debe tener fórmulas');

-- Vincular conserva asignaciones, talle manual y mano de obra
select is((select link_placeholder_mold('44444444-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002')),
  '{"garments": 1, "assignments": 2, "sheets": 0}'::jsonb, 'devuelve los conteos');
select is((select count(*)::int from assignments where mold_type_id = '44444444-0000-0000-0000-000000000002'), 2, 'las asignaciones pasan al molde destino');
select is((select manual_size_label from assignments where dancer_id = '22222222-0000-0000-0000-000000000001'), '42', 'se conserva el talle manual');
select is((select labor_cost from design_garments where id = '88888888-0000-0000-0000-000000000001'), 14000.00, 'se conserva la mano de obra y el id de la prenda');
select is((select count(*)::int from mold_types where key = 'propia_evase'), 0, 'se elimina el molde vacío');

-- Conflicto: el diseño ya tiene el molde destino
insert into mold_types (id, key, name, has_pattern) values ('44444444-0000-0000-0000-000000000004', 'propia_falda', 'Falda', false);
insert into design_garments (design_id, mold_type_id) values ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004');
select throws_ok($$select link_placeholder_mold('44444444-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000002')$$, 'HZ002', null, 'no vincula a un molde que el diseño ya tiene');

-- Aislamiento
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok($$select link_placeholder_mold('44444444-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000002')$$, 'P0002', null, 'B no puede vincular moldes de A');

select * from finish();
rollback;
