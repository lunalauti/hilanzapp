-- Intervalos opcionales por celda de tabla de talles (Req 8.1-8.3).
-- value_cm se conserva como punto medio; min_cm/max_cm son opcionales y solo se
-- cargan cuando la modista define un rango para esa medida y talle.

alter table public.size_table_values
  add column min_cm numeric(7, 2),
  add column max_cm numeric(7, 2),
  add constraint size_table_values_range_valid
    check (min_cm is null or max_cm is null or min_cm <= max_cm);
