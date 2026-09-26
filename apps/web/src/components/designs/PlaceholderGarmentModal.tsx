import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import type { MeasureDef, Priority } from '../../lib/types';

export type GarmentCategory = 'vestido' | 'falda' | 'pantalon' | 'cuerpo' | 'manga' | 'otro';

/** Una prenda propia dentro del formulario de diseño (todavía sin molde). */
export interface CustomGarment {
  /** Presente cuando la prenda ya existe (molde vacío guardado). */
  moldTypeId?: string;
  name: string;
  category: GarmentCategory;
  sizePriority: Priority;
  measureIds: string[];
  labor: string;
  assignedCount?: number;
}

export const CATEGORIES: { id: GarmentCategory; label: string }[] = [
  { id: 'vestido', label: 'Vestido' }, { id: 'falda', label: 'Falda' }, { id: 'pantalon', label: 'Pantalón' },
  { id: 'cuerpo', label: 'Cuerpo' }, { id: 'manga', label: 'Manga' }, { id: 'otro', label: 'Otro' },
];
const PRIORITIES: { id: Priority; label: string }[] = [{ id: 'pecho', label: 'Pecho' }, { id: 'cadera', label: 'Cadera' }, { id: 'both', label: 'Ambos' }];
export const defaultPriority = (c: GarmentCategory): Priority => (c === 'falda' || c === 'pantalon' ? 'cadera' : 'pecho');
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "+ Prenda sin molde": nombre, categoría, talle según y las medidas que necesita (con orden). */
export function PlaceholderGarmentModal({ show, initial, defs, takenNames, onClose, onSave }: {
  show: boolean; initial: CustomGarment | null; defs: MeasureDef[]; takenNames: string[]; onClose: () => void; onSave: (g: CustomGarment) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('vestido');
  const [priority, setPriority] = useState<Priority>('pecho');
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [manualOrder, setManualOrder] = useState(false);
  const [query, setQuery] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!show) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? 'vestido');
    setPriority(initial?.sizePriority ?? 'pecho');
    setPriorityTouched(Boolean(initial));
    setChosen(initial?.measureIds ?? []);
    setManualOrder(Boolean(initial));
    setQuery('');
    setTried(false);
  }, [show, initial]);

  const byId = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const trimmed = name.trim();
  const duplicate = trimmed !== '' && takenNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
  const nameError = tried ? (trimmed === '' ? 'Poné un nombre para la prenda.' : duplicate ? `Ya hay una prenda “${trimmed}” en este diseño. Elegí otro nombre.` : '') : (duplicate ? `Ya hay una prenda “${trimmed}” en este diseño. Elegí otro nombre.` : '');
  const needle = fold(query.trim());
  const candidates = defs.filter((d) => !chosen.includes(d.id) && (!needle || fold(d.name).includes(needle)));

  function pickCategory(c: GarmentCategory) {
    setCategory(c);
    if (!priorityTouched) setPriority(defaultPriority(c));
  }
  function add(id: string) {
    setChosen((cur) => {
      if (manualOrder) return [...cur, id];
      const next = [...cur, id];
      return next.sort((a, b) => (byId.get(a)?.sort ?? 999) - (byId.get(b)?.sort ?? 999));
    });
  }
  const remove = (id: string) => setChosen((c) => c.filter((x) => x !== id));
  function move(i: number, delta: number) {
    setChosen((c) => { const next = [...c]; const j = i + delta; if (j < 0 || j >= next.length) return c; [next[i], next[j]] = [next[j]!, next[i]!]; return next; });
    setManualOrder(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!trimmed || duplicate) return;
    onSave({ ...(initial?.moldTypeId ? { moldTypeId: initial.moldTypeId } : {}), name: trimmed, category, sizePriority: priority, measureIds: chosen, labor: initial?.labor ?? '', ...(initial?.assignedCount !== undefined ? { assignedCount: initial.assignedCount } : {}) });
    onClose();
  }

  return (
    <Modal show={show} onHide={onClose} centered scrollable>
      <form onSubmit={submit} noValidate className="d-flex flex-column" style={{ minHeight: 0 }}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">Prenda sin molde</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="pg-name" className="hz-label">Nombre</label>
            <input id="pg-name" className={`hz-input ${nameError ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vestido evasé" autoFocus aria-invalid={Boolean(nameError)} />
            {nameError && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{nameError}</span>}
          </div>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Categoría</legend>
            <div className="d-flex flex-wrap gap-2">
              {CATEGORIES.map((c) => <button key={c.id} type="button" className={`hz-pill ${category === c.id ? 'active' : ''}`} aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>{c.label}</button>)}
            </div>
          </fieldset>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Talle según</legend>
            <div className="hz-segmented" role="group" aria-label="Talle según">
              {PRIORITIES.map((p) => <button key={p.id} type="button" className={`hz-seg-btn ${priority === p.id ? 'active' : ''}`} aria-pressed={priority === p.id} onClick={() => { setPriority(p.id); setPriorityTouched(true); }}>{p.label}</button>)}
            </div>
            <span className="small text-secondary">Define qué medida usa la tabla para sugerir el talle.</span>
          </fieldset>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Medidas que necesita<span className="text-secondary fw-normal" aria-live="polite"> · {chosen.length} {chosen.length === 1 ? 'elegida' : 'elegidas'}</span></legend>
            {chosen.length > 0 && (
              <ol className="hz-chosen" aria-label="Medidas elegidas, en orden">
                {chosen.map((id, i) => (
                  <li key={id}>
                    <span className="num">{i + 1}</span><span className="flex-grow-1">{byId.get(id)?.name ?? id}</span>
                    <button type="button" className="hz-icon-btn" aria-label={`Subir ${byId.get(id)?.name}`} disabled={i === 0} onClick={() => move(i, -1)}><i className="bi bi-arrow-up" /></button>
                    <button type="button" className="hz-icon-btn" aria-label={`Bajar ${byId.get(id)?.name}`} disabled={i === chosen.length - 1} onClick={() => move(i, 1)}><i className="bi bi-arrow-down" /></button>
                    <button type="button" className="hz-icon-btn danger" aria-label={`Quitar ${byId.get(id)?.name}`} onClick={() => remove(id)}><i className="bi bi-x-lg" /></button>
                  </li>
                ))}
              </ol>
            )}
            {chosen.length === 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />Todavía no elegiste medidas. Podés guardar igual, pero “Tomar medidas” no va a pedir nada para esta prenda.</div>}
            <label className="hz-search">
              <i className="bi bi-search" />
              <input type="search" placeholder="Buscar medida" aria-label="Buscar medida" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="d-flex flex-wrap gap-2">
              {candidates.map((d) => <button key={d.id} type="button" className="hz-pill" onClick={() => add(d.id)}><i className="bi bi-plus-lg" />{d.name}</button>)}
              {candidates.length === 0 && <span className="small text-secondary">{needle ? `Ninguna medida coincide con “${query.trim()}”.` : 'Ya elegiste todas las medidas.'}</span>}
            </div>
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary">Guardar prenda</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
