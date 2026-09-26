import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { parseDecimal } from '../../lib/format';
import { useCatalog, useInvalidateDesigns, useMeasureDefs, useMolds } from '../../lib/queries';
import type { CatalogOption, Design } from '../../lib/types';
import { LinkMoldModal } from '../molds/LinkMoldModal';
import { NoPatternBadge } from '../ui/NoPatternBadge';
import { PlaceholderGarmentModal, type CustomGarment } from './PlaceholderGarmentModal';

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
  const [specialQuery, setSpecialQuery] = useState('');
  const [customs, setCustoms] = useState<CustomGarment[]>([]);
  const [editingCustom, setEditingCustom] = useState<{ index: number | null; garment: CustomGarment | null } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [linking, setLinking] = useState<CustomGarment | null>(null);
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
    const real = (design?.garments ?? []).filter((g) => g.hasPattern !== false);
    setGarments(Object.fromEntries(real.map((g) => [g.moldTypeId, g.laborCost === null ? '' : String(g.laborCost).replace('.', ',')])));
    setCustoms((design?.garments ?? []).filter((g) => g.hasPattern === false).map((g) => ({
      moldTypeId: g.moldTypeId, name: g.moldName, category: (g.category ?? 'otro') as CustomGarment['category'], sizePriority: g.sizePriority ?? 'pecho',
      measureIds: (g.requiredMeasures ?? []).map((m) => m.definitionId), labor: g.laborCost === null ? '' : String(g.laborCost).replace('.', ','), assignedCount: g.assignedCount ?? 0,
    })));
    setEditingCustom(null);
    setRemoving(null);
    setSpecials(new Set((design?.specialMeasures ?? []).map((s) => s.definitionId)));
    setSpecialQuery('');
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
    const customLabor: (number | null)[] = customs.map((g, i) => {
      if (g.labor.trim() === '') return null;
      const n = parseDecimal(g.labor);
      if (n === null) (next.labor ??= {})[`custom-${i}`] = 'Ingresá un monto, por ejemplo 15000.';
      return n;
    });
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
        garments: [
          ...Object.entries(laborByMold).map(([moldTypeId, laborCost]) => ({ moldTypeId, laborCost })),
          ...customs.map((g, i) => ({
            ...(g.moldTypeId ? { moldTypeId: g.moldTypeId } : {}), laborCost: customLabor[i] ?? null,
            custom: { name: g.name, category: g.category, sizePriority: g.sizePriority, measureIds: g.measureIds },
          })),
        ],
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
  const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const needle = fold(specialQuery.trim());
  // Las ya elegidas siguen visibles aunque no coincidan con la búsqueda.
  const matches = (d: { name: string }) => !needle || fold(d.name).includes(needle);
  const visibleDefs = bodyDefs.filter((d) => specials.has(d.id) || matches(d));
  const noMatches = needle !== '' && !bodyDefs.some(matches);

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
            {(molds.data ?? []).filter((m) => m.hasPattern !== false).map((m) => {
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

            {customs.map((g, i) => (
              <div key={g.moldTypeId ?? `new-${i}`} className="hz-garment-row" data-testid="custom-garment">
                <div className="d-flex flex-wrap align-items-center gap-2 justify-content-between">
                  <span className="d-flex flex-column">
                    <span className="d-flex align-items-center gap-2 fw-semibold">{g.name}<NoPatternBadge /></span>
                    <span className="small text-secondary">Talle según {g.sizePriority === 'both' ? 'pecho y cadera' : g.sizePriority} · {g.measureIds.length} {g.measureIds.length === 1 ? 'medida' : 'medidas'}</span>
                  </span>
                  <span className="d-flex flex-column">
                    <input aria-label={`Mano de obra de ${g.name}`} inputMode="decimal" className={`hz-input ${errors.labor?.[`custom-${i}`] ? 'is-invalid' : ''}`} style={{ width: 170, height: 40 }} placeholder="Mano de obra ($)" value={g.labor}
                      onChange={(e) => setCustoms((c) => c.map((x, j) => (j === i ? { ...x, labor: e.target.value } : x)))} />
                    {errors.labor?.[`custom-${i}`] && <span className="hz-field-error">{errors.labor[`custom-${i}`]}</span>}
                  </span>
                </div>
                {removing === i ? (
                  <div className="hz-notice warning" role="alert" style={{ flexDirection: 'column' }}>
                    <strong>¿Quitar {g.name} del diseño?</strong>
                    <span>Se pierden {g.assignedCount} {g.assignedCount === 1 ? 'asignación' : 'asignaciones'}, con sus talles manuales y la mano de obra cargada. Las medidas de las bailarinas no se tocan.</span>
                    <span className="d-flex gap-2"><button type="button" className="hz-btn danger" onClick={() => { setCustoms((c) => c.filter((_, j) => j !== i)); setRemoving(null); }}>Quitar prenda</button><button type="button" className="hz-btn" onClick={() => setRemoving(null)}>Cancelar</button></span>
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="hz-btn" onClick={() => setEditingCustom({ index: i, garment: g })}><i className="bi bi-pencil" />Editar</button>
                    {g.moldTypeId && <Link className="hz-btn" to={`/formulas?mold=${g.moldTypeId}`}><i className="bi bi-magic" />Crear molde</Link>}
                    {g.moldTypeId && <button type="button" className="hz-btn" onClick={() => setLinking(g)}><i className="bi bi-link-45deg" />Vincular a molde</button>}
                    <button type="button" className="hz-btn" onClick={() => ((g.assignedCount ?? 0) > 0 ? setRemoving(i) : setCustoms((c) => c.filter((_, j) => j !== i)))}><i className="bi bi-trash3" />Quitar</button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="hz-btn dashed align-self-start" onClick={() => setEditingCustom({ index: null, garment: null })}><i className="bi bi-plus-lg" />Prenda sin molde</button>
          </fieldset>

          <fieldset className="d-flex flex-column gap-2">
            <legend className="hz-label mb-1">Medidas especiales{specials.size > 0 && <span className="text-secondary fw-normal"> · {specials.size} {specials.size === 1 ? 'elegida' : 'elegidas'}</span>}</legend>
            <label className="hz-search">
              <i className="bi bi-search" />
              <input type="search" placeholder="Buscar medida" aria-label="Buscar medida especial" value={specialQuery} onChange={(e) => setSpecialQuery(e.target.value)} />
            </label>
            <div className="d-flex flex-wrap gap-2">
              {visibleDefs.map((d) => (
                <button key={d.id} type="button" className={`hz-pill ${specials.has(d.id) ? 'active' : ''}`} aria-pressed={specials.has(d.id)} onClick={() => toggleSpecial(d.id)}>{d.name}</button>
              ))}
              {noMatches && <span className="small text-secondary">Ninguna medida coincide con “{specialQuery.trim()}”.</span>}
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
      <PlaceholderGarmentModal
        show={editingCustom !== null} initial={editingCustom?.garment ?? null} defs={bodyDefs}
        takenNames={[...(molds.data ?? []).filter((m) => m.id in garments).map((m) => m.name), ...customs.filter((_, i) => i !== editingCustom?.index).map((c) => c.name)]}
        onClose={() => setEditingCustom(null)}
        onSave={(g) => setCustoms((c) => (editingCustom?.index === null || editingCustom === null ? [...c, g] : c.map((x, i) => (i === editingCustom.index ? { ...g, labor: x.labor } : x))))}
      />
      {linking?.moldTypeId && (molds.data ?? []).find((m) => m.id === linking.moldTypeId) && (
        <LinkMoldModal show mold={(molds.data ?? []).find((m) => m.id === linking.moldTypeId)!} onClose={() => setLinking(null)} onLinked={() => { setLinking(null); invalidate(design?.id); onClose(); }} />
      )}
    </Modal>
  );
}
