import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, validation } from '../lib/errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Ruta no encontrada'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let e: AppError;
  if (err instanceof AppError) e = err;
  else if (err instanceof ZodError) e = validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  else if (err instanceof SyntaxError && 'body' in err) e = new AppError(400, 'BAD_JSON', 'El cuerpo de la solicitud no es JSON válido');
  else {
    console.error(err);
    e = new AppError(500, 'INTERNAL', 'Error interno del servidor');
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } });
}
