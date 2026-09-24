import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { ApiError } from '../lib/api';
import { keys } from '../lib/queries';
import type { Group } from '../lib/types';
import { useToast } from './ui/Toast';

export function GroupFormModal({ show, group, onClose, onSaved }: { show: boolean; group?: Group; onClose: () => void; onSaved?: (g: { id: string; name: string }) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (show) { setName(group?.name ?? ''); setError(null); }
  }, [show, group]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('El nombre es obligatorio.');
    setBusy(true);
    try {
      const saved = group
        ? await api.patch<{ id: string; name: string }>(`/groups/${group.id}`, { name })
        : await api.post<{ id: string; name: string }>('/groups', { name });
      await qc.invalidateQueries({ queryKey: keys.groups });
      toast.show(group ? `${saved.name} actualizado` : `Grupo ${saved.name} creado`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos guardar el grupo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{group ? 'Renombrar grupo' : 'Nuevo grupo'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-1">
          <label htmlFor="group-name" className="hz-label">Nombre del grupo</label>
          <input id="group-name" className={`hz-input ${error ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ágata" autoFocus aria-invalid={Boolean(error)} />
          {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
