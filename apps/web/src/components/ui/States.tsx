import { ApiError } from '../../lib/api';

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="d-flex flex-column gap-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="hz-skeleton" />)}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'No pudimos conectar con el servidor.';
  return (
    <div className="hz-notice danger" role="alert">
      <i className="bi bi-exclamation-triangle" />
      <div className="d-flex flex-column gap-2">
        <span>{message}</span>
        {onRetry && <button type="button" className="btn btn-sm btn-outline-danger align-self-start" onClick={onRetry}>Reintentar</button>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, note, action }: { icon: string; title: string; note?: string; action?: React.ReactNode }) {
  return (
    <div className="hz-empty">
      <i className={`bi ${icon}`} />
      <strong>{title}</strong>
      {note && <span>{note}</span>}
      {action}
    </div>
  );
}
