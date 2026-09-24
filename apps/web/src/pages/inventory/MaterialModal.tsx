import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { parseDecimal } from '../../lib/format';
import { useInvalidateInventory } from '../../lib/queries';
import type { Material } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';

export function MaterialModal({ show, material, onClose }: { show: boolean; material?: Material; onClose: () => void }) {
  const invalidate = useInvalidateInventory();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', unit: 'm', unitCost: '', stockQty: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) { setF({ name: material?.name ?? '', description: material?.description ?? '', unit: material?.unit ?? 'm', unitCost: material ? String(material.unitCost).replace('.', ',') : '', stockQty: '' }); setErrors({}); }
  }, [show, material]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!f.name.trim()) next.name = 'El nombre es obligatorio.';
    if (!f.unit.trim()) next.unit = 'Indicá la unidad (m, kg, u…).';
    const cost = f.unitCost.trim() === '' ? 0 : parseDecimal(f.unitCost);
    if (cost === null) next.unitCost = 'Ingresá un monto, por ejemplo 1500 o 1500,50.';
    const stock = f.stockQty.trim() === '' ? 0 : parseDecimal(f.stockQty);
    if (stock === null) next.stockQty = 'Ingresá una cantidad, por ejemplo 12 o 12,5.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const body = { name: f.name, description: f.description.trim() || null, unit: f.unit.trim(), unitCost: cost };
      if (material) await api.patch(`/materials/${material.id}`, body);
      else await api.post('/materials', { ...body, stockQty: stock });
      invalidate();
      toast.show(material ? `${f.name.trim()} actualizado` : `${f.name.trim()} agregado`);
      onClose();
    } catch (err) { setErrors({ form: err instanceof ApiError ? err.message : 'No pudimos guardar el material.' }); }
    finally { setBusy(false); }
  }

  const field = (id: string, label: string, key: keyof typeof f, opts: { placeholder?: string; mode?: 'decimal' } = {}) => (
    <div className="d-flex flex-column gap-1">
      <label htmlFor={id} className="hz-label">{label}</label>
      <input id={id} className={`hz-input ${errors[key] ? 'is-invalid' : ''}`} inputMode={opts.mode} placeholder={opts.placeholder} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
      {errors[key] && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors[key]}</span>}
    </div>
  );

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{material ? 'Editar material' : 'Nuevo material'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {field('mat-name', 'Nombre', 'name', { placeholder: 'Lycra negra' })}
          {field('mat-desc', 'Detalle (opcional)', 'description', { placeholder: 'Ancho 1,5 m' })}
          <div className="row g-3">
            <div className="col-4">{field('mat-unit', 'Unidad', 'unit', { placeholder: 'm' })}</div>
            <div className="col-8">{field('mat-cost', 'Costo por unidad ($)', 'unitCost', { mode: 'decimal', placeholder: '1500' })}</div>
          </div>
          {!material && field('mat-stock', 'Stock inicial', 'stockQty', { mode: 'decimal', placeholder: '0' })}
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
