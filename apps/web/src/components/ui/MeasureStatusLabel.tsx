import type { MeasureStatus } from '../../lib/types';

export function MeasureStatusLabel({ status, done, total }: { status: MeasureStatus; done: number; total: number }) {
  if (status === 'complete') return <span className="hz-status ok"><i className="bi bi-check-circle-fill" />Completa</span>;
  if (status === 'partial') return <span className="hz-status warn"><i className="bi bi-circle-half" />Parcial · faltan {total - done}</span>;
  return <span className="hz-status none"><i className="bi bi-circle" />Sin cargar</span>;
}
