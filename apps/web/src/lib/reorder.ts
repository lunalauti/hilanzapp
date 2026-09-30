/** Mueve `activeId` a la posición de `overId` dentro de la lista (arrastrar y soltar). Sin cambios si alguno no está. */
export function reorderById<T>(list: T[], activeId: T, overId: T): T[] {
  const from = list.indexOf(activeId);
  const to = list.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
