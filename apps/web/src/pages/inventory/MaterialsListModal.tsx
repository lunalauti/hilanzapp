import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { openPdf } from '../../lib/files';
import { formatQty, parseDecimal } from '../../lib/format';
import type { MaterialsList, MaterialsListGarment } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import { Loading } from '../../components/ui/States';

export function MaterialsListModal({ show, groupId, designId, onClose }: { show: boolean; groupId: string; designId: string; onClose: () => void }) {
  const [data, setData] = useState<MaterialsList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!show) return;
    setData(null);
    setError(null);
    api.get<MaterialsList>(`/groups/${groupId}/materials-list${designId ? `?design_id=${designId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No pudimos cargar la lista de materiales.'));
  }, [show, groupId, designId]);

  function patchGarment(i: number, patch: Partial<MaterialsListGarment>) {
    setData((d) => (d ? { ...d, garments: d.garments.map((g, n) => (n === i ? { ...g, ...patch } : g)) } : d));
  }
  function patchQty(gi: number, mi: number, field: 'perUnit' | 'total', text: string) {
    const q = parseDecimal(text);
    if (q === null) return;
    setData((d) => (d ? {
      ...d,
      garments: d.garments.map((g, n) => (n !== gi ? g : { ...g, materials: g.materials.map((m, k) => (k === mi ? { ...m, [field]: q } : m)) })),
    } : d));
  }

  async function download() {
    if (!data) return;
    setDownloading(true);
    try { openPdf(await api.postBlob('/groups/' + groupId + '/materials-list/pdf', { garments: data.garments }), 'lista-materiales.pdf'); onClose(); }
    catch { toast.show('No pudimos generar el PDF'); }
    finally { setDownloading(false); }
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Lista de materiales</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-4">
        {!data && !error && <Loading rows={3} />}
        {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
        {data && data.garments.length === 0 && <span className="text-secondary small">No hay prendas para esta producción.</span>}
        {data && data.garments.map((g, gi) => (
          <section key={g.moldName} className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between align-items-baseline">
              <strong>{g.moldName}</strong>
              <span className="small text-secondary">{g.dancerCount} {g.dancerCount === 1 ? 'bailarina' : 'bailarinas'}</span>
            </div>
            {g.materials.length === 0 ? (
              <span className="text-secondary small">Cargá el consumo de materiales para esta prenda.</span>
            ) : (
              <div className="d-flex flex-column gap-2">
                {g.materials.map((m, mi) => (
                  <div key={m.name} className="d-flex flex-wrap align-items-center gap-2">
                    <span className="flex-grow-1" style={{ minWidth: 160 }}>
                      {m.name}{m.description && <span className="text-secondary small"> ({m.description})</span>}
                      {m.approx && <span className="small text-secondary"> · estimado</span>}
                    </span>
                    <label className="d-flex align-items-center gap-1 small text-secondary">
                      c/u
                      <input className="hz-input" style={{ width: 80 }} defaultValue={formatQty(m.perUnit)} onBlur={(e) => patchQty(gi, mi, 'perUnit', e.target.value)} aria-label={`${m.name} de ${g.moldName}, cantidad por prenda`} />
                    </label>
                    <label className="d-flex align-items-center gap-1 small text-secondary">
                      Total
                      <input className="hz-input" style={{ width: 80 }} defaultValue={formatQty(m.total)} onBlur={(e) => patchQty(gi, mi, 'total', e.target.value)} aria-label={`${m.name} de ${g.moldName}, total`} />
                    </label>
                    <span className="small text-secondary">{m.unit}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="d-flex flex-column gap-1">
              <label className="hz-label" htmlFor={`conos-${gi}`}>Conos de hilo color</label>
              <input id={`conos-${gi}`} className="hz-input" value={g.notes.conos} onChange={(e) => patchGarment(gi, { notes: { ...g.notes, conos: e.target.value } })} />
            </div>
            <div className="d-flex flex-column gap-1">
              <label className="hz-label" htmlFor={`obs-${gi}`}>Observaciones</label>
              <input id={`obs-${gi}`} className="hz-input" value={g.notes.observations} onChange={(e) => patchGarment(gi, { notes: { ...g.notes, observations: e.target.value } })} />
            </div>
          </section>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="hz-btn primary" disabled={!data || downloading} onClick={() => void download()}>
          <i className="bi bi-file-earmark-pdf" />{downloading ? 'Generando…' : 'Descargar PDF'}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
