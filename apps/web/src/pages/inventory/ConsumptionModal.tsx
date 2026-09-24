import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatQty, parseDecimal } from '../../lib/format';
import { useConsumptionRules, useDesigns, useInvalidateInventory, useMaterials } from '../../lib/queries';
import { useToast } from '../../components/ui/Toast';

interface Row { size: string; qty: string }

export function ConsumptionModal({ show, initialDesignId, onClose }: { show: boolean; initialDesignId: string; onClose: () => void }) {
  const designs = useDesigns();
  const materials = useMaterials();
  const invalidate = useInvalidateInventory();
  const toast = useToast();
  const [designId, setDesignId] = useState('');
  const [garmentId, setGarmentId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ size: '', qty: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = useConsumptionRules(designId);

  useEffect(() => { if (show) { setDesignId(initialDesignId); setGarmentId(''); setMaterialId(''); setRows([{ size: '', qty: '' }]); setError(null); } }, [show, initialDesignId]);

  const design = designs.data?.find((d) => d.id === designId);
  useEffect(() => { if (design && !design.garments.some((g) => g.id === garmentId)) setGarmentId(design.garments[0]?.id ?? ''); }, [design, garmentId]);

  useEffect(() => {
    if (!garmentId || !materialId) return;
    const mine = (rules.data ?? []).filter((r) => r.designGarmentId === garmentId && r.materialId === materialId);
    setRows(mine.length ? mine.map((r) => ({ size: r.sizeLabel ?? '', qty: formatQty(r.quantity) })) : [{ size: '', qty: '' }]);
  }, [garmentId, materialId, rules.data]);

  async function save() {
    if (!garmentId || !materialId) return setError('Elegí el diseño, la prenda y el material.');
    const parsed: { sizeLabel: string | null; quantity: number }[] = [];
    for (const r of rows) {
      if (!r.size.trim() && !r.qty.trim()) continue;
      const q = parseDecimal(r.qty);
      if (q === null || q <= 0) return setError('Cada consumo necesita una cantidad mayor a cero, por ejemplo 1,2.');
      parsed.push({ sizeLabel: r.size.trim() || null, quantity: q });
    }
    const labels = parsed.map((p) => p.sizeLabel ?? '*');
    if (new Set(labels).size !== labels.length) return setError('Hay talles repetidos.');
    setBusy(true); setError(null);
    try {
      await api.put('/consumption-rules', { designGarmentId: garmentId, materialId, rules: parsed });
      invalidate();
      toast.show(parsed.length ? 'Consumo guardado' : 'Consumo quitado');
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos guardar el consumo.'); }
    finally { setBusy(false); }
  }

  const unit = materials.data?.find((m) => m.id === materialId)?.unit ?? '';
  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Consumo por prenda y talle</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <p className="mb-0 text-secondary">Cuánto material lleva <strong>una</strong> prenda. Dejá el talle vacío para todos los talles; un talle puntual pisa al general.</p>
        <div className="row g-3">
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="cs-design" className="hz-label">Diseño</label>
            <select id="cs-design" className="hz-input" value={designId} onChange={(e) => setDesignId(e.target.value)}>
              <option value="">Elegí un diseño…</option>
              {(designs.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="cs-garment" className="hz-label">Prenda</label>
            <select id="cs-garment" className="hz-input" value={garmentId} disabled={!design} onChange={(e) => setGarmentId(e.target.value)}>
              {(design?.garments ?? []).map((g) => <option key={g.id} value={g.id}>{g.moldName}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="cs-material" className="hz-label">Material</label>
            <select id="cs-material" className="hz-input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Elegí un material…</option>
              {(materials.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {design && design.garments.length === 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />Este diseño no tiene prendas: agregalas editando el diseño.</div>}
        {garmentId && materialId && (
          <div className="d-flex flex-column gap-2">
            {rows.map((r, i) => (
              <div key={i} className="d-flex flex-wrap gap-2 align-items-center">
                <input className="hz-input" style={{ width: 170 }} aria-label={`Talle de la fila ${i + 1}`} placeholder="Todos los talles" value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} />
                <input className="hz-input" style={{ width: 130 }} inputMode="decimal" aria-label={`Cantidad de la fila ${i + 1}`} placeholder="0,0" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                <span className="text-secondary">{unit} por prenda</span>
                <button type="button" className="hz-icon-btn danger" aria-label={`Quitar la fila ${i + 1}`} onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, n) => n !== i) : [{ size: '', qty: '' }]))}><i className="bi bi-trash3" /></button>
              </div>
            ))}
            <button type="button" className="hz-btn dashed align-self-start" onClick={() => setRows((x) => [...x, { size: '', qty: '' }])}><i className="bi bi-plus-lg" />Agregar talle</button>
          </div>
        )}
        {error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="hz-btn primary" disabled={busy || !garmentId || !materialId} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar consumo'}</button>
      </Modal.Footer>
    </Modal>
  );
}
