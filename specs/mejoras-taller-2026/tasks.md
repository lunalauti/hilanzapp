# Tareas — Mejoras de taller 2026

> `design.md` aprobado automáticamente. Las tareas están ordenadas de menor a mayor riesgo/tamaño: primero el bug (rápido y aislado), después las mejoras solo-web, después las que suman esquema nuevo.

- [x] 1. Arreglar el bug de decimales en el operando de fórmula
  - `apps/web/src/pages/formulas/FormulaEditor.tsx`: cambiar `operandIsRef` para aceptar un número en construcción (`/^\d+([.,]\d*)?$/`) sin activar el modo "Otra medida".
  - Test: escribir "3," no debe cambiar el toggle; guardar con un operando incompleto sigue rechazándose igual que hoy.
  - _Reqs: 5_

- [x] 2. Buscador y vista de lista en Diseños
  - `apps/web/src/pages/designs/DesignsList.tsx`: campo de búsqueda (sin tildes/mayúsculas), alternancia Cuadrícula/Lista persistida en `localStorage`, estado vacío con el texto buscado.
  - Reutilizar `.hz-list`/`.hz-row` para la vista de lista.
  - Tests.
  - _Reqs: 4_

- [x] 3. Arrastrar para reordenar medidas de "Prenda sin molde"
  - Instalar `@dnd-kit/core` y `@dnd-kit/sortable`.
  - `apps/web/src/components/designs/PlaceholderGarmentModal.tsx`: envolver la lista en `DndContext`/`SortableContext`, conectar `onDragEnd` a la lógica de reordenar existente; mantener los botones Subir/Bajar; `aria-live` del cambio de posición.
  - Tests (reordenar con teclado vía `@dnd-kit`, que ya es accesible).
  - _Reqs: 2_

- [x] 4. Crear/vincular molde sin cerrar el formulario de diseño
  - `apps/web/src/components/designs/DesignFormModal.tsx`: al vincular una prenda (`onLinked`), actualizar la fila local en vez de cerrar el modal completo.
  - Test.
  - _Reqs: 3_

- [x] 5. Categorías de grupo: migración y API
  - `supabase/migrations/20260930000000_group_categories_and_archive.sql`: tabla `group_categories`; `groups` agrega `category_id`, `archived_at`; RLS.
  - `apps/api/src/repositories/groupCategories.ts`, `routes/groupCategories.ts` (`GET/POST/PATCH/DELETE /group-categories`).
  - `apps/api/src/repositories/groups.ts` y `routes/groups.ts`: `categoryId`/`archived` en `PATCH /groups/:id`; `GET /groups` excluye archivados salvo `?incluir_archivados=1`.
  - pgTAP: alta, `on delete set null` al borrar categoría, RLS.
  - Tests de integración: crear/editar/borrar categoría, archivar y desarchivar un grupo, listar con y sin archivados.
  - _Reqs: 1_

- [x] 6. Categorías de grupo: web
  - `apps/web/src/components/GroupCategoryModal.tsx` (nuevo); `GroupFormModal` agrega selector de categoría; `pages/Home.tsx` agrupa por categoría con sección "Sin categoría"; filtro "Ver archivados"; `ActionMenu` del grupo agrega "Archivar grupo"/"Desarchivar".
  - Tests.
  - _Reqs: 1_

- [x] 7. Intervalos en la tabla de talles: motor y migración
  - `packages/pattern-engine/src/sizing.ts`: `SizeRow` admite `ranges` opcional; `sizeForMeasure` prioriza el rango que contiene el valor, con el criterio actual como respaldo (superposición, fuera de rango, sin rangos).
  - Tests en `sizing.test.ts` cubriendo los cuatro casos, más regresión de los tests existentes.
  - `supabase/migrations/20260930000100_size_intervals.sql`: `size_table_values` agrega `min_cm`, `max_cm`, `check (min_cm is null or max_cm is null or min_cm <= max_cm)`.
  - pgTAP del constraint.
  - _Reqs: 8.1, 8.2, 8.3_

- [x] 8. Intervalos en la tabla de talles: API y editor
  - `apps/api/src/routes/sizeTables.ts` y `services/sizeTables.ts`: `PATCH /size-tables/:id/values` acepta `minCm`/`maxCm` por celda; `value_cm` se recalcula como punto medio al guardar un intervalo.
  - `apps/web/src/pages/tables/Cell.tsx`: edición de mín/máx además del valor único.
  - Tests de integración y de componente.
  - _Reqs: 8.1_

- [x] 9. Producción en dos etapas: migración y API
  - `supabase/migrations/20260930000200_production_stages.sql`: tablas `production_stages` y `production_units`, RLS.
  - `apps/api/src/services/production.ts`: `groupProduction` adjunta `patternDone`, `sewnCount`/`sewnTotal` por combinación prenda+talle.
  - `apps/api/src/routes/production.ts`: `PUT /groups/:id/production/pattern`, `PUT /assignments/:id/sewn`.
  - pgTAP: unicidad de `production_stages`, `production_units` existe-o-no, RLS.
  - Tests de integración: marcar/desmarcar patrón, marcar/desmarcar confección por bailarina, conteo al cambiar asignaciones.
  - _Reqs: 7.1, 7.2, 7.4, 7.5_

- [x] 10. Producción en dos etapas: web
  - `apps/web/src/pages/Production.tsx`: checkbox "Patrón listo" por talle; lista expandible de bailarinas con checkbox de confección; cantidad tachada al completar; resumen por prenda.
  - Tests de componente.
  - _Reqs: 7.3, 7.6_

- [x] 11. Promedio real de medidas por talle: API
  - `apps/api/src/services/production.ts`: `sizeAverages(db, groupId, moldTypeId, sizeLabels)` con origen `real`/`table` por medida y `dancerCount`.
  - `apps/api/src/routes/production.ts`: `GET /groups/:id/production/size-averages`.
  - Tests de integración: con datos reales, sin datos (respaldo de tabla), varios talles a la vez, talle fuera de la tabla activa.
  - _Reqs: 8.4, 8.5, 8.6, 8.8_

- [x] 12. Promedio real de medidas por talle: web
  - `apps/web/src/components/production/SizeAveragesModal.tsx` (nuevo): tabla de medidas por talle elegido (uno o varios), marca de origen, "promedio de N bailarinas".
  - Botón "Ver medidas del talle" en `Production.tsx`.
  - Tests.
  - _Reqs: 8.4, 8.6, 8.7_

- [x] 13. Mano de obra visible en Inventario
  - `apps/web/src/pages/inventory/Inventory.tsx`: sección "Mano de obra" separada de "Materiales", desglose por prenda.
  - Test.
  - _Reqs: 6.1_

- [x] 14. PDF "Lista de materiales" (sin precios)
  - `apps/api/src/services/inventory.ts`: `materialsListPdfData`.
  - `apps/api/src/services/pdf.ts`: `renderMaterialsList` (formato de `SYNAP 2025.pdf`: ficha por prenda, material con consumo unitario y total "aprox.", renglón de hilos, observaciones).
  - `apps/api/src/routes/exports.ts`: `GET /groups/:id/materials-list/pdf`.
  - Botón "Lista de materiales" en `Inventory.tsx`.
  - Tests: contenido del PDF, ausencia de cualquier precio, caso sin reglas de consumo.
  - _Reqs: 6.2, 6.3, 6.4, 6.5, 6.7_

- [x] 15. PDF "Presupuesto de confección" (solo mano de obra)
  - `apps/api/src/services/inventory.ts`: `laborBudgetPdfData`.
  - `apps/api/src/services/pdf.ts`: `renderLaborBudget` (prenda × cantidad × costo unitario × subtotal, total general).
  - `apps/api/src/routes/exports.ts`: `GET /groups/:id/labor-budget/pdf`.
  - Botón "Presupuesto de confección" en `Inventory.tsx`.
  - Tests: contenido, ausencia de cualquier dato de materiales.
  - _Reqs: 6.6, 6.7_

- [x] 16. Verificación final
  - Typecheck, todos los tests (pattern-engine, seed-data, API, web), `supabase test db`, builds.
  - Revisar en el navegador (móvil y escritorio): Diseños con buscador, arrastre de medidas, categorías en Home, talle con intervalo, checkboxes de producción, los dos PDF nuevos.
  - Actualizar `specs/hilanzapp-mvp/tasks.md` con la referencia a este spec.
  - _Reqs: todos_
