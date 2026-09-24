# Tareas — Hilanzapp

Convenciones: TypeScript estricto, Vitest en todos los paquetes, un test primero por cada tarea. Cada fase deja la aplicación usable. Los paths son relativos a la raíz del repo.

## Fase 0 — Fundaciones

- [ ] 1. Monorepo y herramientas base
  - `package.json` con npm workspaces (`apps/*`, `packages/*`), `tsconfig.base.json` estricto, ESLint, Prettier, Vitest raíz, `.gitignore`, `.env.example`.
  - `.github/workflows/ci.yml`: lint, typecheck y tests en cada push.
  - Test: un test humo por paquete que corre en CI.
  - Estado: hechos workspaces, tsconfig base, `.gitignore`, `.env.example` y CI. Ya existen `apps/web`, `packages/pattern-engine` y `packages/seed-data`, cada uno con sus tests en CI. Pendientes ESLint, Prettier y `apps/api` (se crea en la tarea 9).
  - _Reqs: 1-15 (base técnica)_

## Fase 1 — Motor de moldería y talles (puro, sin base de datos)

- [x] 2. Evaluador de fórmulas (`packages/pattern-engine`)
  - [x] 2.1 Tipos (`Formula`, `MoldInput`, `MoldDefinition`, `CalcResult`) y parser de operandos: constante decimal, fracción `"2/3"` y referencia. Usa `decimal.js`.
    - Test: parseo de `0,15`, `3,14`, `2/3`, referencias y operandos inválidos.
    - _Reqs: 5, 12_
  - [x] 2.2 `calculateMold`: resuelve inputs `measure | standard | manual | choice`, ordena fórmulas topológicamente, aplica `op` + `adjustment_cm` y redondea solo al mostrar (`decimals`). Devuelve filas `{key, label, section, realValue, formula, result}` o `missing[]`.
    - Test: pecho 88 → 22; cuello 36 → 6; espalda 40 → 20; sisa 21 → 20 y 14; ejemplo "pecho ÷ 4 + 0,5".
    - _Reqs: 4.2, 4.3, 5.1, 5.7, 12.2_
  - [x] 2.3 `validateFormulaSet`: detecta referencia inexistente, ciclos y divisor cero.
    - Test: un caso por cada error, más un set válido.
    - _Reqs: 12.5_

- [x] 3. Plantillas de moldes y fórmulas (`packages/seed-data`)
  - JSON con medidas base (Req 3.1), 11 moldes (cuerpo base, manga, pantalón, 7 faldas, vestido con canesú), inputs `manual` (sisa, largo de canesú) y `choice` (vuelo 3,14 / 6,28 / 12,56) y `size_priority` por molde.
  - Test de oro: cada fórmula del Req 5 evaluada con valores del documento original (radio ÷ 3,14 / 6,28 / 12,56, elástico × 0,85, tiro delantero y trasero, largo de falda del vestido) y un test que valida el set con `validateFormulaSet`.
  - _Reqs: 3.1, 4.1, 4.4, 4.5, 5.2, 5.3, 5.4, 5.5, 12.6_

- [x] 4. Tablas de talles de Baúl de Moda
  - [x] 4.1 Transcribir a JSON las tablas Bebés (etiquetas `B0`-`B7`), Niños (4-12) y Mujeres (40-48 y 50-58 unificadas) con valores dispersos permitidos y `origin='source'`.
    - Test: cada talle tiene pecho, cintura y cadera; los valores son monótonos por medida; totales coinciden con las tablas fuente.
    - _Reqs: 6.1_
  - [x] 4.2 `interpolateTable`: genera Adolescentes (talles 14, 16 y 18 a 1/4, 2/4 y 3/4 entre Niños 12 y Mujeres 40), excluye `largo_falda`, marca `origin='interpolated'`. Completa `altura_tiro` de Mujeres 40-48 por extrapolación de +0,6 cm por talle (`origin='extrapolated'`).
    - Test: pecho 80 → 86 da 81,5 / 83 / 84,5; no se repiten etiquetas; los valores fuente quedan intactos; tiro 25,6 a 28,0.
    - _Reqs: 6.1, 6.2, 5.6_

- [x] 5. Sugerencia de talle y talle efectivo
  - `suggestSize(table, measures, priority)`: talle más cercano con empate al mayor, `out_of_range`, desglose por medida, prioridad `pecho | cadera | both`. `defaultTableForAge(age)` (0-1, 2-12, 13-17, 18+). `effectiveSize(assignment, dancer, suggested)`: por prenda → general → sugerido.
  - Test: ejemplo del Req 6 (pecho 73, cintura 61, cadera 78); empates; fuera de rango; molde `both` devuelve dos desgloses sin forzar uno; cadena de talle efectivo.
  - _Reqs: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 6. `aggregateProduction`
  - Agrupa por prenda y talle efectivo, cuenta y lista nombres; separa `pending`.
  - Test: ejemplo del Req 7 (pantalón: T8 ×3, T10 ×4, T12 ×2, T14 ×1); bailarina sin talle ni prenda va a `pending`.
  - _Reqs: 7.1, 7.2, 7.4_

## Fase 2 — Base de datos y API núcleo

- [x] 7. Migración del núcleo (`supabase/migrations`)
  - Tablas `groups`, `dancers`, `measure_definitions`, `measurement_versions` con índice único parcial `is_current`; funciones `set_measurement` y `restore_measurement`; vista `dancer_measure_status`; RLS `owner_id = auth.uid()` en todas.
  - Test (supabase local): dos usuarias de prueba; una no ve ni modifica datos de la otra; `set_measurement` deja una sola vigente; restaurar inserta versión nueva.
  - _Reqs: 1, 2, 3, 8.1, 8.2, 10.1, 10.3_

- [x] 8. Migración de talles, moldes, diseños y asignaciones
  - Tablas `size_tables`, `size_table_sizes`, `size_table_values`, `mold_types`, `mold_inputs`, `mold_formulas`, `assignments`, `pattern_sheets`, `designs`, `design_garments`, `design_special_measures`, `catalog_options`, `group_designs`; índices únicos y RLS.
  - Test: RLS con dos usuarias; unicidad de tabla activa por rango etario; unicidad de `(dancer, design, mold)`.
  - _Reqs: 4, 5, 6, 7, 11, 12, 13_

- [x] 9. Esqueleto de la API (`apps/api`)
  - Express + `zod`, capas routes → services → repositories, middleware de auth (JWT con `jose` y JWKS) que crea el cliente Supabase por request, manejador de errores con envelope `{error:{code,message,details}}`, `GET /health`, CORS restringido por variable de entorno.
  - Test: 401 sin token o con token inválido; envelope de errores; CORS.
  - _Reqs: 8.1, 8.3_

- [x] 10. `POST /me/bootstrap`
  - Copia plantillas de `seed-data` a filas de la usuaria de forma idempotente (medidas, moldes, fórmulas, tablas de talles, catálogos). Función `restoreTemplate(kind, key)` reutilizable.
  - Test: correr dos veces no duplica; datos quedan con `template_key`; una segunda usuaria recibe su propia copia.
  - _Reqs: 5, 6.1, 11.2, 12.6_

- [x] 11. Rutas de grupos
  - `GET/POST/PATCH /groups`, `DELETE /groups/:id?confirm=true` (409 `HAS_DEPENDENTS` con conteo si no viene `confirm`).
  - Test: alta, edición, nombre vacío 422, borrado con y sin confirmación.
  - _Reqs: 1.1, 1.3, 1.4, 1.5_

- [x] 12. Rutas de bailarinas
  - `GET /groups/:id/dancers` (talle efectivo, estado de medidas, vestuario), `POST/PATCH/DELETE /dancers` (mover de grupo conserva medidas y talles; borrado en cascada con `confirm`).
  - Test: campos mínimos, mover de grupo, cascada, estado ninguna/parcial/completa.
  - _Reqs: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.6_

- [x] 13. Rutas de medidas y versiones
  - `GET/POST /measure-definitions`, `GET /dancers/:id/measurements`, `PUT .../measurements/:defId`, `GET .../history`, `POST .../restore`, `GET .../compare`.
  - Test: valores negativos o no numéricos dan 422; la medida real nunca se sobrescribe; historial en orden cronológico; comparación entre dos tomas.
  - _Reqs: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 14. Rutas de talles y asignaciones
  - `GET /dancers/:id/sizing`, `PUT /dancers/:id/size`, `POST/PATCH/DELETE /assignments`, `POST /groups/:id/design-assignment`. Llaman a `pattern-engine`.
  - Test: desglose por medida, talle manual general y por prenda, asignación masiva a todas las bailarinas del grupo, tabla forzada por bailarina.
  - _Reqs: 4.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 11.4_

- [x] 15. Rutas de moldería y hojas de molde
  - `GET /mold-types`, `POST /calculations` (422 `MISSING_MEASUREMENTS` y `MISSING_STANDARD`), `POST /pattern-sheets`, `GET /dancers/:id/pattern-sheets`, `GET /pattern-sheets/:id`.
  - Test: cálculo con medidas reales y estándar tomado de la tabla; faltantes bloquean el cálculo y se listan; sisa manual; el snapshot conserva los valores aunque se cambie la fórmula después.
  - _Reqs: 4.2, 4.3, 4.4, 4.5, 5.1, 5.6, 5.7, 6.8, 12.4_

- [x] 16. Ruta de producción
  - `GET /groups/:id/production` con `by_garment` y `pending`, recalculado en cada lectura.
  - Test: cambiar una medida, un talle manual o una prenda cambia el resumen; excluye pendientes.
  - _Reqs: 7.1, 7.2, 7.3, 7.4_

## Fase 3 — Aplicación web núcleo

- [x] 17. Esqueleto de la SPA (`apps/web`)
  - Vite + React 18 + React Router + `react-bootstrap`, tema Bootstrap propio (tokens de color, tipografía), cliente API que adjunta el JWT, login con `supabase-js`, guardia de rutas, llamada a `/me/bootstrap` tras el primer login, TanStack Query, layout *mobile-first*.
  - Test: sin sesión redirige a `/login`; con sesión renderiza; el cliente adjunta el token.
  - _Reqs: 8.1, 8.3_

- [x] 18. Inicio y pantalla de grupo
  - Lista de grupos con "Nuevo grupo", pantalla de grupo con bailarinas (nombre, talle efectivo, estado de medidas, vestuario), alta, edición y borrado con confirmación y conteo.
  - Test (Testing Library): validación de nombre, confirmación de borrado, estado de medidas.
  - _Reqs: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 3.6_

- [x] 19. Ficha de bailarina y medidas
  - Datos generales, medidas base en cm, "+ Agregar medida personalizada" (nombre, valor, observación), edición en línea, mover de grupo.
  - Test: validación de valores, alta de medida personalizada, edición sin duplicar.
  - _Reqs: 2.1, 2.3, 2.5, 3.1, 3.2, 3.3, 3.5_

- [x] 20. Sugerencia de talle en la ficha
  - Panel con desglose por medida, talle sugerido, aviso de fuera de rango, talle manual general y talle por prenda, mostrando siempre sugerido y manual distinguibles.
  - Test: el manual reemplaza al sugerido como efectivo y el original sigue visible.
  - _Reqs: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 21. Hoja de molde
  - Selector de molde con las medidas requeridas y las faltantes, campos manuales (sisa, largo de canesú), opción de vuelo, tabla lado a lado medida real y resultado, botón guardar.
  - Test: molde con faltantes bloquea y enlaza a la ficha; el resultado no toca la medida real; manga pide la sisa.
  - _Reqs: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.7_

- [x] 22. Pantalla de producción
  - Resumen por prenda y talle, expansión con nombres, pendientes destacados.
  - Test: expansión, recálculo tras cambiar un talle, pendientes.
  - _Reqs: 7.1, 7.2, 7.3, 7.4_

- [x] 23. Configuración de despliegue
  - `render.yaml` (build `tsc`, start `node dist`, health check), `apps/web/vercel.json` (rewrite SPA), `.env.example` de cada app, script de verificación de variables al arrancar la API.
  - Test: la API falla con mensaje claro si falta una variable; CORS acepta solo el origen configurado.
  - _Reqs: 8.2_

## Fase 4 — Historial, fotos y PDF

- [x] 24. Historial y comparación de medidas (UI)
  - Historial por medida, restaurar versión, comparar dos tomas lado a lado.
  - Test: restaurar crea versión nueva; el valor vigente alimenta los cálculos.
  - _Reqs: 10.2, 10.3, 10.4, 10.5_

- [x] 25. Almacenamiento de imágenes (API)
  - Migración del bucket privado `design-images` (5 MB, JPG/PNG/WebP, política por carpeta del usuario), tabla `design_images`, endpoints `upload-url`, registro y borrado, URLs firmadas de lectura.
  - Test: tipo o tamaño no permitido da 415/413; otra usuaria no accede al objeto; registrar un objeto inexistente falla.
  - _Reqs: 9.1, 9.2, 9.3, 9.5_

- [x] 26. Imágenes de referencia (UI)
  - Subida directa con URL firmada, miniaturas, ampliar y eliminar, mostradas en la ficha del diseño y en la hoja de molde.
  - Test: rechazo visible de archivos inválidos; miniaturas en la hoja de molde.
  - _Reqs: 9.1, 9.2, 9.3, 9.4_

- [x] 27. Exportación a PDF (API)
  - `pdfkit` con fuente TTF embebida: hoja de molde, resumen de producción y lote de hojas de un grupo, con imágenes de referencia si existen.
  - Test: el buffer empieza con `%PDF` y `pdf-parse` encuentra nombre, medidas, resultados y símbolos `÷` `×`.
  - _Reqs: 14.1, 14.2, 14.4_

- [x] 28. Impresión y botones de exportar (UI)
  - Estilos `@media print` A4 para la hoja de molde y la producción, botones "Exportar PDF" e "Imprimir", selección múltiple de bailarinas para el lote.
  - Test: los controles de navegación tienen la clase de ocultar al imprimir; el lote envía las bailarinas seleccionadas.
  - _Reqs: 14.1, 14.2, 14.3, 14.4_

## Fase 5 — Diseño de vestuario, fórmulas y tablas editables

- [x] 29. Diseños y catálogos (API)
  - CRUD de diseños con prendas, medidas especiales, catálogos y valores "Otro" reutilizables.
  - Test: valor personalizado queda disponible para el siguiente diseño; medida especial se vincula a una definición.
  - _Reqs: 11.1, 11.2, 11.3, 11.5_

- [x] 30. Diseños (UI)
  - Editor de diseño (escote, manga, falda, volado, asimetría, detalles), asignación a grupo o bailarina y vestuario visible en la vista de grupo.
  - Test: "Otro" guarda valor nuevo; asignar a grupo crea asignaciones para todas.
  - _Reqs: 11.1, 11.3, 11.4_

- [x] 31. Editor de moldes y fórmulas (API)
  - `POST/PATCH/DELETE /mold-types`, `PUT /mold-types/:id/formulas` con validación, `POST /mold-types/:id/restore-defaults`.
  - Test: 422 `FORMULA_INVALID` por ciclo, referencia inexistente y divisor cero; restaurar devuelve el original; editar no altera hojas guardadas.
  - _Reqs: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 32. Editor de moldes y fórmulas (UI)
  - Pantalla `/settings/molds`: elegir medida, operación, operando y ajuste; definir medidas requeridas y datos manuales; vista previa con una bailarina; restaurar.
  - Test: vista previa refleja el cambio; errores de validación en línea.
  - _Reqs: 12.1, 12.2, 12.3, 12.5, 12.6_

- [x] 33. Tablas de talles editables (API)
  - `PATCH /size-tables/:id/values`, `POST /size-tables` (personalizada), `duplicate`, `activate`, `restore`; recálculo implícito por cálculo en lectura.
  - Test: la original queda intacta al duplicar; activar cambia la sugerencia sin tocar talles manuales; restaurar vuelve a las plantillas.
  - _Reqs: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 34. Tablas de talles editables (UI)
  - Pantalla `/settings/size-tables` con edición de celdas, crear, duplicar, activar y restaurar; origen (`source/interpolated/extrapolated/user`) visible por celda.
  - Test: edición y guardado, duplicar, activar; marca visible en valores extrapolados.
  - _Reqs: 13.1, 13.2, 13.3, 13.5_

## Fase 6 — Consumo de tela, costos e inventario

- [x] 35. Migración de inventario
  - Tablas `materials`, `consumption_rules`, `stock_movements`, `labor_cost` en `design_garments`; funciones `apply_stock_movement` y `confirm_production` atómicas; RLS.
  - Test: descuento atómico, stock insuficiente falla sin cambios parciales, RLS entre usuarias.
  - _Reqs: 15.2, 15.5_

- [x] 36. Inventario, costos y estadísticas (API)
  - `GET/POST/PATCH /materials`, `PUT /consumption-rules`, `GET /groups/:id/costs`, `POST /groups/:id/production/confirm`, `GET /stats`.
  - Test: consumo total por talle y unidades, costo de materiales más mano de obra, faltantes, estadísticas por talle y costo por grupo.
  - _Reqs: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 37. Inventario y costos (UI)
  - Pantalla `/inventory`: materiales, consumo por prenda y talle, costos por grupo, faltantes resaltados, confirmar producción, estadísticas.
  - Test: alta de material, faltante visible, confirmación descuenta stock.
  - _Reqs: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

## Fase 7 — Cierre

- [ ] 38. Prueba de extremo a extremo (Playwright)
  - Flujo completo: login, crear grupo, cargar bailarina y medidas, generar hoja de molde, ver producción, exportar PDF. Se ejecuta en CI contra Supabase local.
  - _Reqs: 1, 2, 3, 4, 5, 6, 7, 14_
