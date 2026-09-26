import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { useGroupPlan, useGroups, useInvalidateDancerData } from '../../lib/queries';
import type { Design } from '../../lib/types';
import { useToast } from '../ui/Toast';

export function AssignGroupModal({ show, design, onClose }: { show: boolean; design: Design; onClose: () => void }) {
  const groups = useGroups();
  const invalidate = useInvalidateDancerData();
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ groupId: string; groupName: string; created: number } | null>(null);
  const navigate = useNavigate();
  const plan = useGroupPlan(done?.groupId ?? '', true);

  useEffect(() => { if (show) { setGroupId(''); setError(null); setDone(null); } }, [show]);
  const group = groups.data?.find((g) => g.id === groupId);

  async function assign() {
    if (!groupId) return setError('Elegí un grupo.');
    setBusy(true);
    try {
      const res = await api.post<{ created: number; existing: number }>(`/groups/${groupId}/design-assignment`, { designId: design.id });
      invalidate();
      toast.show(res.created ? `${design.name} asignado a ${group?.name}: ${res.created} prendas nuevas` : `${group?.name} ya tenía ${design.name}`);
      setDone({ groupId, groupName: group?.name ?? '', created: res.created });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos asignar el diseño.'); }
    finally { setBusy(false); }
  }

  if (done) {
    const missing = plan.data?.dancers.reduce((n, d) => n + d.missing, 0) ?? 0;
    const dancers = plan.data?.dancers.length ?? 0;
    return (
      <Modal show={show} onHide={onClose} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">Asignado a {done.groupName}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-2">
          <p className="mb-1">{done.created ? `${design.name} sumó ${done.created} prendas nuevas.` : `${done.groupName} ya tenía ${design.name}.`}</p>
          {plan.isLoading && <span className="small text-secondary" role="status">Calculando las medidas…</span>}
          {plan.data && (missing > 0
            ? <div className="hz-notice warning"><i className="bi bi-rulers" />Faltan {missing} {missing === 1 ? 'medida' : 'medidas'} en {dancers} {dancers === 1 ? 'bailarina' : 'bailarinas'} para poder calcular las hojas de molde.</div>
            : <div className="hz-notice ok"><i className="bi bi-check-circle" />Todas las bailarinas tienen las medidas que piden sus prendas.</div>)}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Después</button>
          {missing > 0 && <button type="button" className="hz-btn primary" onClick={() => { onClose(); navigate(`/groups/${done.groupId}/medir`); }}><i className="bi bi-rulers" />Tomar medidas del grupo</button>}
        </Modal.Footer>
      </Modal>
    );
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
