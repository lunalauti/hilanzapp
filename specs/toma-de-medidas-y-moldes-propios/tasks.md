# Tareas — Toma de medidas guiada y prendas sin molde

> Orden: base de datos y motor primero (con tests), luego API, luego web. Cada tarea deja los tests en verde.

- [x] 1. Migración: `has_pattern`, orden corporal, ayuda por medida y `link_placeholder_mold`
  - `supabase/migrations/20260926000000_placeholder_molds.sql`: `mold_types.has_pattern` y función `link_placeholder_mold` (`HZ002`–`HZ005`). *Cambio respecto de lo diseñado:* el orden corporal (`measureOrder`) y el texto de ayuda (`MEASURE_HELP`) viven en `packages/seed-data` y la API los calcula por `key`; así no hace falta migrar `measure_definitions` de las usuarias existentes ni duplicar datos en SQL.
  - `supabase/tests/database/measure_plan.test.sql` (pgTAP): default, conservación de asignaciones/consumo/hojas al vincular, conflictos, RLS.
  - `packages/seed-data/src/measures.ts`: reordenar `BASE_MEASURES` por orden corporal y sumar `help`; bootstrap/plantillas copian `help` y `sort`.
  - _Reqs: 1.2, 8, 11, 12_

- [x] 2. Motor: `buildMeasurePlan` (puro)
  - `packages/pattern-engine/src/measurePlan.ts` + export en `index.ts` + `measurePlan.test.ts`: unión sin duplicados, orden, `requiredBy`, especiales, fallback a base requeridas, estado.
  - _Reqs: 1, 4, 7_

- [x] 3. API: servicio y rutas del plan de medidas
  - `services/measurePlan.ts` (`plansForDancers`), `routes/measurePlan.ts` (`GET /dancers/:id/measure-plan`, `GET /groups/:id/measure-plan`), montar en `routes/index.ts`; `GET /measure-definitions` con `sort` y `help`.
  - Test de integración `measurePlan.int.test.ts`.
  - _Reqs: 1, 4, 6.2, 6.3, 12_

- [x] 4. API: estado de completitud según lo asignado
  - `services/dancers.ts` y `repositories/groups.ts` toman `status`, `requiredDone`, `requiredTotal` del plan; actualizar tests existentes que dependan del estado.
  - _Reqs: 5.4, 7_

- [x] 5. API: prendas sin molde (crear, editar, listar)
  - `services/placeholderMolds.ts`; `routes/designs.ts` acepta `custom` en `garments[]`; `PUT` de medidas requeridas; `hasPattern` en `moldView`, vistas de prendas (dancers, sizing, production, inventory, designs) y en `POST /calculations`; `replaceDefinition` fija `has_pattern`.
  - Tests: `placeholderMolds.int.test.ts` (crear desde diseño, nombre repetido, asignar al grupo, talle sugerido/manual, producción, costos con consumo por talle, cálculo sin patrón).
  - _Reqs: 8, 9, 10.1_

- [x] 6. API: vincular molde y vista previa
  - `GET /mold-types/:id/link-preview`, `POST /mold-types/:id/link` (mapea `HZ002`/`HZ003` a 409); tests de integración.
  - _Reqs: 11_

- [x] 7. API: PDF de faltantes del grupo y hoja simplificada sin molde
  - `services/pdf.ts` / `services/exports.ts`: `GET /groups/:id/measure-plan/pdf`; hoja de prenda sin molde; fila "Sin molde" en el PDF de producción.
  - Tests en `exports.int.test.ts`.
  - _Reqs: 6.4, 10.4, 9.3_

- [x] 8. Web: tipos, consultas y utilidades de la toma
  - `lib/types.ts`, `lib/queries.ts` (`useMeasurePlan`, `useGroupPlan`, invalidaciones), `lib/takeMeasures.ts` (cola, saltar/volver, extras, nombres cortos) + tests.
  - _Reqs: 2, 3_

- [x] 9. Web: flujo "Tomar medidas" (móvil y escritorio)
  - `pages/measures/TakeMeasures.tsx`, `AddMeasuresSheet.tsx`, `MeasureSummary.tsx`; rutas `/dancers/:id/medir` (fuera del `AppShell`), estilos móvil (pie fijo) y modal de 480 px en escritorio; ayuda "¿Cómo se toma?", "Antes: …", "Repetir medición", errores y reintento.
  - Tests del flujo.
  - _Reqs: 2, 3_

- [x] 10. Web: puntos de entrada
  - `MeasuresTab` (tarjeta de faltantes y tres secciones), `MoldSheet` (botón "Tomar las N que faltan" y retorno con aviso), `DancerFormModal`/`AssignGroupModal` (panel "vas a necesitar"), `GroupDancers` (chip, acción rápida).
  - Tests actualizados/nuevos.
  - _Reqs: 4, 5, 7_

- [x] 11. Web: toma y faltantes del grupo
  - `/groups/:id/medir` (pantalla intermedia entre bailarinas), `/groups/:id/faltantes` (tarjetas/tabla, filtro, imprimir), botón de PDF.
  - _Reqs: 6_

- [x] 12. Web: prendas sin molde en el diseño
  - `PlaceholderGarmentModal`, cambios en `DesignFormModal` (botón, lista con etiqueta, menú ⋯, confirmación al quitar con conteo), `NoPatternBadge` en Producción, Inventario, ficha (Talle), lista del grupo.
  - _Reqs: 8, 9.4_

- [x] 13. Web: hoja de molde sin molde, crear y vincular
  - `MoldSheet` (estado sin molde, medidas para trazar a mano, exportar PDF), `LinkMoldModal`, acceso desde el editor de fórmulas con banner "Molde nuevo desde…" y etiqueta en `FormulaEditor`.
  - _Reqs: 10, 11_

- [x] 14. Verificación final y documentación
  - Typecheck, tests de todos los paquetes, `supabase test db`, builds; revisar en el navegador a 360 px y escritorio; actualizar `specs/hilanzapp-mvp/tasks.md` con referencia a este spec.
  - _Reqs: todos_

> Implementado el 26/09/2026. Verificación: pattern-engine 37, seed-data 37, API 162, web 202 tests y `supabase test db` (67) en verde; typecheck y builds sin errores. Pendiente para producción: `npx supabase db push` (migración `20260926000000_placeholder_molds.sql`).
