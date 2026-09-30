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
select lives_ok($$insert into group_categories (id, name) values ('99999999-0000-0000-0000-000000000001', 'Temporada 2026')$$, 'A crea una categoría');
select throws_ok($$insert into group_categories (name) values ('Temporada 2026')$$, '23505', null, 'no permite el nombre repetido');

select lives_ok($$insert into groups (id, name, category_id) values ('11111111-0000-0000-0000-000000000001', 'Ágata', '99999999-0000-0000-0000-000000000001')$$, 'A crea un grupo con categoría');
select lives_ok($$insert into groups (id, name) values ('11111111-0000-0000-0000-000000000002', 'Jade')$$, 'A crea un grupo sin categoría');
select is((select category_id from groups where id = '11111111-0000-0000-0000-000000000001'), '99999999-0000-0000-0000-000000000001'::uuid, 'el grupo queda con su categoría');

-- Borrar la categoría no borra los grupos: quedan sin categoría.
select lives_ok($$delete from group_categories where id = '99999999-0000-0000-0000-000000000001'$$, 'A borra la categoría');
select is((select category_id from groups where id = '11111111-0000-0000-0000-000000000001'), null, 'el grupo sobrevive sin categoría');
select is((select count(*)::int from groups), 2, 'los dos grupos siguen existiendo');

-- Archivar un grupo: no se borra nada, solo queda marcado.
select lives_ok($$update groups set archived_at = now() where id = '11111111-0000-0000-0000-000000000002'$$, 'A archiva un grupo');

-- Aislamiento
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from group_categories) + (select count(*)::int from groups), 0, 'B no ve nada de A');

select * from finish();
rollback;
