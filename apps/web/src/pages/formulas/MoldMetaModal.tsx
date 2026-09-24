import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { keys } from '../../lib/queries';
import type { Mold, MoldFormula, MoldInput, Priority } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';

export function MoldMetaModal({ show, mode, mold, draft, inputs, onClose, onDone }: {
  show: boolean; mode: 'rename' | 'duplicate'; mold: Mold; draft: MoldFormula[]; inputs: MoldInput[]; onClose: () => void; onDone: (createdId?: string) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<Priority>('pecho');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (show) { setName(mode === 'rename' ? mold.name : `${mold.name} (copia)`); setPriority(mold.sizePriority); setError(null); } }, [show, mode, mold]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('El nombre es obligatorio.');
    setBusy(true);
    try {
      if (mode === 'rename') {
        await api.patch(`/mold-types/${mold.id}`, { name, sizePriority: priority });
        await qc.invalidateQueries({ queryKey: keys.molds });
        toast.show('Molde actualizado');
        onDone();
      } else {
        const created = await api.post<{ id: string }>('/mold-types', { name, category: mold.category, sizePriority: priority, inputs, formulas: draft });
        await qc.invalidateQueries({ queryKey: keys.molds });
        toast.show(`Molde ${name.trim()} creado`);
        onDone(created.id);
      }
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No pudimos guardar el molde.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{mode === 'rename' ? 'Renombrar molde' : 'Duplicar molde'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {mode === 'duplicate' && <p className="mb-0 text-secondary">Se crea un molde propio con las fórmulas y datos que ves ahora. El original no cambia.</p>}
          <div className="d-flex flex-column gap-1">
            <label htmlFor="mold-name" className="hz-label">Nombre</label>
            <input id="mold-name" className={`hz-input ${error ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="mold-priority" className="hz-label">Talle según</label>
            <select id="mold-priority" className="hz-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="pecho">Pecho (vestidos, remeras, cuerpos)</option>
              <option value="cadera">Cadera (faldas, pantalones)</option>
              <option value="both">Ambos (se agrupa por pecho y se avisa)</option>
            </select>
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
