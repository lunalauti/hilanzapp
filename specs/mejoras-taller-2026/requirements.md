# Requerimientos — Mejoras de taller 2026

## Introducción

Ocho mejoras pedidas por la modista después de usar la app en producción real: agrupar grupos que se renuevan año a año, arrastrar en vez de solo flechas para ordenar medidas, atajos para crear/vincular molde desde el diseño, buscador y vista de lista en Diseños, un bug del editor de fórmulas, un listado de materiales para el cliente y un desglose de mano de obra en Inventario, marcar como hecha la producción por talle en dos etapas (patrón y confección), talles con **intervalos** de medida en vez de un valor único, y una vista de "producción por talle" que junte todo lo que hoy exige ir de la ficha de la bailarina a la tabla de talles y volver.

Estas mejoras no cambian el principio de la app: *medidas reales para construir el molde; talles para organizar la producción.*

## Estado actual relevante (investigado en el código)

- **Grupos:** `groups` es una tabla plana sin jerarquía (`supabase/migrations/20260924000000_core.sql`); no hay forma de agrupar grupos entre sí ni de "cerrar" un año y arrancar el próximo sin perder el historial.
- **Orden de medidas de una prenda propia:** `components/designs/PlaceholderGarmentModal.tsx` ya reordena con `move(i, delta)`; solo faltan los handlers de arrastre (drag and drop), la lógica de reordenar ya existe.
- **Crear/vincular molde:** ya existe como acción desde la Hoja de molde (`NoPatternSheet`) y desde el editor de fórmulas; falta el atajo directo desde la lista de prendas del diseño (`DesignFormModal`), donde hoy el botón "Crear molde" es un enlace pero "Vincular a molde" abre `LinkMoldModal` — hay que revisar si ambos ya están ahí y qué falta (podrían estar bien y solo falte visibilizarlo mejor).
- **Diseños:** `DesignsList` es una grilla fija, sin buscador ni alternancia de vista (`pages/designs/DesignsList.tsx`).
- **Bug del editor de fórmulas:** en `FormulaEditor.tsx:137`, `operandIsRef` se calcula con `/^\d+([.,]\d+)?$/`, que exige dígitos *después* de la coma/punto. Mientras se escribe "3," (antes de completar "3,14"), la cadena no matchea esa regex y el operando pasa a interpretarse como referencia a otra medida, lo que cambia el toggle a "Otra medida" y reemplaza el campo de texto por un `<select>`, perdiendo lo tecleado. Confirmado en el código, es el bug reportado.
- **Costos e inventario:** `services/inventory.ts` (`groupCosts`) ya calcula `perGarment.laborCost` y `materialsCost` por prenda, y `consumption` con el detalle de material por talle; la pantalla `Inventory.tsx` no muestra ese desglose de mano de obra de forma clara, y no hay ningún endpoint de exportación de materiales (solo hay PDF de hoja de molde, de producción y de faltantes en `services/pdf.ts`).
- **Hoja de referencia del cliente** (`SYNAP 2025.pdf`, aportada por la usuaria): por cada grupo/vestuario muestra cantidad de bailarinas, coreografía, vestuario, cada material con el consumo unitario y el total con la leyenda "APROX", una línea para conos de hilo, observaciones a mano, y el costo de mano de obra total al pie. Es el formato a imitar en el nuevo PDF para el proveedor/cliente.
- **Producción:** `groupProduction` (`services/production.ts`) recalcula todo en cada lectura a partir de las asignaciones vigentes; no persiste ningún estado de "hecho". No hay tabla para marcar avance de confección.
- **Tablas de talles:** `size_table_values.value_cm` es un único `numeric` por talle y medida (`supabase/migrations/20260924000100_sizes_molds_designs.sql`); el motor de sugerencia (`packages/pattern-engine/src/sizing.ts`) compara la medida real contra ese valor único con una tolerancia fija, no contra un rango declarado.
- **Medidas promedio de talles para producir:** hoy la modista debe abrir cada bailarina para ver su talle sugerido, después ir a Tablas de talles, elegir la tabla del grupo etario y buscar la fila del talle para sacar los valores. No existe ninguna vista que junte "qué talles hay que producir" con "qué medidas promedio usar para cada uno".

## Requerimientos

### 1. Grupos de grupos (para renovar temporada sin perder el historial)

**Historia de usuario:** Como modista, quiero poder agrupar mis grupos bajo una categoría más amplia, para organizar temporadas o niveles sin perder el trabajo de años anteriores cuando cambian las bailarinas.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ permitir crear una "categoría" (grupo de grupos) con un nombre, opcionalmente asociando uno o más grupos existentes.
2. EL SISTEMA DEBERÁ permitir mover un grupo de una categoría a otra o dejarlo sin categoría, sin perder bailarinas, medidas, asignaciones ni hojas de molde.
3. EL SISTEMA DEBERÁ mostrar los grupos organizados por categoría en la pantalla de Grupos, con los grupos sin categoría en una sección aparte.
4. CUANDO se elimina una categoría ENTONCES EL SISTEMA DEBERÁ conservar los grupos (quedan sin categoría), nunca borrarlos en cascada.
5. EL SISTEMA DEBERÁ permitir archivar un grupo (por ejemplo, al terminar la temporada) sin eliminarlo, para poder consultarlo después sin que aparezca en los listados activos por defecto.

### 2. Arrastrar para reordenar medidas de una prenda propia

**Historia de usuario:** Como modista, quiero arrastrar las medidas elegidas en "Prenda sin molde" para ordenarlas, además de los botones de flecha.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ permitir arrastrar cada medida elegida a una nueva posición de la lista, actualizando el orden al soltar.
2. EL SISTEMA DEBERÁ mantener los botones "Subir" y "Bajar" existentes como alternativa (para teclado y accesibilidad), sin quitarlos.
3. EL SISTEMA DEBERÁ anunciar el cambio de posición a lectores de pantalla (`aria-live`) tanto al arrastrar como al usar los botones.
4. EL SISTEMA DEBERÁ respetar `prefers-reduced-motion` en la animación de arrastre.

### 3. Crear o vincular molde directo desde la lista de prendas del diseño

**Historia de usuario:** Como modista, quiero crear el molde o vincular uno existente sin salir de la pantalla de edición del diseño, para no tener que ir a la Hoja de molde primero.

**Criterios de aceptación:**

1. CUANDO edito un diseño y una prenda no tiene molde EL SISTEMA DEBERÁ ofrecer, en esa misma fila, las acciones "Crear molde" y "Vincular a molde" sin necesitar abrir la Hoja de molde de una bailarina primero.
2. CUANDO elijo "Crear molde" ENTONCES EL SISTEMA DEBERÁ abrir el editor de fórmulas con las medidas de esa prenda ya cargadas como entradas (mismo comportamiento que ya existe desde la Hoja de molde).
3. CUANDO elijo "Vincular a molde" ENTONCES EL SISTEMA DEBERÁ mostrar el mismo resumen de impacto ya implementado (medidas nuevas, asignaciones conservadas) antes de confirmar.
4. EL SISTEMA DEBERÁ actualizar la lista de prendas del diseño sin recargar la página cuando la prenda pasa a tener molde.

### 4. Buscador y vista de lista en Diseños

**Historia de usuario:** Como modista, quiero buscar un diseño por nombre y elegir ver la lista en formato compacto, para encontrar uno rápido cuando tengo muchos.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ mostrar un campo de búsqueda en la pantalla de Diseños que filtre por nombre sin distinguir mayúsculas ni tildes, actualizando la lista mientras se escribe.
2. EL SISTEMA DEBERÁ ofrecer dos vistas: "Cuadrícula" (la actual, con imagen de portada) y "Lista" (una fila por diseño, con nombre, prendas y cantidad de imágenes).
3. EL SISTEMA DEBERÁ recordar la última vista elegida entre visitas (en el navegador del dispositivo).
4. CUANDO la búsqueda no encuentra resultados ENTONCES EL SISTEMA DEBERÁ mostrar un estado vacío con el texto buscado.

### 5. Corregir el ingreso de decimales en el operando de una fórmula

**Historia de usuario:** Como modista, quiero poder escribir "3.14" o "3,14" en el operando de una fórmula sin que el campo cambie solo a "Otra medida".

**Criterios de aceptación:**

1. CUANDO escribo una coma o un punto como parte de un número decimal (por ejemplo "3," antes de terminar "3,14") EL SISTEMA DEBERÁ mantener el operando en modo "Número" y no cambiar el campo a un selector de medida.
2. EL SISTEMA DEBERÁ seguir reconociendo como "Otra medida" cualquier valor que no sea un número válido ni una fracción (`3/4`), incluida una cadena vacía solo si corresponde a una referencia existente.
3. EL SISTEMA DEBERÁ conservar el comportamiento actual de guardar la fórmula: al guardar, un operando que no es un número completo y válido debe seguir rechazándose con el mismo mensaje de error que hoy.

### 6. Costo de mano de obra visible, listado de materiales para el proveedor y presupuesto de confección para el cliente

**Historia de usuario:** Como modista, quiero ver cuánta mano de obra voy sumando por prenda y grupo, exportar un listado de materiales sin precios para pasarle al proveedor, y exportar un presupuesto de confección con el costo de mano de obra para pasarle a mi cliente (la escuela o el estudio).

**Criterios de aceptación:**

1. EN Inventario y costos, EL SISTEMA DEBERÁ mostrar, para el grupo y diseño elegidos, el total de mano de obra por separado del total de materiales, y el desglose de mano de obra por prenda (cuánto aporta cada prenda al total).
2. EL SISTEMA DEBERÁ ofrecer "Exportar lista de materiales" que genere un PDF **sin ningún precio ni costo**, con una ficha por prenda del diseño elegido, siguiendo el formato de referencia de la modista (`SYNAP 2025.pdf`): grupo y cantidad de bailarinas, nombre de la prenda, cada material con el consumo por bailarina y el total necesario (con la leyenda "aprox." cuando el consumo depende del talle), un renglón en blanco para anotar los conos de hilo, y un espacio de observaciones. Este PDF es para el proveedor de telas.
3. EL SISTEMA DEBERÁ calcular el total de cada material como la suma del consumo de cada bailarina según su talle efectivo, igual que ya hace el cálculo de costos existente.
4. SI una prenda no tiene ninguna regla de consumo cargada ENTONCES EL SISTEMA DEBERÁ mostrarla en el PDF con la leyenda "Cargá el consumo de materiales para esta prenda" en lugar de una lista vacía.
5. EL SISTEMA DEBERÁ permitir exportar el listado de materiales para todo el grupo (todas las prendas del diseño) o para una sola prenda.
6. EL SISTEMA DEBERÁ ofrecer, por separado, "Exportar presupuesto de confección": un PDF distinto, para el cliente (la escuela/estudio), que muestre por prenda la cantidad a confeccionar y el costo de mano de obra (unitario y total), con el total general del grupo. Este PDF **no incluye el detalle ni el costo de materiales**, solo mano de obra.
7. EL SISTEMA DEBERÁ dejar clara en cada PDF la diferencia de destinatario (encabezado "Lista de materiales" vs. "Presupuesto de confección") para que la modista no las confunda al enviarlas.

### 7. Marcar la producción como hecha, en dos etapas con distinta granularidad

**Historia de usuario:** Como modista, quiero marcar el patrón como listo una vez por cada talle distinto que tengo que trazar, y marcar la confección prenda por prenda, para saber cuántos patrones me faltan y cuántas prendas concretas me faltan coser.

Ejemplo de la modista: si tiene que hacer 9 prendas T2 y 1 T4 de "Cuerpo base", traza **2 patrones** (uno por talle), pero cose **10 prendas** en total, y quiere ir tildando cada una a medida que la termina, no solo el talle en bloque.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ permitir marcar, para cada combinación de prenda y talle de un grupo, el estado **"Patrón listo"** con su fecha (una marca por talle distinto, no por bailarina).
2. EL SISTEMA DEBERÁ permitir marcar **"Confección lista"** por cada unidad individual (cada asignación de esa prenda a una bailarina), no por talle en bloque.
3. EL SISTEMA DEBERÁ mostrar, para cada talle de una prenda, cuántas unidades de confección están listas sobre el total de ese talle (por ejemplo "6 de 9"), y tachar o distinguir visualmente el talle completo recién cuando todas sus unidades están confeccionadas.
4. EL SISTEMA DEBERÁ permitir desmarcar tanto "Patrón listo" como cualquier unidad de "Confección lista".
5. CUANDO cambia la cantidad necesaria de un talle (se asigna o se quita una prenda) EL SISTEMA DEBERÁ actualizar el progreso sin resetear lo ya marcado, y distinguir con claridad una unidad nueva sin confeccionar de una ya marcada.
6. EL SISTEMA DEBERÁ mostrar en la vista de Producción un resumen por prenda: talles con patrón listo sobre el total de talles distintos, y unidades confeccionadas sobre el total de unidades a producir.

### 8. Talles con intervalo de medida y vista de producción por talle con el promedio real de las bailarinas

**Historia de usuario:** Como modista, quiero que un talle no dependa de un único valor exacto sino de un rango, y quiero ver en la vista de Producción, para cada prenda y talle que tengo que producir, el promedio real de las medidas de las bailarinas que tengo en ese talle, sin ir bailarina por bailarina ni entrar a Tablas de talles.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ permitir cargar, para cada medida de cada talle de una tabla, un valor mínimo y un valor máximo (el valor único actual pasa a ser el punto medio del intervalo, o se puede definir explícitamente).
2. CUANDO se sugiere el talle de una bailarina EL SISTEMA DEBERÁ elegir el talle cuyo intervalo contiene la medida real; si la medida cae en más de un intervalo (talles superpuestos) o en ninguno, EL SISTEMA DEBERÁ resolverlo con el mismo criterio de "más cercano" que usa hoy y marcarlo como antes ("fuera de la tabla" o el más cercano).
3. EL SISTEMA DEBERÁ seguir aceptando tablas con un solo valor por medida y talle (sin intervalo declarado), tratándolas como equivalentes a hoy (comparación por cercanía).
4. EN la vista de Producción de un grupo, EL SISTEMA DEBERÁ agregar, para cada prenda, un acceso "Ver medidas del talle T◯◯" que muestre, para cada medida que pide el molde, **el promedio real de las bailarinas de ese grupo que tienen ese talle efectivo para esa prenda** (calculado sobre sus medidas reales vigentes), listo para volcar en el molde.
5. SI ninguna bailarina de ese talle tiene cargada una medida en particular ENTONCES EL SISTEMA DEBERÁ mostrar en su lugar el valor de la tabla de talles (el punto medio del intervalo, o el valor único) marcado como "de la tabla, no promedio real", para no dejar el campo vacío.
6. EL SISTEMA DEBERÁ indicar cuántas bailarinas entraron en el promedio de cada medida (por ejemplo "promedio de 6 bailarinas"), para que la modista sepa qué tan representativo es.
7. EL SISTEMA DEBERÁ permitir elegir uno o varios talles de una prenda y ver, en una sola pantalla, las medidas de cada uno, para producir varios de una vez.
8. EL SISTEMA DEBERÁ indicar con qué tabla de talles (nombre y grupo etario) está el intervalo de referencia de cada talle, para los casos sin datos reales suficientes.

## Fuera de alcance

- Generar el patrón/molde dibujado a partir del talle (idea ya registrada aparte, en una futura versión).
- Reordenar con arrastre en otras listas de la app fuera del selector de medidas de "Prenda sin molde" (se evalúa después si se pide en otro lugar).
- Enviar el listado de materiales por email o integrarlo con un proveedor: por ahora es un PDF para descargar y compartir a mano, como ya se hace con los otros PDF de la app.
- Deshacer o versionar los cambios de "Patrón listo" / "Confección lista" (no hay historial de esas marcas, solo el estado y la fecha actual).
- Multiusuaria o compartir una categoría/grupo entre dos cuentas.

## Supuestos y preguntas abiertas

- **Grupos de grupos:** una sola categoría por grupo, sin anidar (confirmado por la usuaria).
- **Archivar grupo:** se asume que un grupo archivado sigue accesible desde un filtro "Ver archivados", no se elimina, y se excluye de los listados y estadísticas activas por defecto (Inventario, Producción, Home). *Confirmar solo si hace falta un caso distinto.*
- **PDF de materiales vs. presupuesto de confección:** confirmado que son dos PDF separados, ninguno de los dos muestra el costo del otro (materiales = sin precios, para el proveedor; presupuesto de confección = solo mano de obra, para el cliente).
- **Dos etapas de producción:** confirmado — "Patrón listo" es por combinación (prenda, talle, grupo); "Confección lista" es por unidad individual (por asignación/bailarina).
- **Intervalos de talles:** se asume que basta con mín/máx por medida (rango simple), no una distribución o varios puntos de corte. *Confirmar con un caso real de superposición entre dos talles para validar el criterio de desempate.*
- **Medidas promedio para producir:** confirmado — es el promedio real de las medidas de las bailarinas del grupo que tienen ese talle efectivo, con la tabla de talles como respaldo si no hay datos reales suficientes.
