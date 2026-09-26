import type { MeasureStatus } from '../../lib/types';

/** Solo "Faltan N" llama la atención; "Completas" queda apagado. */
export function MeasureStatusLabel({ status, done, total }: { status: MeasureStatus; done: number; total: number }) {
  if (status === 'complete') return <span className="hz-status quiet"><i className="bi bi-check2" />Completas</span>;
  const missing = Math.max(0, total - done);
  return <span className="hz-status warn"><i className="bi bi-circle-fill" style={{ fontSize: 7 }} />{missing === 1 ? 'Falta 1' : `Faltan ${missing}`}</span>;
}
