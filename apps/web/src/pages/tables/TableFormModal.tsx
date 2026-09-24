import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import type { AgeRange, SizeTableGrid } from '../../lib/types';

export const AGE_LABEL: Record<AgeRange, string> = { bebe: 'Bebés', nino: 'Niños', adolescente: 'Adolescentes', mujer: 'Adultas', otro: 'Otro' };

export function TableFormModal({ show, table, onClose, onSaved }: { show: boolean; table?: SizeTableGrid; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange>('otro');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (show) { setName(table?.name ?? ''); setAgeRange(table?.ageRange ?? 'otro'); setSource(table?.source ?? ''); setError(null); } }, [show, table]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('El nombre es obligatorio.');
    setBusy(true);
    try {
      const saved = table
        ? await api.patch<SizeTableGrid>(`/size-tables/${table.id}`, { name, source: source.trim() || null, ...(table.isActive ? {} : { ageRange }) })
        : await api.post<SizeTableGrid>('/size-tables', { name, ageRange, source: source.trim() || null });
      onSaved(saved.id);
      onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No pudimos guardar la tabla.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{table ? 'Editar tabla' : 'Nueva tabla de talles'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="tbl-name" className="hz-label">Nombre</label>
            <input id="tbl-name" className={`hz-input ${error ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Infantil-juvenil 2026" autoFocus />
            {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="tbl-age" className="hz-label">Rango etario</label>
            <select id="tbl-age" className="hz-input" value={ageRange} disabled={Boolean(table?.isActive)} onChange={(e) => setAgeRange(e.target.value as AgeRange)}>
              {(Object.keys(AGE_LABEL) as AgeRange[]).map((k) => <option key={k} value={k}>{AGE_LABEL[k]}</option>)}
            </select>
            <span className="small text-secondary">{table?.isActive ? 'Una tabla activa no puede cambiar de rango.' : 'La app usa la tabla activa del rango que corresponde a la edad de cada bailarina.'}</span>
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="tbl-source" className="hz-label">Fuente (opcional)</label>
            <input id="tbl-source" className="hz-input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Mi criterio, Baúl de Moda…" />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
