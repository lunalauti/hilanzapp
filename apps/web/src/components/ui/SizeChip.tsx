import type { SizeOrigin } from '../../lib/types';

/** Sugerido: rosa punteado. Manual: relleno oscuro con lápiz. Sin talle: borde discontinuo. */
export function SizeChip({ label, origin, small, outOfRange }: { label: string | null; origin: SizeOrigin; small?: boolean; outOfRange?: boolean }) {
  const size = small ? { height: 26, fontSize: 13 } : undefined;
  if (!label) return <span className="hz-chip hz-chip-none" style={size}>Sin talle</span>;
  if (origin === 'suggested') {
    return (
      <span className="hz-chip hz-sug" style={size} title={outOfRange ? 'Sugerido, pero la medida está fuera de la tabla' : 'Talle sugerido'}>
        T{label}<span className="hz-chip-tag">SUG.</span>{outOfRange && <i className="bi bi-exclamation-triangle" aria-label="Fuera de la tabla" style={{ fontSize: 11 }} />}
      </span>
    );
  }
  return <span className="hz-chip hz-manual" style={size} title="Talle asignado a mano">T{label}<i className="bi bi-pencil-fill" style={{ fontSize: 9 }} /></span>;
}
