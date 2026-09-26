# Prompt para Claude Design — Toma de medidas guiada y prendas sin molde

Pegá esto en el mismo proyecto de Claude Design donde ya están las pantallas de Hilanzapp (Sistema, Móvil y Escritorio), para que reutilice los tokens y componentes existentes.

---

Seguimos con **Hilanzapp**, la app de una modista de vestuario de danza. Usá exactamente el sistema visual que ya diseñaste (tokens, tipografías Newsreader + IBM Plex, color óxido `#8E3B26` como primario, salvia `#4E6B52` como acento, superficies crema, y la convención de datos: **medida real** = borde ocre sólido, **calculado** = azul punteado, **talle sugerido** = rosa punteado, **manual** = oscuro). No inventes otro estilo. Todo en español rioplatense (voseo: "Tocá", "Cargá", "Elegí").

Necesito **agregar pantallas y estados** para dos problemas reales que me reportaron. Diseñá primero **móvil (360–390 px, la usa parada con la cinta métrica en la mano, a una mano)** y después **escritorio**.

## Problema 1 — "Sé qué medidas necesito y las cargo rápido"

Hoy, cuando le asigno un vestuario a una bailarina, la Hoja de molde dice "Faltan 3 de las 3 medidas" con enlaces sueltos a la ficha. Quiero un flujo guiado **"Tomar medidas"**.

### 1A. Flujo "Tomar medidas" (pantalla completa, móvil primero)
- Encabezado: botón cerrar (X), nombre de la bailarina, prenda/diseño que lo pide ("Pedido por: Pantalón · Vestido Aurora"), y progreso "3 de 7" con barra fina.
- Cuerpo: **una medida por paso**. Nombre grande de la medida en Newsreader ("Contorno de cadera"), una ayuda corta de cómo tomarla (una línea, opcional, colapsable), y un **campo numérico enorme** con sufijo "cm", teclado numérico, coma o punto. Debajo, si ya hay un valor anterior, un chip "Antes: 96 cm · 12 mar".
- Pie fijo (visible con el teclado abierto): "Anterior", "Saltar" (texto) y **"Siguiente"** (botón primario grande, ≥ 48 px). Enter también avanza.
- Debajo del campo, una **fila de mini-chips con toda la cola** (hecha ✓ / actual / pendiente / saltada) para ubicarse y tocar para saltar a otra.
- Estados a diseñar: campo vacío, valor válido, valor fuera de rango (error inline "Ingresá un valor entre 0 y 1000 cm"), guardando (spinner en el botón), **error de guardado** (aviso arriba, el valor queda escrito, botón "Reintentar"), medida ya cargada con opción **"Repetir medición"**.
- **Pantalla final / resumen**: "Listo, cargaste 6 medidas" con lista (✓ cargadas, ⏭ saltadas con enlace "Cargar ahora"), y botones "Ver hoja de molde" (primario) y "Volver a la ficha".
- **"Agregar más medidas"**: enlace dentro del flujo que abre un bottom sheet con campo **"Buscar medida"** (con ícono lupa, ignora tildes), lista con casillas de todas las medidas (base y personalizadas) que aún no están en la cola, contador "2 elegidas" y botón "Agregar a la toma". Al final de la lista: "¿No está? Crear medida personalizada". Las agregadas aparecen en la cola con la etiqueta "extra".

### 1B. Puntos de entrada (mostrar dónde vive el botón)
1. **Ficha de la bailarina → pestaña Medidas:** arriba, una tarjeta "Te faltan 4 medidas" con botón primario **"Tomar medidas"**; abajo, las medidas agrupadas: "Requeridas por sus prendas" (con etiqueta de qué prenda la pide y estado ✓/falta), **"Para {diseño}"** (las medidas especiales del diseño, hoy no se ven en ningún lado), y "Otras medidas".
2. **Hoja de molde bloqueada:** reemplazar los chips-enlace sueltos por un aviso con el botón **"Tomar las 3 que faltan"**; al terminar el flujo se vuelve a la hoja ya calculada (mostrar ese estado de retorno con un aviso "Hoja calculada con las medidas nuevas").
3. **Al asignar vestuario** (modal de nueva bailarina y asignación desde la ficha/diseño): después de elegir prendas, un panel "Para este vestuario vas a necesitar: Contorno de pecho, cintura, cadera, largo de pantalón, hombro a rodilla*" (* medida especial), con botones "Tomar medidas ahora" y "Después".
4. **Lista de bailarinas del grupo:** en cada fila, un chip de estado ("Faltan 3" en ámbar / "Completas" en salvia) y un botón de acción rápida "Tomar medidas" (ícono regla).

### 1C. Toma de medidas del grupo
- Botón **"Tomar medidas del grupo"** arriba de la lista de bailarinas. Abre el mismo flujo pero encadenado: al terminar una bailarina, pantalla intermedia "Emi terminada ✓ · Siguiente: Lucía (4 faltan)" con "Seguir" / "Saltar bailarina" / "Terminar".
- **Vista resumen "Faltantes del grupo"** (tabla en escritorio, tarjetas apilables en móvil): filas = bailarinas, columnas = medidas requeridas (en orden corporal), celdas ✓ con valor o "—" ámbar tocable (abre el flujo en esa medida). Filtro "Solo con faltantes", barra de progreso del grupo, y botón **"Imprimir lista"** (A4, una fila por bailarina con las medidas que faltan y espacio para anotar a mano — diseñar la hoja de impresión).

## Problema 2 — "Tengo un diseño con una prenda que no tiene molde"

Caso real: "Al grupo Amatista le tengo que hacer un vestido evasé. No tengo molde para eso. Así que cargué el diseño pero no el molde. Ahí encontré un obstáculo." Quiero **prendas propias "sin molde todavía"**.

### 2A. En el formulario de diseño (sección Prendas)
- Junto a la lista de moldes existentes, un botón secundario **"+ Prenda sin molde"**. Abre un panel/modal chico con: Nombre ("Vestido evasé"), Categoría (chips: Vestido, Falda, Pantalón, Cuerpo, Manga, Otro), **"Talle según"** (Pecho / Cadera / Ambos, con una línea de ayuda "Define qué medida usa la tabla para sugerir el talle"), y **"Medidas que necesita"**: selector con buscador (mismo patrón que "Medidas especiales", con contador de elegidas) y las elegidas como chips **reordenables** (arrastrar en escritorio, flechas subir/bajar en móvil).
- Cada prenda propia en la lista del diseño lleva una **etiqueta "Sin molde"** (estilo punteado, distinto de los moldes reales), con campo de mano de obra igual que las demás y menú "⋯" (Editar, Crear molde, Vincular a molde, Quitar).
- Estados: nombre vacío/repetido (error inline), sin medidas elegidas (advertencia suave, se puede guardar), confirmación al quitar una prenda ya asignada ("Se pierden 12 asignaciones").

### 2B. Consistencia en el resto de la app
Mostrar la etiqueta **"Sin molde"** y que todo funcione igual que una prenda normal en: chips de prendas de la lista de bailarinas, ficha (pestaña Talle, con talle sugerido/manual), **Producción por talle**, Inventario y costos (consumo por talle, mano de obra), y el PDF de producción. Mostrar un ejemplo de Producción con una fila "Vestido evasé · Sin molde — 12 prendas: T40 ×4, T42 ×5, T44 ×3".

### 2C. Hoja de molde de una prenda sin molde
- Estado explicativo amable (ícono de tijera con línea punteada, título "Esta prenda todavía no tiene molde", texto "Igual podés tomar medidas, asignar talles y planificar la producción").
- Tarjeta con las **medidas que pide la prenda y los valores cargados de la bailarina** (para trazar a mano), con "Tomar medidas" si faltan.
- Dos acciones claras: **"Crear molde con esta prenda"** (primario) y **"Vincular a un molde existente"** (secundario). Botón "Exportar PDF" con la hoja simplificada (bailarina, prenda, talle, medidas) — diseñar la versión impresa A4.

### 2D. Convertir o vincular después
- **Crear molde:** abre el editor de fórmulas ya existente con un banner "Molde nuevo desde 'Vestido evasé'" y las medidas requeridas ya cargadas como entradas, listo para escribir fórmulas.
- **Vincular a molde existente:** modal con la lista de moldes (buscador), y al elegir uno un resumen de impacto: "Pide 2 medidas que Emi todavía no tiene", "Se conservan 12 asignaciones, talles manuales, consumo y costos". Botón "Vincular" con confirmación de que es definitivo. Estado de éxito: la prenda pierde la etiqueta "Sin molde".

## Entregables
1. Móvil: flujo completo de "Tomar medidas" (paso, error, ya cargada, sheet de agregar medidas, resumen), ficha con tarjeta de faltantes, aviso en Hoja de molde, panel post-asignación, fila de lista con chip, "Tomar medidas del grupo", formulario "Prenda sin molde", hoja de molde sin molde.
2. Escritorio: las mismas pantallas reacomodadas (el flujo de toma puede ser un panel lateral o modal centrado de ~480 px), vista resumen de faltantes en tabla, y los modales de crear/vincular molde.
3. Hojas de impresión A4: "Faltantes del grupo" y "Hoja simplificada de prenda sin molde".
4. Para cada pantalla: estados vacío, cargando (usá las frases de taller ya existentes: "Tomando medidas…", "Marcando el molde…"), error y éxito.
5. Reglas de accesibilidad: objetivos táctiles ≥ 44 px, foco visible, contraste AA, `aria-live` en progreso y errores, el flujo completo operable con teclado, `prefers-reduced-motion` respetado (solo animar `transform` y `opacity`).

Mantené la regla de contenido: **las medidas reales nunca se pisan** (cada carga crea una versión nueva; mostrá "Antes: …" cuando repite una medición) y **el talle manual siempre manda sobre el sugerido**.
