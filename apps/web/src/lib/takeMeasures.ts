import { parseDecimal } from './format';
import type { PlanItem } from './types';

/** Nombres cortos para los chips de la cola; el resto se acorta con reglas simples. */
const SHORT: Record<string, string> = {
  largo_hombro_rodilla: 'Hombro–rodilla', largo_pantalon: 'L. pantalón', largo_falda: 'L. falda', largo_delantero: 'L. delantero',
  largo_trasero: 'L. trasero', largo_manga: 'L. manga', largo_busto: 'L. busto', separacion_busto: 'Sep. busto',
  ancho_espalda: 'A. espalda', ancho_hombro: 'A. hombro', segunda_cintura: '2ª cintura', bajo_busto: 'Bajo busto',
};

export function shortName(key: string, name: string): string {
  if (SHORT[key]) return SHORT[key];
  const contorno = /^Contorno de (.+)$/i.exec(name);
  if (contorno) return contorno[1]!.charAt(0).toUpperCase() + contorno[1]!.slice(1);
  const largo = /^Largo de (.+)$/i.exec(name);
  if (largo) return `L. ${largo[1]}`;
  return name;
}

export interface QueueItem {
  definitionId: string; key: string; name: string; short: string; help: string | null;
  /** Quién pide la medida: prendas y diseños (o "Medidas base"). */
  requiredBy: string[];
  value: number | null; takenOn: string | null;
  extra: boolean;
}

export type StepStatus = 'current' | 'done' | 'skipped' | 'pending';

export function toQueueItem(i: PlanItem, help: string | null, extra = false): QueueItem {
  return {
    definitionId: i.definitionId, key: i.key, name: i.name, short: shortName(i.key, i.name), help,
    requiredBy: i.requiredBy.map((r) => r.label), value: i.value, takenOn: i.takenOn, extra,
  };
}

/** Cola de la toma: todas las medidas pedidas (o solo las de `only`), en orden corporal. */
export function buildQueue(items: PlanItem[], helpByKey: Record<string, string | null | undefined>, only?: string[]): QueueItem[] {
  const keep = only?.length ? new Set(only) : null;
  return items.filter((i) => !keep || keep.has(i.key)).map((i) => toQueueItem(i, helpByKey[i.key] ?? null));
}

/** Primera medida que falta; si no falta ninguna, la primera. */
export function initialIndex(queue: QueueItem[]): number {
  const i = queue.findIndex((q) => q.value === null);
  return i >= 0 ? i : 0;
}

const isOpen = (q: QueueItem, skipped: Set<string>) => q.value === null && !skipped.has(q.key);

/** Próxima medida abierta después de `from` (o desde el principio); -1 si no queda ninguna. */
export function nextIndex(queue: QueueItem[], from: number, skipped: Set<string>): number {
  for (let i = from + 1; i < queue.length; i++) if (isOpen(queue[i]!, skipped)) return i;
  for (let i = 0; i <= from && i < queue.length; i++) if (isOpen(queue[i]!, skipped)) return i;
  return -1;
}

export function stepStatus(queue: QueueItem[], index: number, i: number, skipped: Set<string>): StepStatus {
  if (i === index) return 'current';
  const q = queue[i]!;
  if (q.value !== null) return 'done';
  return skipped.has(q.key) ? 'skipped' : 'pending';
}

/** Agrega medidas extra al final de la cola sin duplicar. */
export function withExtras(queue: QueueItem[], extras: QueueItem[]): QueueItem[] {
  const have = new Set(queue.map((q) => q.key));
  return [...queue, ...extras.filter((e) => !have.has(e.key)).map((e) => ({ ...e, extra: true }))];
}

export type ParsedValue = { ok: true; value: number } | { ok: false; error: string };

export const RANGE_ERROR = 'Ingresá un valor entre 0 y 1000 cm.';
export const EMPTY_ERROR = 'Cargá un valor o tocá Saltar.';

/** Acepta coma o punto; el rango es el mismo que valida la API. */
export function parseMeasure(text: string): ParsedValue {
  if (!text.trim()) return { ok: false, error: EMPTY_ERROR };
  const n = parseDecimal(text);
  if (n === null || Number.isNaN(n) || n <= 0 || n > 1000) return { ok: false, error: RANGE_ERROR };
  return { ok: true, value: n };
}
