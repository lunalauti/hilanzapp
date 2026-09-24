-- Contacto opcional de la bailarina (o de su familia): teléfono o email.
alter table public.dancers add column contact text check (contact is null or length(contact) <= 200);
