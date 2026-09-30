import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatCm } from '../../lib/format';
import type { SizeAverage, SizeAverages } from '../../lib/types';
import { Loading } from '../ui/States';

/** Medidas para producir un talle: promedio real de las bailarinas del grupo, con respaldo en la tabla de talles. */
export function SizeAveragesModal({ show, onClose, groupId, moldTypeId, moldName, sizeLabel }: {
  show: boolean; onClose: () => void; groupId: string; moldTypeId: string; moldName: string; sizeLabel: string;
}) {
  const [size, setSize] = useState<SizeAverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    setSize(null);
    setError(null);
    api.get<SizeAverages>(`/groups/${groupId}/production/size-averages?mold_type_id=${moldTypeId}&sizes=${encodeURIComponent(sizeLabel)}`)
      .then((r) => setSize(r.sizes[0] ?? null))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar las medidas.'));
  }, [show, groupId, moldTypeId, sizeLabel]);

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">{moldName} · Talle {sizeLabel}</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        {!size && !error && <Loading rows={3} />}
        {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
        {size && (
          <>
            {size.tableName && <span className="small text-secondary">Tabla de referencia: {size.tableName}</span>}
            {size.measures.length === 0 && <span className="text-secondary small">Este molde no pide medidas del cuerpo.</span>}
            <div className="d-flex flex-column gap-2">
              {size.measures.map((m) => (
                <div key={m.key} className="d-flex justify-content-between align-items-baseline gap-3">
                  <span>
                    {m.name}
                    {m.source === 'table' && <i className="bi bi-table ms-2 text-secondary" title="Sin datos reales todavía: se usa la tabla de talles" />}
                  </span>
                  <span className="text-end">
                    <strong>{m.value === null ? '—' : `${formatCm(m.value)} cm`}</strong>
                    <div className="small text-secondary">{m.source === 'real' ? `promedio de ${m.dancerCount} ${m.dancerCount === 1 ? 'bailarina' : 'bailarinas'}` : 'de la tabla de talles'}</div>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="hz-btn primary" onClick={onClose}>Cerrar</button>
      </Modal.Footer>
    </Modal>
  );
}
