begin;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into materials (id, name, unit, unit_cost, stock_qty) values
  ('77777777-0000-0000-0000-000000000001', 'Lycra negra', 'm', 1000, 10),
  ('77777777-0000-0000-0000-000000000002', 'Tul', 'm', 500, 3);
insert into mold_types (id, key, name) values ('44444444-0000-0000-0000-000000000001', 'pantalon', 'Pantalón');
insert into designs (id, name) values ('55555555-0000-0000-0000-000000000001', 'Aurora');
insert into design_garments (id, design_id, mold_type_id) values ('88888888-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001');

-- Consumo: único por prenda + material + talle (nulo = todos)
select lives_ok($$insert into consumption_rules (design_garment_id, material_id, size_label, quantity) values ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', null, 1.2)$$, 'consumo general');
select lives_ok($$insert into consumption_rules (design_garment_id, material_id, size_label, quantity) values ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', '10', 1.4)$$, 'consumo por talle');
select throws_ok($$insert into consumption_rules (design_garment_id, material_id, size_label, quantity) values ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', null, 2)$$, '23505', null, 'no se duplica el consumo general');
select throws_ok($$insert into consumption_rules (design_garment_id, material_id, quantity) values ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000002', 0)$$, '23514', null, 'la cantidad debe ser positiva');

-- Movimientos de stock
select is((select stock_qty from apply_stock_movement('77777777-0000-0000-0000-000000000001', 5, 'manual', 'compra')), 15.000, 'suma stock');
select is((select count(*)::int from stock_movements), 1, 'queda registrado el movimiento');
select throws_ok($$select apply_stock_movement('77777777-0000-0000-0000-000000000002', -4)$$, 'HZ001', null, 'no permite stock negativo');
select is((select stock_qty from materials where id = '77777777-0000-0000-0000-000000000002'), 3.000, 'el stock no cambió tras el rechazo');

-- Producción atómica: todo o nada
select throws_ok($$select confirm_production(null, '55555555-0000-0000-0000-000000000001', '[{"material_id":"77777777-0000-0000-0000-000000000001","qty":4},{"material_id":"77777777-0000-0000-0000-000000000002","qty":9}]'::jsonb)$$, 'HZ001', null, 'si un material no alcanza, falla toda la producción');
select is((select stock_qty from materials where id = '77777777-0000-0000-0000-000000000001'), 15.000, 'no se descontó nada del otro material');
select is((select confirm_production(null, '55555555-0000-0000-0000-000000000001', '[{"material_id":"77777777-0000-0000-0000-000000000001","qty":4},{"material_id":"77777777-0000-0000-0000-000000000002","qty":2}]'::jsonb)), 2, 'descuenta ambos cuando alcanza');

-- Aislamiento
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from materials) + (select count(*)::int from consumption_rules) + (select count(*)::int from stock_movements), 0, 'B no ve nada de A');
select throws_ok($$select apply_stock_movement('77777777-0000-0000-0000-000000000001', 100)$$, 'P0002', null, 'B no puede mover el stock de A');

select * from finish();
rollback;
