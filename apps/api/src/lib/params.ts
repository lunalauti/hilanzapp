import { z } from 'zod';
import { validation } from './errors';

export const uuid = z.string().uuid('Identificador inválido');

export function parseUuid(value: unknown): string {
  const r = uuid.safeParse(value);
  if (!r.success) throw validation([{ path: 'id', message: 'Identificador inválido' }]);
  return r.data;
}

export const isTrue = (v: unknown) => v === 'true' || v === '1';
