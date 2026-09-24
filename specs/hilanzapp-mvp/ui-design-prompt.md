Diseñá la interfaz de **Hilanzapp**, una aplicación web en español rioplatense para una modista que hace vestuario de danza. Necesito un sistema de diseño y las pantallas clave, listas para implementar con **Bootstrap 5 + React**.

## Contexto de uso
- Una sola usuaria: una modista que trabaja con ~10 grupos de danza (Ágata, Jade, Turmalina, Amatista...) de 10 a 15 bailarinas cada uno, desde niñas hasta adultas.
- Toma medidas con cinta métrica y **celular o tablet en la mano**, y hace moldes sobre la mesa de corte mirando la pantalla. Diseñá **mobile-first** (360 px) y que escale bien a tablet y escritorio.
- Es una herramienta de trabajo: prioriza legibilidad de números, entrada rápida de datos y cero cálculos manuales. Tono cálido y de atelier, no de software corporativo.

## Principio que la interfaz tiene que hacer evidente
**"Medidas reales para construir el molde; talles para organizar la producción."** Siempre se distingue visualmente la **medida real** (lo que se cargó con la cinta) del **resultado calculado** (lo que sale de la fórmula). Nunca se muestran mezcladas sin distinción, y el talle **sugerido** se distingue del talle **asignado a mano**.

## Pantallas a diseñar
1. **Login** (email y contraseña).
2. **Inicio:** lista de grupos como tarjetas (nombre, cantidad de bailarinas, avance de medidas), botón "Nuevo grupo".
3. **Grupo:** lista de bailarinas con nombre, talle efectivo, estado de medidas (sin cargar / parcial / completa), vestuario asignado; alta, edición y borrado con confirmación que muestra cuántos datos se pierden.
4. **Ficha de bailarina:** datos generales; medidas base en centímetros con edición rápida en línea; "+ Agregar medida personalizada" (nombre, valor, observación); historial por medida con restaurar y comparar dos tomas lado a lado; panel de talle con desglose por medida (pecho, cintura, cadera → qué talle da cada una), talle sugerido, talle manual y talle por prenda; aviso "fuera de rango".
5. **Hoja de molde** (la pantalla más importante): selector de molde, medidas requeridas con las faltantes marcadas y enlazadas a la ficha, campos manuales (p. ej. "medida de sisa dibujada", "largo de canesú"), opción de vuelo (1/2 campana, campana, doble campana), y una tabla que muestra **lado a lado** medida real → fórmula → resultado (ej.: Pecho real 88 cm · ÷ 4 · 22 cm). Números grandes y fáciles de leer a distancia. Variante para imprimir en A4 sin navegación.
6. **Producción del grupo:** por prenda y talle con cantidades (Pantalón: T8 ×3, T10 ×4...), al tocar un talle se despliegan los nombres; bailarinas pendientes destacadas; botón exportar PDF.
7. **Diseños de vestuario:** ficha con escote, manga, falda, volado, asimetría, detalles de confección, galería de fotos o dibujos de referencia (subida, miniaturas, ampliar) y medidas especiales.
8. **Editor de fórmulas de moldería:** elegir medida, operación, operando y ajuste (ej.: Pecho ÷ 4 + 0,5 cm), con vista previa en vivo y "restaurar original".
9. **Editor de tablas de talles:** grilla editable talle × medida, con marca de origen por celda (fuente, interpolado, extrapolado, editado), duplicar, activar y restaurar.
10. **Inventario y costos:** materiales con stock y costo, consumo por prenda y talle, costo por grupo, faltantes resaltados, estadísticas simples.

## Estados y componentes que deben resolverse
Vacío, cargando, error de validación en línea, faltan medidas (bloquea el cálculo y dice cuáles), confirmación de borrado destructivo, éxito al guardar, fuera de rango, servicio despertando (la API puede tardar 30 s en arrancar). Componentes: campo numérico con unidad (cm), tarjeta de grupo, fila de bailarina, chip de talle (sugerido vs manual vs extrapolado), tabla real/fórmula/resultado, selector con opción "Otro", subida de imágenes, barra de navegación inferior en móvil.

## Dirección visual
- Paleta **propia**, cálida y sobria (evitá los azules y violetas por defecto de Bootstrap): pensá en tela, hilo, papel de molde y lápiz de sastre. Definí tokens: primario, acento, superficies en capas (base, elevada, flotante), estados (éxito, aviso, error) y colores para "real", "calculado" y "sugerido".
- Tipografía: una **serif de display** para títulos y una **sans limpia** para datos; números tabulares y de buen tamaño.
- Sombras suaves con tinte de color, bordes redondeados moderados, íconos de línea. Estados hover, foco y activo en todo lo clicable; zonas táctiles de al menos 44 px.
- Modo claro por defecto; contraste AA.
- Nada de datos inventados en abstracto: usá contenido de ejemplo real (grupo "Ágata", bailarinas Martina, Sofía, Valentina, Camila; talles 10, 12, 14; pecho 88 cm, cuello 36 cm, espalda 40 cm).

## Entregables
1. Sistema de diseño: tokens de color, tipografía, espaciado, radios, sombras, y sus equivalentes como **variables de Bootstrap 5** (Sass o CSS custom properties).
2. Las 10 pantallas en móvil y las 5 principales (Inicio, Grupo, Ficha, Hoja de molde, Producción) también en tablet o escritorio.
3. Estados principales de cada pantalla.
4. Notas de implementación por componente indicando qué clases o componentes de `react-bootstrap` usar y qué hace falta personalizar.
