export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Falta iniciar sesión') => new AppError(401, 'UNAUTHORIZED', message);
export const notFound = (message = 'No encontrado') => new AppError(404, 'NOT_FOUND', message);
export const validation = (details: unknown, message = 'Datos inválidos') => new AppError(422, 'VALIDATION_ERROR', message, details);
