/** "88,5" o "88.5" → 88.5. Devuelve null si no es un número no negativo. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function formatCm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace('.', ',');
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export function formatMoney(n: number): string {
  return money.format(Math.round(n));
}

export function formatQty(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace('.', ',');
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "hoy" o "12 mar" para fechas AAAA-MM-DD (o ISO). */
export function formatShortDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  if (y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate()) return 'hoy';
  return `${d} ${MONTHS[m - 1]}`;
}

export const todayIso = (now: Date = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** "A", "A y B", "A, B y C". */
export function joinEs(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}
