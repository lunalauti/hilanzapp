begin;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select is((select public from storage.buckets where id = 'design-images'), false, 'el bucket es privado');
select is((select file_size_limit from storage.buckets where id = 'design-images'), 5242880::bigint, 'límite de 5 MB en el bucket');
select is((select allowed_mime_types from storage.buckets where id = 'design-images'), array['image/jpeg', 'image/png', 'image/webp'], 'solo JPG, PNG y WebP');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into designs (id, name) values ('55555555-0000-0000-0000-000000000001', 'Aurora');
select lives_ok($$insert into design_images (design_id, storage_path, filename, mime, size_bytes) values ('55555555-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/55555555-0000-0000-0000-000000000001/x.jpg', 'x.jpg', 'image/jpeg', 1000)$$, 'A registra una imagen');
select throws_ok($$insert into design_images (design_id, storage_path, filename, mime, size_bytes) values ('55555555-0000-0000-0000-000000000001', 'p2', 'x.gif', 'image/gif', 1000)$$, '23514', null, 'rechaza formatos no permitidos');
select throws_ok($$insert into design_images (design_id, storage_path, filename, mime, size_bytes) values ('55555555-0000-0000-0000-000000000001', 'p3', 'x.jpg', 'image/jpeg', 6000000)$$, '23514', null, 'rechaza más de 5 MB');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('design-images', 'aaaaaaaa-0000-0000-0000-000000000001/55555555-0000-0000-0000-000000000001/x.jpg', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'A sube a su propia carpeta');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from design_images) + (select count(*)::int from storage.objects where bucket_id = 'design-images'), 0, 'B no ve imágenes ni objetos de A');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('design-images', 'aaaaaaaa-0000-0000-0000-000000000001/hack.jpg', 'bbbbbbbb-0000-0000-0000-000000000002')$$, '42501', null, 'B no puede escribir en la carpeta de A');

select * from finish();
rollback;
