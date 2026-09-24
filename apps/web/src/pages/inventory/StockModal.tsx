import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatDate, formatQty, parseDecimal } from '../../lib/format';
import { useInvalidateInventory, useMovements } from '../../lib/queries';
import type { Material } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';

export function StockModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const invalidate = useInvalidateInventory();
  const toast = useToast();
  const movements = useMovements(material?.id ?? '');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setKind('in'); setQty(''); setNote(''); setError(null); }, [material]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = parseDecimal(qty);
    if (n === null || n === 0) return setError('Ingresá una cantidad mayor a cero, por ejemplo 12 o 12,5.');
    setBusy(true); setError(null);
    try {
      await api.post(`/materials/${material!.id}/stock`, { delta: kind === 'in' ? n : -n, note: note.trim() || null });
      invalidate();
      toast.show(`${kind === 'in' ? 'Ingreso' : 'Egreso'} de ${formatQty(n)} ${material!.unit} registrado`);
      setQty(''); setNote('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No pudimos registrar el movimiento.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal show={material !== null} onHide={onClose} centered>
      {material && (
        <form onSubmit={submit} noValidate>
          <Modal.Header closeButton><Modal.Title as="h2" className="h4">Stock de {material.name}</Modal.Title></Modal.Header>
          <Modal.Body className="d-flex flex-column gap-3">
            <p className="mb-0">Hay <strong>{formatQty(material.stockQty)} {material.unit}</strong> en stock.</p>
            <div className="hz-segmented" role="group" aria-label="Tipo de movimiento">
              <button type="button" className={`hz-seg-btn ${kind === 'in' ? 'active' : ''}`} aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Ingreso (compra)</button>
              <button type="button" className={`hz-seg-btn ${kind === 'out' ? 'active' : ''}`} aria-pressed={kind === 'out'} onClick={() => setKind('out')}>Egreso</button>
            </div>
            <div className="row g-2">
              <div className="col-5 d-flex flex-column gap-1">
                <label htmlFor="mv-qty" className="hz-label">Cantidad ({material.unit})</label>
                <input id="mv-qty" inputMode="decimal" className={`hz-input ${error ? 'is-invalid' : ''}`} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="col-7 d-flex flex-column gap-1">
                <label htmlFor="mv-note" className="hz-label">Nota (opcional)</label>
                <input id="mv-note" className="hz-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Compra en el centro" />
              </div>
            </div>
            {error && <span className="hz-field-error" role="alert"><i className="bi bi-exclamation-circle" />{error}</span>}
            <div>
              <span className="hz-label">Últimos movimientos</span>
              <div className="hz-versions mt-2">
                {(movements.data ?? []).length === 0 && <div className="hz-version text-secondary">Sin movimientos todavía.</div>}
                {(movements.data ?? []).slice(0, 8).map((m) => (
                  <div key={m.id} className="hz-version">
                    <span style={{ flex: 1 }}>{formatDate(m.createdAt)} · {m.reason === 'production' ? 'Producción' : 'Manual'}{m.note ? ` · ${m.note}` : ''}</span>
                    <span className="val" style={{ color: m.delta > 0 ? 'var(--hz-success)' : 'var(--hz-danger)' }}>{m.delta > 0 ? '+' : '−'}{formatQty(Math.abs(m.delta))}</span>
                  </div>
                ))}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
            <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar movimiento'}</button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
