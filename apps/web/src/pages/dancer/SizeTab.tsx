import { useState } from 'react';
import { SizeChip } from '../../components/ui/SizeChip';
import { ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useAssignments, useInvalidateDancerData, useMolds, useSizing } from '../../lib/queries';

const MEASURE_NAMES: Record<string, string> = { pecho: 'Pecho', cintura: 'Cintura', cadera: 'Cadera' };

export function SizeTab({ dancerId }: { dancerId: string }) {
  const sizing = useSizing(dancerId);
  const assignments = useAssignments(dancerId);
  const molds = useMolds();
  const invalidate = useInvalidateDancerData();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [newMold, setNewMold] = useState('');

  if (sizing.isLoading || assignments.isLoading) return <Loading />;
  if (sizing.error) return <ErrorState error={sizing.error} onRetry={() => void sizing.refetch()} />;
  const s = sizing.data!;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    try { await fn(); invalidate(dancerId); toast.show(ok); } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos guardar el talle.'); }
  }

  const setGeneral = (label: string | null) => run(() => api.put(`/dancers/${dancerId}/size`, { manualSizeLabel: label }), label ? `Talle T${label} asignado a mano` : 'Se usa el talle sugerido');
  const setGarment = (id: string, label: string | null) => run(() => api.patch(`/assignments/${id}`, { manualSizeLabel: label }), label ? `Talle T${label} asignado a la prenda` : 'La prenda usa el talle general');
  const addGarment = () => run(async () => { await api.post('/assignments', { dancerId, moldTypeId: newMold }); setNewMold(''); }, 'Prenda agregada');
  const removeGarment = (id: string) => run(() => api.delete(`/assignments/${id}`), 'Prenda quitada');

  const used = new Set((assignments.data ?? []).map((a) => a.moldTypeId));
  const available = (molds.data ?? []).filter((m) => !used.has(m.id));

  return (
    <div className="d-flex flex-column gap-4">
      {error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}

      <section className="hz-card hz-panel" aria-labelledby="size-title">
        <h2 id="size-title" className="hz-panel-title">Talle</h2>
        {!s.table && <div className="hz-notice warning"><i className="bi bi-info-circle" />No hay una tabla de talles activa para esta edad. Cargá la edad de la bailarina o activá una tabla.</div>}
        {s.table && s.perMeasure.length === 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />Cargá pecho, cintura y cadera para sugerir un talle.</div>}

        {s.perMeasure.length > 0 && (
          <div className="hz-breakdown" aria-label="Talle que da cada medida">
            {s.perMeasure.map((m) => (
              <div key={m.measureKey} className="hz-breakdown-row">
                <span>{MEASURE_NAMES[m.measureKey] ?? m.measureKey}</span>
                <span className="hz-real" style={{ padding: '1px 8px', borderRadius: 6, fontWeight: 600 }}>{String(m.value).replace('.', ',')} cm</span>
                <i className="bi bi-arrow-right" style={{ color: 'var(--hz-ink-3)' }} />
                <span className="hz-sug" style={{ textAlign: 'center', borderRadius: 999, fontWeight: 600 }} title={m.outOfRange ? 'Fuera de la tabla' : undefined}>
                  T{m.sizeLabel}{m.outOfRange && <i className="bi bi-exclamation-triangle ms-1" style={{ fontSize: 11 }} />}
                </span>
              </div>
            ))}
          </div>
        )}

        {s.suggested && (
          <div className="hz-suggested hz-sug">
            <div className="d-flex flex-column align-items-center"><span className="big">T{s.suggested}</span><span className="tag">SUGERIDO</span></div>
            <span className="small">Se toma el talle de la medida principal de la prenda (pecho por defecto). Tabla: {s.table?.name}.</span>
          </div>
        )}
        {s.outOfRange && <div className="hz-notice warning"><i className="bi bi-exclamation-triangle" />La medida está fuera del rango de la tabla; se sugiere el talle extremo. Revisalo a mano.</div>}

        <div className="d-flex flex-column gap-2">
          <span className="hz-label">Talle a mano</span>
          <div className="hz-seg" role="group" aria-label="Talle general a mano">
            {s.availableSizes.map((l) => (
              <button key={l} type="button" className={`hz-seg-btn ${s.manual.dancer === l ? 'active' : ''}`} aria-pressed={s.manual.dancer === l} onClick={() => void setGeneral(l)}>T{l}</button>
            ))}
            {s.manual.dancer && <button type="button" className="hz-btn" onClick={() => void setGeneral(null)}>Usar sugerido</button>}
          </div>
          <span className="small text-secondary">{s.manual.dancer ? `Talle a mano: T${s.manual.dancer}. El sugerido (${s.suggested ? `T${s.suggested}` : 'sin datos'}) se conserva.` : 'Sin talle a mano: se usa el sugerido.'}</span>
        </div>
      </section>

      <section className="hz-card hz-panel" aria-labelledby="garments-title">
        <h2 id="garments-title" className="hz-panel-title">Talle por prenda</h2>
        {(assignments.data ?? []).length === 0 && <span className="text-secondary">Todavía no tiene prendas asignadas.</span>}
        {(assignments.data ?? []).map((a) => (
          <div key={a.id} className="d-flex flex-wrap align-items-center gap-2 justify-content-between py-2" style={{ borderTop: '1px solid var(--hz-line)' }}>
            <div className="d-flex flex-column">
              <strong style={{ fontWeight: 500, fontSize: 16 }}>{a.moldName}</strong>
              <span className="small text-secondary">{a.designName ?? 'Sin diseño'}{a.needsReview && ' · pecho y cadera dan talles distintos, revisalo'}</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <SizeChip label={a.effective.label} origin={a.effective.origin} />
              <select className="hz-input" style={{ width: 130, height: 44 }} aria-label={`Talle de ${a.moldName}`} value={a.manualSizeLabel ?? ''} onChange={(e) => void setGarment(a.id, e.target.value || null)}>
                <option value="">Automático</option>
                {s.availableSizes.map((l) => <option key={l} value={l}>T{l}</option>)}
              </select>
              <button type="button" className="hz-icon-btn danger" aria-label={`Quitar ${a.moldName}`} onClick={() => void removeGarment(a.id)}><i className="bi bi-trash3" /></button>
            </div>
          </div>
        ))}
        <div className="d-flex flex-wrap gap-2 pt-2">
          <select className="hz-input" style={{ flex: '1 1 200px' }} aria-label="Prenda a agregar" value={newMold} onChange={(e) => setNewMold(e.target.value)}>
            <option value="">Elegí una prenda…</option>
            {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button type="button" className="hz-btn dashed" disabled={!newMold} onClick={() => void addGarment()}><i className="bi bi-plus-lg" />Agregar prenda</button>
        </div>
      </section>
    </div>
  );
}
