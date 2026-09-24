-- Imágenes de referencia de los diseños (Req 9): bucket privado + tabla de metadatos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-images', 'design-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create table public.design_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  design_id uuid not null,
  storage_path text not null unique,
  filename text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (design_id, owner_id) references public.designs (id, owner_id) on delete cascade
);
create index design_images_design_idx on public.design_images (design_id, sort);

alter table public.design_images enable row level security;
create policy design_images_owner on public.design_images for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.design_images from anon;

-- Storage: cada usuaria solo accede a su carpeta ({owner_id}/...)
create policy design_images_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'design-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy design_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'design-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy design_images_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'design-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy design_images_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'design-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
