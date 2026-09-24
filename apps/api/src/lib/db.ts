import { AppError } from './errors';

interface DbResult<T> {
  data: T | null;
  error: { code?: string; message: string; details?: string } | null;
}

const STATUS_BY_CODE: Record<string, [number, string]> = {
  '23505': [409, 'CONFLICT'],
  '23503': [409, 'INVALID_REFERENCE'],
  '23514': [422, 'VALIDATION_ERROR'],
  '22P02': [422, 'VALIDATION_ERROR'],
  P0002: [404, 'NOT_FOUND'],
  '42501': [403, 'FORBIDDEN'],
  HZ001: [409, 'INSUFFICIENT_STOCK'],
};

export function unwrap<T>(result: DbResult<T>): T {
  if (result.error) {
    const [status, code] = STATUS_BY_CODE[result.error.code ?? ''] ?? [500, 'DB_ERROR'];
    throw new AppError(status, code, status === 500 ? 'Error de base de datos' : result.error.message, status === 500 ? undefined : result.error.details);
  }
  return result.data as T;
}
