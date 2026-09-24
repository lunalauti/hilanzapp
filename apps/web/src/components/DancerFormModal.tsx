import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { ApiError } from '../lib/api';
import type { GroupDancer } from '../lib/types';
import { useInvalidateDancerData } from '../lib/queries';
import { useToast } from './ui/Toast';

export function DancerFormModal({ show, groupId, dancer, onClose }: { show: boolean; groupId: string; dancer?: GroupDancer; onClose: () => void }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [errors, setErrors] = useState<{ name?: string; age?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateDancerData();
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (show) { setName(dancer?.name ?? ''); setAge(dancer?.age?.toString() ?? ''); setErrors({}); }
  }, [show, dancer]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'El nombre es obligatorio.';
    const ageNum = age.trim() === '' ? null : Number(age);
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120)) next.age = 'La edad debe ser un número entre 0 y 120.';
    setErrors(next);
    if (next.name || next.age) return;

    setBusy(true);
    try {
      if (dancer) await api.patch(`/dancers/${dancer.id}`, { name, age: ageNum });
      else await api.post('/dancers', { groupId, name, age: ageNum });
      invalidate(dancer?.id, groupId);
      void qc.invalidateQueries({ queryKey: ['group-dancers', groupId] });
      toast.show(`${name.trim()} guardada`);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'No pudimos guardar la bailarina.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{dancer ? 'Editar bailarina' : 'Agregar bailarina'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="dancer-name" className="hz-label">Nombre</label>
            <input id="dancer-name" className={`hz-input ${errors.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.name}</span>}
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="dancer-age" className="hz-label">Edad (opcional)</label>
            <input id="dancer-age" inputMode="numeric" className={`hz-input ${errors.age ? 'is-invalid' : ''}`} value={age} onChange={(e) => setAge(e.target.value)} aria-invalid={Boolean(errors.age)} />
            {errors.age && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.age}</span>}
            <span className="small text-secondary">La edad define qué tabla de talles se usa.</span>
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
