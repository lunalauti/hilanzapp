# Requerimientos — Hilanzapp (MVP)

## Introducción

Hilanzapp es una aplicación web para modistas de vestuario de danza que digitaliza el proceso de toma de medidas, cálculo de moldería y organización de la producción por grupo y talle. Reemplaza el registro manual en papel, separando siempre la medida real de la bailarina de los cálculos derivados usados para construir el molde, y permite sugerir un talle automáticamente sin perder la posibilidad de ajuste manual. El alcance incluye, además del núcleo (Req 1-8), fotos de referencia, historial de medidas, diseño de prenda completo, fórmulas y tablas de talles editables, exportación PDF/impresión y gestión de consumo de tela, costos e inventario (Req 9-15). Está pensada para una sola usuaria (la modista) que gestiona ~10 grupos de danza de 10-15 integrantes cada uno, con diseños que cambian constantemente.

## Requerimientos

### 1. Gestión de grupos

**Historia de usuario:** Como modista, quiero crear y administrar grupos de danza, para organizar a las bailarinas por conjunto/coreografía.

**Criterios de aceptación:**

1. CUANDO la usuaria crea un grupo con un nombre EL SISTEMA DEBERÁ guardarlo y mostrarlo en la lista de grupos de la pantalla de inicio.
2. CUANDO la usuaria abre un grupo EL SISTEMA DEBERÁ mostrar la lista de bailarinas de ese grupo con nombre, talle sugerido/asignado y estado de medidas (completas/incompletas).
3. CUANDO la usuaria edita el nombre de un grupo EL SISTEMA DEBERÁ actualizar el registro sin afectar las bailarinas asociadas.
4. SI la usuaria intenta eliminar un grupo con bailarinas asociadas ENTONCES EL SISTEMA DEBERÁ pedir confirmación explícita antes de eliminar en cascada.
5. SI la usuaria intenta crear un grupo sin nombre ENTONCES EL SISTEMA DEBERÁ rechazar la operación y mostrar un mensaje de validación.

### 2. Ficha de bailarina

**Historia de usuario:** Como modista, quiero mantener una ficha permanente por bailarina, para no tener que volver a pedir sus datos generales cada temporada.

**Criterios de aceptación:**

1. CUANDO la usuaria agrega una bailarina a un grupo EL SISTEMA DEBERÁ solicitar como mínimo nombre y grupo, y permitir opcionalmente edad, fecha de toma de medidas y observaciones.
2. CUANDO la usuaria guarda una bailarina EL SISTEMA DEBERÁ asociarla a exactamente un grupo.
3. CUANDO la usuaria edita los datos generales de una bailarina EL SISTEMA DEBERÁ persistir los cambios sin duplicar el registro.
4. SI la usuaria elimina una bailarina ENTONCES EL SISTEMA DEBERÁ pedir confirmación y eliminar también sus medidas, diseños asociados y cálculos de moldería.
5. CUANDO la usuaria mueve una bailarina de un grupo a otro EL SISTEMA DEBERÁ conservar sus medidas, talles y observaciones.

### 3. Medidas corporales (base y personalizadas)

**Historia de usuario:** Como modista, quiero cargar las medidas corporales reales de cada bailarina, incluyendo medidas no previstas de antemano, para reutilizarlas en todos los moldes sin tomar de nuevo la cinta métrica.

**Criterios de aceptación:**

1. CUANDO la usuaria carga medidas de una bailarina EL SISTEMA DEBERÁ ofrecer el conjunto de medidas base predefinido (contorno de pecho, bajo busto, cintura, segunda cintura, cadera, cuello, ancho de espalda, ancho de hombro, largo delantero, largo trasero, largo de busto, separación de busto, largo hombro-rodilla, contorno de brazo/codo/muñeca, largo de manga, contorno de muslo/rodilla/pantorrilla/tobillo, largo de pantalón, largo de falda) con su valor en centímetros.
2. CUANDO la usuaria selecciona "+ Agregar medida personalizada" EL SISTEMA DEBERÁ permitir definir nombre, valor numérico y observación libre, y guardarla junto a las medidas base de esa bailarina.
3. CUANDO la usuaria edita el valor de una medida (base o personalizada) EL SISTEMA DEBERÁ actualizarlo y quedar disponible de inmediato para los cálculos de moldería.
4. EL SISTEMA DEBERÁ conservar siempre la medida real ingresada sin sobrescribirla con ningún resultado calculado.
5. SI la usuaria intenta guardar una medida con valor no numérico o negativo ENTONCES EL SISTEMA DEBERÁ rechazar el valor y mostrar un mensaje de validación.
6. CUANDO la usuaria consulta la ficha de una bailarina EL SISTEMA DEBERÁ mostrar el estado de medidas (ninguna cargada / parcial / completa respecto a las medidas base) en la vista de grupo.

### 4. Selección de prenda/molde y datos de diseño mínimos

**Historia de usuario:** Como modista, quiero elegir qué tipo de molde voy a construir para una bailarina, para que la app me pida solo las medidas relevantes a ese molde.

**Criterios de aceptación:**

1. CUANDO la usuaria selecciona un tipo de molde para una bailarina EL SISTEMA DEBERÁ ofrecer como opciones del MVP: Cuerpo base, Manga, Pantalón, Falda (1/2 campana sin cierre, campana sin cierre, doble campana sin cierre, fruncida, 1/2 campana con cierre, campana con cierre, doble campana con cierre) y Vestido campana con canesú.
2. CUANDO la usuaria elige un tipo de molde EL SISTEMA DEBERÁ listar únicamente las medidas reales requeridas por ese molde, indicando cuáles faltan cargar en la ficha de la bailarina.
3. SI faltan medidas requeridas para el molde elegido ENTONCES EL SISTEMA DEBERÁ impedir el cálculo y señalar cuáles medidas faltan.
4. CUANDO el molde de manga requiere la "medida de sisa dibujada" EL SISTEMA DEBERÁ solicitarla como dato adicional ingresado en el momento (no proveniente de la ficha de medidas corporales) antes de calcular.
5. CUANDO la usuaria elige un tipo de falda con vuelo (1/2 campana, campana, doble campana) EL SISTEMA DEBERÁ aplicar el divisor de radio correspondiente (3,14 / 6,28 / 12,56) y diferenciar si tiene cierre (usa contorno de cintura) o cintura elastizada (usa contorno de cadera y calcula elástico = cintura × 0,85).

### 5. Cálculo de moldería

**Historia de usuario:** Como modista, quiero que la app calcule automáticamente las fórmulas de moldería a partir de las medidas reales, para no hacer cálculos manuales durante la construcción del molde.

**Criterios de aceptación:**

1. CUANDO la usuaria solicita el cálculo de un molde con todas sus medidas requeridas cargadas EL SISTEMA DEBERÁ aplicar las fórmulas correspondientes al tipo de molde (cuerpo base, manga, pantalón, falda en sus 6 variantes, vestido con canesú) y mostrar cada resultado calculado junto a la medida real que lo originó.
2. EL SISTEMA DEBERÁ calcular el cuerpo base con: 1/4 pecho = pecho÷4; escote/base cuello = cuello÷6; 1/2 espalda = ancho de espalda÷2; hombro, largo delantero y largo trasero como medida directa; 1/4 cintura = cintura÷4; 1/4 cadera = cadera÷4; 1/4 segunda cintura = segunda cintura÷4; altura de cadera según tabla estándar por talle/edad.
3. EL SISTEMA DEBERÁ calcular la manga con: ancho de rectángulo = sisa dibujada − 1cm; alto de rectángulo = sisa dibujada × 2/3; e incluir largo de manga y contorno de muñeca como medidas directas de referencia.
4. EL SISTEMA DEBERÁ calcular el pantalón con: 1/4 cadera = cadera÷4; 1/4 cintura = cintura÷4; ancho de tiro delantero = (cadera÷4)×0,15; ancho de tiro trasero = ancho de tiro delantero×3; altura de tiro según tabla estándar por talle/edad; largo de pantalón como medida directa.
5. EL SISTEMA DEBERÁ calcular el vestido campana con canesú en dos bloques: canesú (1/4 pecho = pecho÷4; 1/2 espalda = ancho de espalda÷2; largo de busto, separación de busto, largo delantero y largo de canesú como medida directa) y falda (radio según tipo de vuelo sobre contorno de bajo busto; largo de falda = largo hombro-rodilla − largo de canesú).
6. CUANDO un cálculo depende de un valor estándar por talle/edad (altura de cadera, altura de tiro) EL SISTEMA DEBERÁ tomarlo de la tabla de talles configurada y no de un valor fijo en el código.
7. EL SISTEMA DEBERÁ mostrar los resultados de moldería en una "hoja de molde" separada de la ficha de medidas, mostrando lado a lado cada medida real y su resultado calculado.

### 6. Sistema de talles y sugerencia automática

**Historia de usuario:** Como modista, quiero que la app sugiera un talle a partir de las medidas reales usando una tabla de referencia, para agilizar la clasificación sin perder la posibilidad de decidir yo misma.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ incluir tablas de talles precargadas basadas en medidas corporales (fuente: tablas "Baúl de Moda"), organizadas por rango etario — Bebés (0-18 meses), Niños (talles 4-12), Adolescentes (talles intermedios interpolados, ver más abajo), Mujeres (talles 40-58) — como datos configurables, no como valores hardcodeados en las fórmulas.
2. EL SISTEMA DEBERÁ cubrir el rango de Adolescentes con talles generados por interpolación lineal entre el último talle de Niños (talle 12, Baúl de Moda) y el primer talle de Mujeres (talle 40, Baúl de Moda), para cada medida de la tabla, evitando reutilizar números de talle ya usados en Niños o Mujeres y evitando mezclar con tablas de otras fuentes (para no generar dos talles con el mismo número y distinto significado).
3. CUANDO la usuaria tiene cargadas las medidas de pecho, cintura y cadera de una bailarina EL SISTEMA DEBERÁ calcular un talle sugerido comparando cada medida contra la tabla seleccionada y mostrando el desglose por medida (a qué talle corresponde cada una individualmente).
4. CUANDO las medidas individuales de una bailarina corresponden a talles distintos entre sí EL SISTEMA DEBERÁ definir el talle sugerido final priorizando la medida más relevante según el tipo de prenda: contorno de pecho para vestido, canesú o remera/cuerpo; contorno de cadera para falda o pantalón. Para moldes que combinan ambos criterios (p. ej. vestido campana con canesú, que tiene componente de canesú y de falda) EL SISTEMA DEBERÁ mostrar el desglose de ambos criterios sin forzar un único talle combinado.
5. EL SISTEMA DEBERÁ permitir que la usuaria sobrescriba manualmente el talle sugerido en cualquier momento, y DEBERÁ conservar ambos valores (sugerido y manual) de forma distinguible.
6. CUANDO existe un talle asignado manualmente EL SISTEMA DEBERÁ usar ese valor como talle efectivo de la bailarina en vistas de grupo y producción, mostrando también cuál fue el sugerido originalmente.
7. EL SISTEMA DEBERÁ permitir asignar un talle específico por prenda/molde a una misma bailarina (por ejemplo, cuerpo T10 y pantalón T12), independiente del talle general sugerido.
8. EL SISTEMA DEBERÁ calcular siempre la moldería individual con las medidas reales de la bailarina, nunca con los valores estándar de la tabla de talles.

### 7. Resumen de producción

**Historia de usuario:** Como modista, quiero ver cuántas prendas de cada talle tengo que producir por grupo, para organizar el corte y la confección en tandas.

**Criterios de aceptación:**

1. CUANDO la usuaria abre el resumen de producción de un grupo EL SISTEMA DEBERÁ agrupar y contar las bailarinas por prenda/molde y talle efectivo (manual si existe, sugerido si no).
2. CUANDO la usuaria selecciona una combinación prenda+talle en el resumen EL SISTEMA DEBERÁ listar los nombres de las bailarinas incluidas en ese grupo.
3. EL SISTEMA DEBERÁ recalcular el resumen de producción automáticamente cuando cambian los talles o las prendas asignadas de cualquier bailarina del grupo.
4. SI una bailarina del grupo no tiene talle ni prenda asignada ENTONCES EL SISTEMA DEBERÁ excluirla del conteo y señalarla como pendiente en el resumen.

### 8. Acceso y persistencia

**Historia de usuario:** Como modista, quiero que mis datos queden guardados de forma segura y accesibles solo por mí, para no perder información entre sesiones ni dispositivos.

**Criterios de aceptación:**

1. CUANDO la usuaria inicia sesión con sus credenciales EL SISTEMA DEBERÁ mostrar únicamente los grupos, bailarinas, medidas y cálculos que le pertenecen.
2. EL SISTEMA DEBERÁ persistir toda la información (grupos, bailarinas, medidas, diseños, cálculos, talles) en la base de datos de forma que sobreviva al cierre de sesión y sea accesible desde cualquier dispositivo con las mismas credenciales.
3. SI un usuario no autenticado intenta acceder a la aplicación ENTONCES EL SISTEMA DEBERÁ redirigirlo a la pantalla de inicio de sesión.

### 9. Fotos y dibujos de referencia del vestuario

**Historia de usuario:** Como modista, quiero adjuntar fotos o dibujos de referencia a cada diseño de vestuario, para tener a mano cómo debe quedar la prenda mientras hago el molde.

**Criterios de aceptación:**

1. CUANDO la usuaria abre un diseño de vestuario EL SISTEMA DEBERÁ permitir subir una o más imágenes (foto o dibujo) en formatos JPG, PNG o WebP.
2. CUANDO la usuaria sube una imagen EL SISTEMA DEBERÁ almacenarla de forma privada, asociada al diseño, y mostrarla como miniatura con opción de ampliarla y eliminarla.
3. SI la imagen supera el tamaño máximo permitido o tiene un formato no soportado ENTONCES EL SISTEMA DEBERÁ rechazarla e informar el motivo.
4. EL SISTEMA DEBERÁ mostrar las imágenes de referencia del diseño en la hoja de molde y en la ficha del diseño.
5. EL SISTEMA DEBERÁ garantizar que solo la usuaria propietaria pueda acceder a las imágenes almacenadas.

### 10. Historial de versiones de medidas

**Historia de usuario:** Como modista, quiero conservar el historial de medidas de cada bailarina, para comparar cómo cambian con el tiempo y recuperar valores anteriores (las bailarinas crecen y cambian entre temporadas).

**Criterios de aceptación:**

1. CUANDO la usuaria modifica el valor de una medida (base o personalizada) EL SISTEMA DEBERÁ conservar el valor anterior como versión histórica con su fecha, en lugar de sobrescribirlo.
2. CUANDO la usuaria consulta una medida EL SISTEMA DEBERÁ mostrar el valor vigente por defecto y permitir ver el historial completo de esa medida en orden cronológico.
3. CUANDO la usuaria abre el historial de una medida EL SISTEMA DEBERÁ permitir restaurar una versión anterior como valor vigente, registrando esa restauración como una nueva versión.
4. EL SISTEMA DEBERÁ usar siempre el valor vigente de cada medida para los cálculos de moldería y el talle sugerido.
5. CUANDO la usuaria registra una nueva toma completa de medidas (nueva fecha de toma) EL SISTEMA DEBERÁ conservar la toma anterior consultable y permitir compararlas lado a lado.

### 11. Editor visual de diseño de prenda

**Historia de usuario:** Como modista, quiero definir el diseño completo de cada vestuario (escote, manga, falda, volados, asimetrías y detalles), para documentar cómo es cada prenda más allá del tipo de molde que necesito calcular.

**Criterios de aceptación:**

1. CUANDO la usuaria crea o edita un diseño de vestuario EL SISTEMA DEBERÁ permitir definir nombre, prendas que lo componen, tipo de escote, tipo de manga, tipo de falda, presencia de volado (sí/no), asimetría (sí/no), observaciones y detalles de confección.
2. EL SISTEMA DEBERÁ ofrecer catálogos precargados de opciones para escote (redondo, V, cuadrado, corazón, halter), manga (sin manga, corta, 3/4, larga, globo, campana, con volado) y falda (recta, fruncida, 1/2 campana, campana, doble campana, irregular, asimétrica).
3. CUANDO la usuaria elige "Otro" en cualquier catálogo EL SISTEMA DEBERÁ permitir ingresar un valor personalizado y guardarlo para reutilizarlo en diseños futuros.
4. CUANDO la usuaria asigna un diseño a un grupo o a una bailarina EL SISTEMA DEBERÁ relacionar las prendas del diseño con los moldes calculables y mostrar el diseño asignado en la vista de grupo.
5. CUANDO un diseño incluye medidas especiales (por ejemplo, largo de falda trasera, altura de volado) EL SISTEMA DEBERÁ vincularlas con las medidas personalizadas de cada bailarina asignada.

### 12. Fórmulas de moldería configurables por la usuaria

**Historia de usuario:** Como modista, quiero crear y modificar fórmulas de moldería desde la aplicación, para adaptarla a mi método de trabajo sin depender de un desarrollador cuando cambia un diseño.

**Criterios de aceptación:**

1. EL SISTEMA DEBERÁ almacenar las fórmulas de moldería como datos editables (nombre, variable de origen, operación, valor de operando y ajuste en cm), no como código fijo.
2. CUANDO la usuaria crea una fórmula EL SISTEMA DEBERÁ permitir seleccionar una medida (base o personalizada) como variable, una operación (dividir, multiplicar, sumar, restar) y un ajuste adicional (por ejemplo, contorno de pecho ÷ 4 + 0,5 cm).
3. CUANDO la usuaria crea un nuevo tipo de molde EL SISTEMA DEBERÁ permitir agruparle un conjunto de fórmulas y definir qué medidas requiere y qué datos adicionales se ingresan durante la construcción (como la medida de sisa dibujada).
4. CUANDO la usuaria modifica una fórmula existente EL SISTEMA DEBERÁ aplicar el cambio a los cálculos futuros sin alterar hojas de molde ya generadas, que conservan los valores calculados al momento de generarse.
5. SI una fórmula referencia una medida inexistente o produce una división por cero ENTONCES EL SISTEMA DEBERÁ rechazar el guardado y mostrar un mensaje de validación.
6. EL SISTEMA DEBERÁ incluir precargadas todas las fórmulas de los moldes definidos en el Req 5 y permitir restaurar una fórmula a su valor original.

### 13. Tablas de talles editables por la usuaria

**Historia de usuario:** Como modista, quiero editar y crear tablas de talles desde la aplicación, para ajustar los valores de referencia a mi criterio o incorporar nuevas tablas.

**Criterios de aceptación:**

1. CUANDO la usuaria abre una tabla de talles EL SISTEMA DEBERÁ permitir editar cualquier valor de medida por talle y guardar los cambios.
2. CUANDO la usuaria crea una tabla de talles personalizada EL SISTEMA DEBERÁ permitir definir sus talles, las medidas que contiene y sus valores, y seleccionarla como tabla activa para la sugerencia de talle.
3. CUANDO la usuaria duplica una tabla existente (por ejemplo, la de Baúl de Moda) EL SISTEMA DEBERÁ crear una copia editable sin modificar la original.
4. CUANDO la usuaria modifica una tabla activa EL SISTEMA DEBERÁ recalcular los talles sugeridos de las bailarinas afectadas, sin modificar los talles asignados manualmente.
5. EL SISTEMA DEBERÁ permitir restaurar las tablas precargadas a sus valores originales.

### 14. Exportación a PDF e impresión

**Historia de usuario:** Como modista, quiero exportar e imprimir la hoja de molde y el resumen de producción, para trabajar sobre papel en el taller sin depender de la pantalla.

**Criterios de aceptación:**

1. CUANDO la usuaria solicita exportar la hoja de molde de una bailarina EL SISTEMA DEBERÁ generar un PDF con nombre de la bailarina, tipo de molde, medidas reales, resultados calculados y, si existen, imágenes de referencia del diseño.
2. CUANDO la usuaria solicita exportar el resumen de producción de un grupo EL SISTEMA DEBERÁ generar un PDF con las cantidades por prenda y talle y la lista de bailarinas de cada combinación.
3. CUANDO la usuaria solicita imprimir EL SISTEMA DEBERÁ ofrecer una vista con estilos de impresión (sin navegación ni controles) para que la hoja quepa en hoja A4.
4. CUANDO la usuaria elige exportar un grupo completo EL SISTEMA DEBERÁ permitir generar en un solo PDF las hojas de molde de todas las bailarinas seleccionadas.

### 15. Estadísticas, consumo de tela, costos e inventario

**Historia de usuario:** Como modista, quiero estimar el consumo de tela, calcular costos y controlar mi inventario de materiales, para presupuestar vestuarios y saber qué necesito comprar.

**Criterios de aceptación:**

1. CUANDO la usuaria define el consumo de tela de un molde EL SISTEMA DEBERÁ permitir registrar la cantidad de tela (metros) por prenda y talle, y calcular el total necesario para las unidades del resumen de producción de un grupo.
2. CUANDO la usuaria registra materiales EL SISTEMA DEBERÁ permitir cargar por material: nombre, unidad de medida, costo unitario y stock disponible.
3. CUANDO la usuaria asigna materiales y cantidades a una prenda de un diseño EL SISTEMA DEBERÁ calcular el costo de materiales por prenda y por grupo, y permitir sumar un costo de mano de obra.
4. CUANDO el total de material requerido por la producción de un grupo supera el stock disponible EL SISTEMA DEBERÁ señalar el faltante de cada material.
5. CUANDO la usuaria confirma una producción EL SISTEMA DEBERÁ permitir descontar los materiales usados del stock.
6. EL SISTEMA DEBERÁ mostrar estadísticas básicas: cantidad de bailarinas por talle en todos los grupos, distribución de prendas por talle, y costo total por grupo.

## Fuera de alcance

- Biblioteca de moldes escaneados (idea para una versión futura): subir escaneos de moldes propios (PDF o imagen) asociados a molde, talle, bailarina o diseño, con calibración de escala, impresión 1:1 y partición en hojas A4. Requeriría subir el límite de tamaño de archivos a unos 25 MB. No incluye vectorizar ni graduar talles automáticamente.
- Soporte multi-usuaria o roles/permisos distintos a la modista dueña de los datos.
- Aplicación móvil nativa (el MVP es responsive web).

## Supuestos y preguntas abiertas

- Se asume una sola usuaria (la modista) sin necesidad de multi-tenant ni roles; Supabase Auth se usa para proteger el acceso, no para colaboración entre varias modistas.
- **Confirmado con la usuaria:** la fuente de la tabla de talles es "Baúl de Moda" (medidas corporales tomadas directamente sobre el cuerpo, sin holgura de molde ya sumada), no la tabla del Instituto Hermenegildo Zampar — se había detectado que ambas tablas difieren entre 1 y 6cm por medida y talle, y la usuaria eligió Baúl de Moda porque así toma las medidas en su trabajo. La tabla de Zampar queda descartada para el MVP.
- **Confirmado con la usuaria:** la regla de desempate del talle sugerido (Req 6.3) prioriza contorno de pecho para prendas tipo vestido/remera/cuerpo, y contorno de cadera para falda/pantalón, en vez de "tomar el talle más alto".
- Se asume que las tablas precargadas son Bebés/Niños/Adolescentes interpolados/Mujeres de Baúl de Moda, sin tabla de Hombres (no aplica al dominio de danza). Otras tablas (Zampar, industriales) las puede crear la usuaria con el editor del Req 13.
- **Confirmado con la usuaria:** el rango de Adolescentes (sin cobertura directa en Baúl de Moda, que salta de Niños talle 12 a Mujeres talle 40) se cubre generando talles intermedios por interpolación lineal entre esos dos extremos, en vez de usar una tabla de terceros (se descartó una tabla generada por IA vía Google AI Mode por no ser una fuente verificable y por usar una numeración de talles incompatible con la de Baúl de Moda, lo que hubiera generado dos "talle 40" con significados distintos dentro de la misma app).
- Falta confirmar: cuántos talles intermedios interpolar entre Niños talle 12 y Mujeres talle 40 (por ejemplo, 2 o 3 talles equiespaciados) y qué numeración usarles — se resuelve como detalle de diseño técnico, no bloquea el avance a `design.md`.
- **Confirmado con la usuaria:** se incorporan al alcance los ítems originalmente diferidos a v2 (fotos de referencia, historial de medidas, editor de diseño, fórmulas editables, tablas de talles editables, exportación PDF/impresión, estadísticas/consumo de tela/costos/inventario). Quedan como Req 9 a 15. Se recomienda entregarlos por fases en `tasks.md` (núcleo Req 1-8 primero) sin que eso los saque del alcance del proyecto.
- Supuesto: Req 10 reemplaza la sobrescritura simple; toda edición de medida genera una versión nueva.
- Falta confirmar (Req 15): el nivel de detalle esperado en costos e inventario — se asumió un modelo simple (materiales con stock y costo unitario, consumo de tela por prenda y talle, mano de obra como monto manual), sin compras a proveedores, facturación ni multi-moneda. Se puede acotar o ampliar antes del diseño.
- Falta confirmar (Req 9): límites de imágenes (tamaño máximo por archivo y cantidad por diseño); se asumió 5 MB por imagen y 10 imágenes por diseño.
- Falta confirmar (Req 12): alcance del editor de fórmulas — se asumió expresiones de una sola operación con un ajuste (variable, operación, operando, ajuste), sin fórmulas encadenadas ni condicionales, salvo referencias a resultados de otras fórmulas del mismo molde.
