import type { MeasureStatus } from '../../lib/types';

/** "Completas" o "Faltan N", según lo que piden las prendas asignadas. */
export function MeasureStatusLabel({ status, done, total }: { status: MeasureStatus; done: number; total: number }) {
  if (status === 'complete') return <span className="hz-status ok"><i className="bi bi-check-circle-fill" />Completas</span>;
  const missing = Math.max(0, total - done);
  return (
    <span className={`hz-status ${status === 'partial' ? 'warn' : 'none'}`}>
      <i className={`bi ${status === 'partial' ? 'bi-circle-half' : 'bi-circle'}`} />{missing === 1 ? 'Falta 1' : `Faltan ${missing}`}
    </span>
  );
}
