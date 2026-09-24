import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useGroups, useInvalidateDancerData } from '../../lib/queries';
import type { Design } from '../../lib/types';
import { useToast } from '../ui/Toast';

export function AssignGroupModal({ show, design, onClose }: { show: boolean; design: Design; onClose: () => void }) {
  const groups = useGroups();
  const invalidate = useInvalidateDancerData();
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (show) { setGroupId(''); setError(null); } }, [show]);
  const group = groups.data?.find((g) => g.id === groupId);

  async function assign() {
    if (!groupId) return setError('Elegí un grupo.');
    setBusy(true);
    try {
      const res = await api.post<{ created: number; existing: number }>(`/groups/${groupId}/design-assignment`, { designId: design.id });
      invalidate();
      toast.show(res.created ? `${design.name} asignado a ${group?.name}: ${res.created} prendas nuevas` : `${group?.name} ya tenía ${design.name}`);
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos asignar el diseño.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Asignar a un grupo</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-2">
        <p className="mb-1">Se agregan las prendas de <strong>{design.name}</strong> ({design.garments.map((g) => g.moldName).join(', ') || 'sin prendas'}) a todas las bailarinas del grupo.</p>
        <label htmlFor="assign-group" className="hz-label">Grupo</label>
        <select id="assign-group" className={`hz-input ${error ? 'is-invalid' : ''}`} value={groupId} onChange={(e) => { setGroupId(e.target.value); setError(null); }}>
          <option value="">Elegí un grupo…</option>
          {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name} · {g.dancerCount} bailarinas</option>)}
        </select>
        {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
        {design.garments.length === 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />Este diseño todavía no tiene prendas: editalo para agregarlas.</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="hz-btn primary" onClick={() => void assign()} disabled={busy || design.garments.length === 0}>{busy ? 'Asignando…' : 'Asignar'}</button>
      </Modal.Footer>
    </Modal>
  );
}
