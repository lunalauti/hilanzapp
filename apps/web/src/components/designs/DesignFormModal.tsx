import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { parseDecimal } from '../../lib/format';
import { useCatalog, useInvalidateDesigns, useMeasureDefs, useMolds } from '../../lib/queries';
import type { CatalogOption, Design } from '../../lib/types';

const OTHER = '__other__';
type Cat = CatalogOption['category'];
const CATS: { key: Cat; field: 'necklineId' | 'sleeveId' | 'skirtId'; label: string; current: (d: Design) => string | undefined }[] = [
  { key: 'neckline', field: 'necklineId', label: 'Escote', current: (d) => d.neckline?.id },
  { key: 'sleeve', field: 'sleeveId', label: 'Manga', current: (d) => d.sleeve?.id },
  { key: 'skirt', field: 'skirtId', label: 'Falda', current: (d) => d.skirt?.id },
];

export function DesignFormModal({ show, design, onClose, onSaved }: { show: boolean; design?: Design; onClose: () => void; onSaved: (id: string) => void }) {
  const catalog = useCatalog();
  const molds = useMolds();
  const defs = useMeasureDefs();
  const invalidate = useInvalidateDesigns();

  const [name, setName] = useState('');
  const [choice, setChoice] = useState<Record<Cat, string>>({ neckline: '', sleeve: '', skirt: '' });
  const [other, setOther] = useState<Record<Cat, string>>({ neckline: '', sleeve: '', skirt: '' });
  const [hasRuffle, setHasRuffle] = useState(false);
  const [isAsymmetric, setIsAsymmetric] = useState(false);
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState('');
  const [garments, setGarments] = useState<Record<string, string>>({});
  const [specials, setSpecials] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ name?: string; other?: Partial<Record<Cat, string>>; labor?: Record<string, string>; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) return;
    setName(design?.name ?? '');
    setChoice({ neckline: design?.neckline?.id ?? '', sleeve: design?.sleeve?.id ?? '', skirt: design?.skirt?.id ?? '' });
    setOther({ neckline: '', sleeve: '', skirt: '' });
    setHasRuffle(design?.hasRuffle ?? false);
    setIsAsymmetric(design?.isAsymmetric ?? false);
    setNotes(design?.notes ?? '');
    setDetails(design?.constructionDetails ?? '');
    setGarments(Object.fromEntries((design?.garments ?? []).map((g) => [g.moldTypeId, g.laborCost === null ? '' : String(g.laborCost).replace('.', ',')])));
    setSpecials(new Set((design?.specialMeasures ?? []).map((s) => s.definitionId)));
    setErrors({});
  }, [show, design]);

  const toggleGarment = (id: string) => setGarments((g) => { const n = { ...g }; if (id in n) delete n[id]; else n[id] = ''; return n; });
  const toggleSpecial = (id: string) => setSpecials((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'El nombre del diseño es obligatorio.';
    for (const c of CATS) if (choice[c.key] === OTHER && !other[c.key].trim()) (next.other ??= {})[c.key] = `Escribí cuál es el ${c.label.toLowerCase()}.`;
    const laborByMold: Record<string, number | null> = {};
    for (const [moldId, raw] of Object.entries(garments)) {
      if (raw.trim() === '') { laborByMold[moldId] = null; continue; }
      const n = parseDecimal(raw);
      if (n === null) (next.labor ??= {})[moldId] = 'Ingresá un monto, por ejemplo 15000.'; else laborByMold[moldId] = n;
    }
    setErrors(next);
    if (next.name || next.other || next.labor) return;

    setBusy(true);
    try {
      const ids: Record<string, string | null> = {};
      for (const c of CATS) {
        if (choice[c.key] === OTHER) ids[c.field] = (await api.post<CatalogOption>('/catalog-options', { category: c.key, label: other[c.key] })).id;
        else ids[c.field] = choice[c.key] || null;
      }
      const body = {
        name, ...ids, hasRuffle, isAsymmetric, notes: notes.trim() || null, constructionDetails: details.trim() || null,
        garments: Object.entries(laborByMold).map(([moldTypeId, laborCost]) => ({ moldTypeId, laborCost })),
        specialMeasureIds: [...specials],
      };
      const saved = design ? await api.patch<Design>(`/designs/${design.id}`, body) : await api.post<Design>('/designs', body);
      invalidate(saved.id);
      onSaved(saved.id);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'No pudimos guardar el diseño.' });
    } finally {
      setBusy(false);
    }
  }

  const options = (cat: Cat) => (catalog.data ?? []).filter((c) => c.category === cat);
  const bodyDefs = (defs.data ?? []).filter((d) => d.kind === 'body');

  return (
    <Modal show={show} onHide={onClose} centered size="lg" scrollable>
      <form onSubmit={submit} noValidate className="d-flex flex-column" style={{ minHeight: 0 }}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h4">{design ? 'Editar diseño' : 'Nuevo diseño'}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-4">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="design-name" className="hz-label">Nombre del diseño</label>
            <input id="design-name" className={`hz-input ${errors.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vestido Aurora" autoFocus />
            {errors.name && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.name}</span>}
          </div>

          <div className="row g-3">
            {CATS.map((c) => (
              <div key={c.key} className="col-12 col-md-4 d-flex flex-column gap-1">
                <label htmlFor={`sel-${c.key}`} className="hz-label">{c.label}</label>
                <select id={`sel-${c.key}`} className="hz-input" value={choice[c.key]} onChange={(e) => setChoice({ ...choice, [c.key]: e.target.value })}>
                  <option value="">Sin definir</option>
                  {options(c.key).map((o) => <option key={o.id} value={o.id}>{o.label}{o.isCustom ? ' (propio)' : ''}</option>)}
                  <option value={OTHER}>Otro…</option>
                </select>
                {choice[c.key] === OTHER && (
                  <>
                    <input aria-label={`Otro ${c.label.toLowerCase()}`} className={`hz-input ${errors.other?.[c.key] ? 'is-invalid' : ''}`} placeholder="Escribí el valor" value={other[c.key]} onChange={(e) => setOther({ ...other, [c.key]: e.target.value })} />
                    {errors.other?.[c.key] && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.other[c.key]}</span>}
                    <span className="small text-secondary">Queda guardado para usarlo en otros diseños.</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-4">
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input mt-0" checked={hasRuffle} onChange={(e) => setHasRuffle(e.target.checked)} />Tiene volado</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input mt-0" checked={isAsymmetric} onChange={(e) => setIsAsymmetric(e.target.checked)} />Es asimétrico</label>
          </div>

          <div className="d-flex flex-column gap-1">
            <label htmlFor="design-notes" className="hz-label">Observaciones</label>
            <textarea id="design-notes" className="hz-input" style={{ height: 84, padding: 12 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hombro izquierdo descubierto" />
          </div>
          <div className="d-flex flex-column gap-1">
            <label htmlFor="design-details" className="hz-label">Detalles de confección</label>
            <textarea id="design-details" className="hz-input" style={{ height: 96, padding: 12 }} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={'Un detalle por línea:\nForro de lycra en corpiño\nCierre invisible en espalda, 35 cm'} />
          </div>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Prendas que lo componen</legend>
            {(molds.data ?? []).map((m) => {
              const on = m.id in garments;
              return (
                <div key={m.id} className="d-flex flex-wrap align-items-center gap-2 justify-content-between">
                  <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input mt-0" checked={on} onChange={() => toggleGarment(m.id)} />{m.name}</label>
                  {on && (
                    <span className="d-flex flex-column">
                      <input aria-label={`Mano de obra de ${m.name}`} inputMode="decimal" className={`hz-input ${errors.labor?.[m.id] ? 'is-invalid' : ''}`} style={{ width: 170, height: 40 }} placeholder="Mano de obra ($)" value={garments[m.id]} onChange={(e) => setGarments({ ...garments, [m.id]: e.target.value })} />
                      {errors.labor?.[m.id] && <span className="hz-field-error">{errors.labor[m.id]}</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Medidas especiales</legend>
            <div className="d-flex flex-wrap gap-2">
              {bodyDefs.map((d) => (
                <button key={d.id} type="button" className={`hz-pill ${specials.has(d.id) ? 'active' : ''}`} aria-pressed={specials.has(d.id)} onClick={() => toggleSpecial(d.id)}>{d.name}</button>
              ))}
            </div>
            <span className="small text-secondary">Se piden en la ficha de cada bailarina con este diseño.</span>
          </fieldset>

          {errors.form && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{errors.form}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar diseño'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
