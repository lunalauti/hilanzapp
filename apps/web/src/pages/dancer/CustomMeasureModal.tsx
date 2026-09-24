import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { api } from '../../lib/apiClient';
import { ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/format';

export function CustomMeasureModal({ show, dancerId, onClose, onSaved }: { show: boolean; dancerId: string; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; value?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (show) { setName(''); setValue(''); setNote(''); setErrors({}); } }, [show]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Poné un nombre para la medida.';
    const v = parseDecimal(value);
    if (v === null) next.value = 'Ingresá un número, por ejemplo 68 o 68,5.';
    setErrors(next);
    if (next.name || next.value || v === null) return;
    setBusy(true);
    try {
      const def = await api.post<{ id: string }>('/measure-definitions', { name });
      await api.put(`/dancers/${dancerId}/measurements/${def.id}`, { valueCm: v, note: note.trim() || null });
      onSaved(name.trim());
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'No pudimos guardar la medida.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">Medida personalizada</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="cm-name" className="hz-label">Nombre</label>
            <input id="cm-name" className={`hz-input ${errors.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Largo falda trasera" autoFocus />
            {errors.name && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.name}</span>}
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="cm-value" className="hz-label">Valor (cm)</label>
            <input id="cm-value" inputMode="decimal" className={`hz-input ${errors.value ? 'is-invalid' : ''}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="68" />
            {errors.value && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.value}</span>}
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="cm-note" className="hz-label">Observación (opcional)</label>
            <input id="cm-note" className="hz-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Desde segunda cintura" />
          </div>
          {errors.form && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{errors.form}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
