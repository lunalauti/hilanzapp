# Requerimientos — Toma de medidas guiada y prendas sin molde

## Introducción

Hoy la modista asigna un vestuario a una bailarina y recién en la Hoja de molde se entera de que "faltan 3 de las 3 medidas", con enlaces sueltos a la ficha donde tiene que buscarlas una por una. Además, un diseño solo admite prendas que ya tienen molde: si tiene que hacer un vestido evasé y no tiene molde, no puede cargar la prenda, asignarla ni saber qué medir (caso reportado del grupo Amatista).

Este feature agrega dos cosas: (a) un flujo **"Tomar medidas"**, pensado para usar de pie con la cinta métrica en el celular, que le dice exactamente qué medir y en qué orden; y (b) **prendas propias (sin molde todavía)**, que se comportan como cualquier prenda en asignación, talle, producción, consumo y costos, y que después se pueden convertir en molde o vincular a uno existente.

Principio que se mantiene: *medidas reales para construir el molde; talles para organizar la producción.*

## Estado actual relevante (investigado en el código)

- `assignments.mold_type_id` y `design_garments.mold_type_id` son `NOT NULL`: no existe prenda sin molde (`supabase/migrations/20260924000100_sizes_molds_designs.sql`).
- El estado de medidas (`dancer_measure_status`) cuenta solo las medidas base marcadas `required`, sin mirar qué prendas tiene asignadas la bailarina.
- La Hoja de molde muestra las medidas faltantes como enlaces a `/dancers/:id?tab=medidas` (`apps/web/src/pages/MoldSheet.tsx`), sin orden ni foco en la medida.
- Las **medidas especiales del diseño** se guardan (`design_special_measures`) pero ninguna pantalla de la bailarina las pide, aunque el formulario de diseño dice que "se piden en la ficha".
- El consumo de materiales ya cuelga de `design_garment_id`, y producción/costos agrupan por `mold_type_id` (`apps/api/src/services/inventory.ts`, `production.ts`).
- El talle sugerido depende de `mold_types.size_priority` (pecho / cadera / ambos).

## Requerimientos

### 1. Medidas requeridas según lo asignado

**Historia de usuario:** Como modista, quiero saber qué medidas necesito de cada bailarina según el vestuario que le asigné, para ir a medir una sola vez y sin olvidarme de ninguna.

**Criterios de aceptación:**

1. CUANDO una bailarina tiene prendas asignadas EL SISTEMA DEBERÁ calcular su lista de medidas requeridas como la unión, sin duplicados, de: las medidas de tipo "medida" que piden los moldes de sus prendas, las medidas requeridas de sus prendas propias sin molde, y las medidas especiales de los diseños asignados.
2. EL SISTEMA DEBERÁ ordenar esa lista en un orden fijo de toma (de arriba hacia abajo del cuerpo: cuello, hombros, busto/pecho, cintura, cadera, largos…), definido por un campo de orden en las definiciones de medida y no por el orden en que aparecen en los moldes.
3. EL SISTEMA DEBERÁ indicar, para cada medida requerida, qué prenda(s) y diseño(s) la piden, y si ya está cargada (con su valor y fecha) o falta.
4. SI la bailarina no tiene prendas asignadas ENTONCES EL SISTEMA DEBERÁ usar como requeridas las medidas base marcadas como requeridas (comportamiento actual).
5. CUANDO cambia la asignación de la bailarina (se agrega o quita una prenda o un diseño) EL SISTEMA DEBERÁ recalcular la lista y el estado de completitud sin acción manual.

### 2. Flujo guiado "Tomar medidas" (una bailarina)

**Historia de usuario:** Como modista, quiero un botón "Tomar medidas" que me lleve medida por medida, para cargar todo rápido mientras mido, sin buscar campos.

**Criterios de aceptación:**

1. CUANDO la modista toca "Tomar medidas" EL SISTEMA DEBERÁ abrir un flujo a pantalla completa que muestre de a una las medidas requeridas que faltan, en el orden del requerimiento 1, con el nombre de la medida, para qué prenda se pide, el progreso ("3 de 7") y un campo numérico grande con teclado numérico.
2. CUANDO la modista confirma un valor (botón "Siguiente" o Enter) EL SISTEMA DEBERÁ guardarlo como nueva versión de la medida, avanzar a la siguiente y no perder lo ya cargado si se cierra el flujo.
3. EL SISTEMA DEBERÁ aceptar coma o punto decimal, y validar el rango (0 a 1000 cm, mismo criterio que la ficha) mostrando el error en el mismo paso.
4. CUANDO la modista toca "Saltar" EL SISTEMA DEBERÁ dejar la medida pendiente y pasar a la siguiente; CUANDO toca "Anterior" DEBERÁ volver y permitir corregir.
5. CUANDO ya existe un valor vigente de esa medida EL SISTEMA DEBERÁ ofrecer la opción "Repetir medición" mostrando el valor actual, sin pedirla por defecto (solo se recorren las que faltan).
6. CUANDO se completan todas EL SISTEMA DEBERÁ mostrar un resumen (medidas cargadas, saltadas) y accesos directos a la Hoja de molde y a la ficha.
7. SI falla el guardado (sin conexión o error del servidor) ENTONCES EL SISTEMA DEBERÁ conservar el valor escrito en pantalla, indicar el error y permitir reintentar sin avanzar.
8. EL SISTEMA DEBERÁ ser usable con una mano en un celular de 360 px de ancho: botones de al menos 44 px, sin scroll horizontal, con el campo y el botón "Siguiente" visibles con el teclado abierto.

### 3. Agregar más medidas durante la toma

**Historia de usuario:** Como modista, quiero sumar medidas extra mientras mido, eligiéndolas de la lista completa, para no cortar el flujo si necesito algo más.

**Criterios de aceptación:**

1. CUANDO la modista toca "Agregar más medidas" EL SISTEMA DEBERÁ mostrar todas las definiciones de medida (base y personalizadas) que aún no forman parte de la lista, con un campo "Buscar medida" que filtra sin distinguir tildes ni mayúsculas.
2. CUANDO elige una o varias EL SISTEMA DEBERÁ incorporarlas al final de la cola de esta toma, en el orden fijo, marcadas como "extra".
3. SI la medida que necesita no existe ENTONCES EL SISTEMA DEBERÁ permitir crear una medida personalizada desde ahí (nombre, observación) y sumarla a la toma.
4. EL SISTEMA DEBERÁ guardar las medidas extra como cualquier otra medida de la bailarina, sin modificar los requisitos del molde ni del diseño.

### 4. Medidas especiales del diseño en la ficha

**Historia de usuario:** Como modista, quiero que las medidas especiales que marqué en un diseño (ej. hombro a rodilla) aparezcan como pendientes en la ficha de cada bailarina con ese diseño, para no olvidarlas.

**Criterios de aceptación:**

1. CUANDO una bailarina tiene asignado un diseño con medidas especiales EL SISTEMA DEBERÁ mostrar en su pestaña Medidas una sección "Para {diseño}" con esas medidas, indicando cuáles faltan.
2. EL SISTEMA DEBERÁ incluir esas medidas en el flujo "Tomar medidas" y en el conteo de faltantes (requerimiento 1).
3. SI dos diseños piden la misma medida ENTONCES EL SISTEMA DEBERÁ mostrarla una sola vez, indicando ambos diseños.

### 5. Puntos de entrada

**Historia de usuario:** Como modista, quiero llegar a "Tomar medidas" desde donde me entero de que faltan medidas.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ mostrar el botón "Tomar medidas" en la ficha de la bailarina, con el conteo de medidas que faltan.
2. CUANDO la Hoja de molde no puede calcular por medidas faltantes EL SISTEMA DEBERÁ reemplazar los enlaces sueltos por un botón "Tomar las N que faltan" que abre el flujo solo con esas medidas y, al terminar, vuelve a la hoja ya calculada.
3. CUANDO se asigna un vestuario a una bailarina EL SISTEMA DEBERÁ mostrar de inmediato la lista de medidas que hacen falta para esa prenda y ofrecer "Tomar medidas ahora" o "Después".
4. EN la lista de bailarinas del grupo EL SISTEMA DEBERÁ mostrar por fila cuántas medidas faltan (según lo asignado) y un acceso directo a "Tomar medidas" de esa bailarina.

### 6. Toma de medidas del grupo

**Historia de usuario:** Como modista, quiero medir a todo un grupo de corrido y ver de un vistazo quién tiene qué pendiente.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ ofrecer en la vista del grupo "Tomar medidas del grupo", que recorre a las bailarinas con faltantes, una por vez, con el mismo flujo del requerimiento 2, y permite pasar a la siguiente bailarina o saltarla.
2. EL SISTEMA DEBERÁ ofrecer una vista resumen por grupo (bailarinas × medidas requeridas) con celdas cargada / falta, filtrable por "solo con faltantes", para armar la lista de qué llevar a medir.
3. CUANDO se toca una celda que falta EL SISTEMA DEBERÁ abrir el flujo posicionado en esa medida de esa bailarina.
4. EL SISTEMA DEBERÁ permitir imprimir o exportar a PDF la lista de faltantes del grupo (nombre, medidas que faltan) para llevarla en papel.

### 7. Estado de completitud según lo asignado

**Historia de usuario:** Como modista, quiero que "medidas completas" signifique que tengo todo lo que necesito para lo que le voy a coser.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ calcular el estado (ninguna / parcial / completa) de cada bailarina contra su lista de requeridas del requerimiento 1, reflejándolo en el listado de grupos, la lista de bailarinas y la ficha.
2. SI un dato cambia (nueva asignación, medida cargada, medida especial agregada al diseño) ENTONCES EL SISTEMA DEBERÁ reflejar el nuevo estado sin recargar manualmente.
3. EL SISTEMA DEBERÁ mantener las medidas base marcadas "requerida" como el mínimo cuando no hay asignaciones (compatibilidad con los datos existentes).

### 8. Prendas propias sin molde en un diseño

**Historia de usuario:** Como modista, quiero cargar un diseño con una prenda que todavía no tiene molde (ej. "Vestido evasé"), para poder organizar el trabajo igual.

**Criterios de aceptación:**

1. CUANDO la modista crea o edita un diseño EL SISTEMA DEBERÁ permitir agregar una prenda "sin molde" indicando: nombre (obligatorio, único dentro del diseño), categoría (vestido, falda, pantalón, cuerpo, manga, otro), prioridad de talle (pecho, cadera o ambos) y las medidas que necesita, elegidas de la lista completa con buscador.
2. EL SISTEMA DEBERÁ permitir ordenar las medidas requeridas de la prenda propia; por defecto se usa el orden fijo de toma.
3. EL SISTEMA DEBERÁ marcar visualmente estas prendas como "Sin molde" en el diseño, la asignación, la ficha, la producción y el inventario.
4. SI el nombre está vacío o repetido en el diseño ENTONCES EL SISTEMA DEBERÁ rechazar el guardado con un mensaje claro en español.
5. EL SISTEMA DEBERÁ permitir cargar mano de obra y consumo de materiales por talle de una prenda propia igual que para una prenda con molde.
6. CUANDO se borra una prenda propia que está asignada a bailarinas EL SISTEMA DEBERÁ avisar cuántas asignaciones se pierden antes de confirmar.

### 9. Asignación, talle, producción y costos con prendas propias

**Historia de usuario:** Como modista, quiero que la prenda sin molde entre en la producción del grupo como cualquier otra.

**Criterios de aceptación:**

1. CUANDO se asigna un diseño con prendas propias a un grupo EL SISTEMA DEBERÁ crear las asignaciones de esas prendas para cada bailarina igual que para las prendas con molde.
2. EL SISTEMA DEBERÁ sugerir el talle de una prenda propia con la tabla activa de la bailarina y la prioridad de talle elegida, y permitir el talle manual por prenda (misma regla: manual > sugerido).
3. EL SISTEMA DEBERÁ incluir las prendas propias en Producción (cantidad por talle y por prenda), en el PDF de producción, en costos, consumo de materiales y "Confirmar producción" (descuento de stock).
4. SI dos prendas (una con molde y una propia) tienen el mismo nombre ENTONCES EL SISTEMA DEBERÁ distinguirlas en los listados agregando la marca "Sin molde".
5. EL SISTEMA DEBERÁ conservar sin cambios el comportamiento de las prendas con molde existentes.

### 10. Hoja de molde para una prenda sin molde

**Historia de usuario:** Como modista, quiero entender qué pasa cuando abro la hoja de una prenda sin molde, y qué puedo hacer.

**Criterios de aceptación:**

1. CUANDO se elige una prenda sin molde en la Hoja de molde EL SISTEMA DEBERÁ mostrar un estado explicativo ("Esta prenda todavía no tiene molde") en lugar de la tabla de resultados, sin errores técnicos.
2. EL SISTEMA DEBERÁ mostrar en ese estado las medidas que pide la prenda con los valores cargados de la bailarina (para trazar a mano), y el botón "Tomar medidas" si faltan.
3. EL SISTEMA DEBERÁ ofrecer las acciones "Crear molde con esta prenda" y "Vincular a un molde existente".
4. EL SISTEMA DEBERÁ permitir exportar/imprimir esa hoja simplificada (bailarina, prenda, talle, medidas) a PDF.

### 11. Convertir o vincular a un molde después

**Historia de usuario:** Como modista, cuando por fin tengo el molde, quiero engancharlo sin rehacer el diseño ni perder lo que ya cargué.

**Criterios de aceptación:**

1. CUANDO la modista elige "Crear molde con esta prenda" EL SISTEMA DEBERÁ abrir el editor de fórmulas con un molde nuevo precargado con el nombre, la categoría, la prioridad de talle y las medidas requeridas de la prenda como entradas, listo para escribir las fórmulas.
2. CUANDO la modista elige "Vincular a un molde existente" EL SISTEMA DEBERÁ listar los moldes y permitir elegir uno, mostrando qué medidas nuevas pediría respecto de las que ya se tomaron.
3. CUANDO la prenda queda vinculada a un molde EL SISTEMA DEBERÁ conservar asignaciones, talles manuales, mano de obra, reglas de consumo y hojas guardadas, y pasar a calcular con el molde.
4. SI el molde vinculado pide medidas que la bailarina no tiene ENTONCES EL SISTEMA DEBERÁ mostrarlas como faltantes y ofrecer "Tomar medidas".
5. EL SISTEMA DEBERÁ impedir vincular una prenda a un molde que ya está en el mismo diseño con otra prenda.

### 12. Integridad, seguridad y compatibilidad

**Historia de usuario:** Como usuaria, quiero que mis datos existentes sigan funcionando y que nadie más vea los míos.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ migrar los datos existentes sin cambios visibles: todas las asignaciones y prendas de diseño actuales siguen apuntando a su molde.
2. EL SISTEMA DEBERÁ mantener el aislamiento por usuaria (RLS por `owner_id`) en toda tabla o vista nueva o modificada, con pruebas de base de datos.
3. SI una petición referencia una prenda, medida o molde de otra usuaria ENTONCES EL SISTEMA DEBERÁ responder 404 con el sobre de error estándar.
4. EL SISTEMA DEBERÁ registrar cada medida tomada en el historial versionado existente (nunca sobrescribir).

## Fuera de alcance

- Calcular piezas, fórmulas o patrones para una prenda sin molde (solo se organizan medidas, talle, producción y costos).
- Escanear o fotografiar moldes en papel (idea de versión futura ya registrada).
- Funcionamiento sin conexión (modo offline) y dictado por voz.
- Sincronizar la lista de medidas con un molde vinculado después de creada (si el molde cambia, se recalcula al abrir la hoja).
- Notificar o compartir la lista de faltantes con las bailarinas o sus familias.

## Supuestos y preguntas abiertas

- **Orden de toma:** se asume un orden corporal fijo (cuello → hombros → busto/pecho → cintura → cadera → largos) guardado como campo de orden en `measure_definitions`; las personalizadas van al final. *Confirmar con la modista si prefiere otro orden.*
- **Prenda propia:** se modela como una prenda de diseño con nombre, categoría y prioridad de talle propios, con `mold_type_id` opcional; las asignaciones referencian la prenda de diseño y no siempre un molde. El detalle queda para `design.md`.
- **Talle de la prenda propia:** se asume que usa la tabla activa de la bailarina con la prioridad de talle elegida (pecho por defecto para vestido/cuerpo/manga y cadera para falda/pantalón).
- **Medidas especiales:** valen para todas las prendas del diseño y se ordenan junto con el resto en el orden corporal de toma (no al final).
- **Vincular molde:** se asume que es una acción de un solo sentido (no se "desvincula"); si se quiere volver atrás, se duplica la prenda propia antes. *Confirmar.*
- **Grupo:** el PDF de faltantes se asume en A4 con una fila por bailarina; falta confirmar si además quiere una hoja en blanco para anotar medidas a mano.
