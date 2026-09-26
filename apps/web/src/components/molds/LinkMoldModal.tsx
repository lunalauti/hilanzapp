import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useInvalidateDesigns, useMolds } from '../../lib/queries';
import type { LinkPreview, Mold } from '../../lib/types';

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vincular una prenda sin molde a un molde existente: muestra el impacto y pide confirmación. */
export function LinkMoldModal({ show, mold, onClose, onLinked }: { show: boolean; mold: Mold; onClose: () => void; onLinked: (target: { id: string; name: string }) => void }) {
  const molds = useMolds();
  const invalidateDesigns = useInvalidateDesigns();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Mold | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (show) { setQuery(''); setTarget(null); setSure(false); setError(null); } }, [show]);
  const preview = useQuery({
    queryKey: ['link-preview', mold.id, target?.id],
    queryFn: () => api.get<LinkPreview>(`/mold-types/${mold.id}/link-preview?target=${target!.id}`),
    enabled: show && target !== null, retry: false,
  });
  const options = useMemo(() => (molds.data ?? []).filter((m) => m.id !== mold.id && m.hasPattern !== false && (!query.trim() || fold(m.name).includes(fold(query.trim())))), [molds.data, mold.id, query]);

  async function link() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/mold-types/${mold.id}/link`, { targetMoldTypeId: target.id });
      invalidateDesigns();
      await qc.invalidateQueries({ queryKey: ['molds'] });
      onLinked({ id: target.id, name: target.name });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}. La prenda sigue como “Sin molde”; no se perdió nada.` : 'No se pudo vincular. La prenda sigue como “Sin molde”; no se perdió nada.');
    } finally { setBusy(false); }
  }

  const p = preview.data;
  return (
    <Modal show={show} onHide={onClose} centered scrollable>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Vincular “{mold.name}”</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <label className="hz-tm-search">
          <i className="bi bi-search" aria-hidden="true" />
          <input type="search" aria-label="Buscar molde" placeholder="Buscar molde" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="hz-link-list" role="radiogroup" aria-label="Moldes">
          {options.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={target?.id === m.id} className={`hz-link-opt ${target?.id === m.id ? 'on' : ''}`} onClick={() => { setTarget(m); setSure(false); }}>
              <span className="d-flex flex-column"><strong>{m.name}</strong><span className="small text-secondary">{m.formulas?.length ?? 0} {(m.formulas?.length ?? 0) === 1 ? 'pieza' : 'piezas'} · {m.category}</span></span>
              {target?.id === m.id && <i className="bi bi-check-circle-fill" />}
            </button>
          ))}
          {options.length === 0 && (
            <div className="hz-tm-none"><strong className="d-block text-body">No hay moldes parecidos</strong>Probá otra búsqueda o creá un molde nuevo.</div>
          )}
        </div>

        {target && (
          <section className="hz-link-impact" aria-label="Qué pasa si vinculás">
            <span className="hz-tm-kicker">Qué pasa si vinculás</span>
            {preview.isLoading && <span className="small text-secondary" role="status">Comparando medidas…</span>}
            {p && (
              <>
                <div className="d-flex gap-2"><i className="bi bi-rulers" aria-hidden="true" /><span>
                  {p.newMeasures.length === 0 ? 'No pide medidas nuevas.' : (
                    <><strong>Pide {p.newMeasures.length} {p.newMeasures.length === 1 ? 'medida' : 'medidas'} que {p.dancersMissing} {p.dancersMissing === 1 ? 'bailarina' : 'bailarinas'} todavía no {p.dancersMissing === 1 ? 'tiene' : 'tienen'}</strong>
                      <br /><span className="small text-secondary">{p.newMeasures.map((m) => m.name).join(', ')}{p.dancerNames.length ? ` · ${p.dancerNames.join(', ')}` : ''}</span></>
                  )}
                </span></div>
                <div className="d-flex gap-2"><i className="bi bi-check-circle" aria-hidden="true" /><span>Se conservan {p.assignments} {p.assignments === 1 ? 'asignación' : 'asignaciones'}, talles manuales, consumo y costos.</span></div>
                <div className="d-flex gap-2"><i className="bi bi-exclamation-triangle" aria-hidden="true" /><span>Es definitivo: la prenda pasa a usar las fórmulas de “{target.name}” y deja de ser “Sin molde”.</span></div>
                <label className="d-flex align-items-center gap-2"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />Entiendo que no se puede deshacer</label>
              </>
            )}
            {preview.error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{preview.error instanceof ApiError ? preview.error.message : 'No pudimos comparar las medidas.'}</div>}
          </section>
        )}
        {error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />No se pudo vincular. {error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="hz-btn primary" disabled={!target || !sure || !p || busy} onClick={() => void link()}>{busy ? 'Vinculando…' : 'Vincular'}</button>
      </Modal.Footer>
    </Modal>
  );
}
