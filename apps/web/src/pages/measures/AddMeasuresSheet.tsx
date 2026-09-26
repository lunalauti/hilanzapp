import { useEffect, useMemo, useState } from 'react';
import type { MeasureDef } from '../../lib/types';

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Hoja inferior "Agregar medidas": todas las medidas del cuerpo que aún no están en la toma, con buscador. */
export function AddMeasuresSheet({ defs, inQueue, onClose, onAdd, onCreateCustom }: {
  defs: MeasureDef[]; inQueue: Set<string>; onClose: () => void; onAdd: (chosen: MeasureDef[]) => void; onCreateCustom: () => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const needle = fold(query.trim());
  const available = useMemo(() => defs.filter((d) => !inQueue.has(d.key) && (!needle || fold(d.name).includes(needle))), [defs, inQueue, needle]);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <>
      <div className="hz-tm-scrim" onClick={onClose} aria-hidden="true" />
      <div className="hz-tm-sheet" role="dialog" aria-modal="true" aria-label="Agregar medidas">
        <div className="hz-tm-sheet-head">
          <span className="grip" aria-hidden="true" />
          <div className="d-flex align-items-center justify-content-between">
            <span className="hz-tm-sheet-title">Agregar medidas</span>
            <button type="button" className="hz-tm-iconbtn" aria-label="Cerrar" onClick={onClose}><i className="bi bi-x-lg" /></button>
          </div>
          <label className="hz-tm-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input type="search" aria-label="Buscar medida" placeholder="Buscar medida" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </label>
        </div>
        <div className="hz-tm-sheet-list" role="group" aria-label="Medidas disponibles">
          {available.map((d) => {
            const on = chosen.includes(d.id);
            return (
              <button key={d.id} type="button" role="checkbox" aria-checked={on} className="hz-tm-row" onClick={() => toggle(d.id)}>
                <span className={`box ${on ? 'on' : ''}`}>{on && <i className="bi bi-check-lg" />}</span>
                <span className="flex-grow-1">{d.name}</span>
                <span className="tag">{d.isBase ? 'Base' : 'Personalizada'}</span>
              </button>
            );
          })}
          {available.length === 0 && <div className="hz-tm-none">{needle ? <>No hay medidas con “{query.trim()}”.</> : 'Ya están todas las medidas en la toma.'}</div>}
          <button type="button" className="hz-tm-row create" onClick={onCreateCustom}><i className="bi bi-plus-circle" />¿No está? Crear medida personalizada</button>
        </div>
        <div className="hz-tm-sheet-foot">
          <span aria-live="polite" className="count">{chosen.length === 1 ? '1 elegida' : `${chosen.length} elegidas`}</span>
          <button type="button" className="hz-tm-primary" disabled={chosen.length === 0} onClick={() => onAdd(defs.filter((d) => chosen.includes(d.id)))}>Agregar a la toma</button>
        </div>
      </div>
    </>
  );
}
