import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { api } from '../lib/apiClient';
import { openPdf } from '../lib/files';
import { formatDate } from '../lib/format';
import { useMolds } from '../lib/queries';
import { Loading } from './ui/States';

interface LatestSheet { dancerId: string; dancerName: string; sheetId: string | null; sizeLabel: string | null; createdAt: string | null }

export function BatchPdfModal({ show, groupId, onClose }: { show: boolean; groupId: string; onClose: () => void }) {
  const molds = useMolds();
  const [moldId, setMoldId] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sheets = useQuery({
    queryKey: ['latest-sheets', groupId, moldId],
    queryFn: () => api.get<LatestSheet[]>(`/groups/${groupId}/pattern-sheets?mold_type_id=${moldId}`),
    enabled: show && Boolean(moldId),
  });

  useEffect(() => { if (show) { setMoldId(''); setPicked(new Set()); setError(null); } }, [show]);
  useEffect(() => { setPicked(new Set((sheets.data ?? []).filter((s) => s.sheetId).map((s) => s.sheetId!))); }, [sheets.data]);

  const available = (sheets.data ?? []).filter((s) => s.sheetId);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function exportBatch() {
    setBusy(true);
    setError(null);
    try {
      const order = available.filter((s) => picked.has(s.sheetId!)).map((s) => s.sheetId!);
      openPdf(await api.postBlob('/pattern-sheets/pdf', { sheetIds: order }), 'hojas-de-molde.pdf');
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos generar el PDF.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Hojas de molde en PDF</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <div className="d-flex flex-column gap-1">
          <label htmlFor="batch-mold" className="hz-label">Molde</label>
          <select id="batch-mold" className="hz-input" value={moldId} onChange={(e) => setMoldId(e.target.value)}>
            <option value="">Elegí un molde…</option>
            {(molds.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {sheets.isLoading && <Loading rows={2} />}
        {sheets.data && (
          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Bailarinas ({picked.size} de {available.length} con hoja guardada)</legend>
            {sheets.data.map((s) => (
              <label key={s.dancerId} className={`d-flex align-items-center gap-2 ${s.sheetId ? '' : 'text-secondary'}`}>
                <input type="checkbox" className="form-check-input mt-0" disabled={!s.sheetId} checked={s.sheetId ? picked.has(s.sheetId) : false} onChange={() => s.sheetId && toggle(s.sheetId)} />
                <span className="flex-fill">{s.dancerName}</span>
                <span className="small">{s.sheetId ? `T${s.sizeLabel ?? '—'} · ${formatDate(s.createdAt!)}` : 'sin hoja guardada'}</span>
              </label>
            ))}
            {available.length === 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />Ninguna bailarina tiene una hoja guardada de este molde. Abrí la hoja de molde de cada una y tocá “Guardar hoja”.</div>}
          </fieldset>
        )}
        {error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="hz-btn primary" disabled={busy || picked.size === 0} onClick={() => void exportBatch()}>{busy ? 'Generando…' : `Exportar ${picked.size || ''} ${picked.size === 1 ? 'hoja' : 'hojas'}`.replace('  ', ' ')}</button>
      </Modal.Footer>
    </Modal>
  );
}
