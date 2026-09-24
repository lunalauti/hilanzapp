import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { ERROR_TEXT, OPS, formulaText, refLabel, sameFormula, slugKey } from '../../lib/formulas';
import { formatCm, parseDecimal } from '../../lib/format';
import { keys, useGroupDancers, useGroups, useMolds } from '../../lib/queries';
import type { Calculation, Mold, MoldFormula, Op } from '../../lib/types';
import { useDebounced } from '../../lib/useDebounced';
import { MoldMetaModal } from './MoldMetaModal';
import { InputsPanel } from './InputsPanel';

type Draft = MoldFormula;
interface ApiFormulaError { errors?: { formulaKey: string; reason: string; detail?: string }[]; extra?: string[] }

export function FormulaEditor() {
  const molds = useMolds();
  const [params, setParams] = useSearchParams();
  const moldId = params.get('mold') ?? molds.data?.[0]?.id ?? '';
  const mold = molds.data?.find((m) => m.id === moldId);

  if (molds.isLoading) return <Loading />;
  if (molds.error) return <ErrorState error={molds.error} onRetry={() => void molds.refetch()} />;
  if (!molds.data?.length) return <EmptyState icon="bi-calculator" title="No hay moldes todavía" note="Se cargan la primera vez que entrás a la app." />;

  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Fórmulas" subtitle="Cambiá cómo se calcula cada pieza sin tocar nada más." />
      <div className="hz-card hz-panel mb-4">
        <label htmlFor="mold-select" className="hz-label">Molde</label>
        <select id="mold-select" className="hz-input" value={moldId} onChange={(e) => setParams({ mold: e.target.value })}>
          {molds.data.map((m) => <option key={m.id} value={m.id}>{m.name}{m.templateKey ? '' : ' (propio)'}</option>)}
        </select>
      </div>
      {mold && <Editor key={mold.id} mold={mold} onCreated={(id) => setParams({ mold: id })} />}
    </>
  );
}

function Editor({ mold, onCreated }: { mold: Mold; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const groups = useGroups();
  const [groupId, setGroupId] = useState('');
  const dancers = useGroupDancers(groupId || groups.data?.[0]?.id || '');

  const saved = mold.formulas;
  const [draft, setDraft] = useState<Draft[]>(() => saved.map(({ original: _o, ...f }) => f));
  const [inputs, setInputs] = useState(mold.inputs);
  const [selected, setSelected] = useState(saved[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [meta, setMeta] = useState<'rename' | 'duplicate' | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setDraft(saved.map(({ original: _o, ...f }) => f)); setInputs(mold.inputs); }, [mold]);

  const current = draft.find((f) => f.key === selected) ?? draft[0];
  const savedByKey = useMemo(() => new Map(saved.map((f) => [f.key, f])), [saved]);
  const dirty = draft.length !== saved.length || draft.some((f) => { const s = savedByKey.get(f.key); return !s || !sameFormula(f, s); }) || JSON.stringify(inputs) !== JSON.stringify(mold.inputs);
  const modified = (f: Draft) => { const o = savedByKey.get(f.key)?.original; return o ? !sameFormula(f, o) : false; };

  const update = (patch: Partial<Draft>) => current && setDraft((d) => d.map((f) => (f.key === current.key ? { ...f, ...patch } : f)));

  const refs = [
    ...inputs.filter((i) => i.source !== 'choice').map((i) => ({ key: i.key, label: i.label })),
    ...draft.filter((f) => f.key !== current?.key).map((f) => ({ key: f.key, label: f.label })),
  ];

  const debounced = useDebounced(draft, 350);
  const debouncedInputs = useDebounced(inputs, 350);
  const previewDancers = (dancers.data ?? []).slice(0, 8);
  const previews = useQueries({
    queries: previewDancers.map((d) => ({
      queryKey: ['mold-preview', mold.id, d.id, JSON.stringify(debounced), JSON.stringify(debouncedInputs)],
      queryFn: () => api.post<Calculation>('/mold-preview', { dancerId: d.id, moldTypeId: mold.id, definition: { inputs: debouncedInputs, formulas: debounced } }),
      retry: false, staleTime: 30_000,
    })),
  });

  async function save() {
    setBusy(true);
    setIssues([]);
    try {
      await api.put(`/mold-types/${mold.id}/formulas`, { inputs, formulas: draft });
      await qc.invalidateQueries({ queryKey: keys.molds });
      toast.show('Fórmulas guardadas');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'FORMULA_INVALID') {
        const d = e.details as ApiFormulaError;
        setIssues([...(d.errors ?? []).map((x) => `${draft.find((f) => f.key === x.formulaKey)?.label ?? x.formulaKey}: ${ERROR_TEXT[x.reason] ?? x.reason}${x.detail ? ` (${x.detail})` : ''}`), ...(d.extra ?? [])]);
      } else setIssues([e instanceof ApiError ? e.message : 'No pudimos guardar las fórmulas.']);
    } finally { setBusy(false); }
  }

  async function restoreMold() {
    setBusy(true);
    try {
      await api.post(`/mold-types/${mold.id}/restore-defaults`);
      await qc.invalidateQueries({ queryKey: keys.molds });
      toast.show('Molde restaurado a su versión original');
    } catch (e) { setIssues([e instanceof ApiError ? e.message : 'No pudimos restaurar el molde.']); }
    finally { setBusy(false); setRestoring(false); }
  }

  async function removeMold() {
    setBusy(true);
    try {
      await api.delete(`/mold-types/${mold.id}?confirm=true`);
      await qc.invalidateQueries({ queryKey: keys.molds });
      toast.show('Molde eliminado');
      const other = (qc.getQueryData<Mold[]>(keys.molds) ?? []).find((m) => m.id !== mold.id);
      if (other) onCreated(other.id);
    } catch (e) { setIssues([e instanceof ApiError ? e.message : 'No pudimos eliminar el molde.']); }
    finally { setBusy(false); setDeleting(false); }
  }

  function addFormula() {
    const label = 'Nueva fórmula';
    const key = slugKey(label, new Set([...inputs.map((i) => i.key), ...draft.map((f) => f.key)]));
    const first = inputs.find((i) => i.source !== 'choice')?.key ?? '';
    setDraft((d) => [...d, { key, label, operandA: first, op: 'direct' }]);
    setSelected(key);
  }

  const removeFormula = () => { if (current) { setDraft((d) => d.filter((f) => f.key !== current.key)); setSelected(''); } };
  const original = current ? savedByKey.get(current.key)?.original : null;
  const operandIsRef = current?.operandB !== undefined && current.operandB !== '' && !/^\d+([.,]\d+)?$/.test(current.operandB) && !/^\d+\/\d+$/.test(current.operandB);
  const step = (field: 'operandB' | 'adjustmentCm', delta: number) => {
    if (!current) return;
    if (field === 'adjustmentCm') update({ adjustmentCm: Math.round(((current.adjustmentCm ?? 0) + delta) * 100) / 100 });
    else update({ operandB: String(Math.max(0, Math.round(((parseDecimal(current.operandB ?? '0') ?? 0) + delta) * 100) / 100)).replace('.', ',') });
  };

  return (
    <div className="row g-4">
      <aside className="col-12 col-lg-4" aria-label="Fórmulas del molde">
        <div className="hz-card hz-panel">
          <div className="d-flex flex-column"><span className="hz-panel-title">Fórmulas</span><span className="small text-secondary">Molde · {mold.name}</span></div>
          <div className="hz-formula-list">
            {draft.map((f) => (
              <button key={f.key} type="button" className={`hz-formula-item ${f.key === current?.key ? 'active' : ''}`} aria-pressed={f.key === current?.key} onClick={() => setSelected(f.key)}>
                <span className="name">{f.label}{modified(f) && <i className="bi bi-circle-fill" title="Modificada respecto a la original" aria-label="modificada" />}</span>
                <span className="text">{formulaText(f, inputs, draft)}</span>
              </button>
            ))}
          </div>
          <span className="small text-secondary"><i className="bi bi-circle-fill" style={{ fontSize: 8, color: 'var(--hz-primary)' }} /> modificada respecto a la original</span>
          <button type="button" className="hz-btn dashed" onClick={addFormula}><i className="bi bi-plus-lg" />Agregar fórmula</button>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="hz-btn" onClick={() => setMeta('duplicate')}><i className="bi bi-copy" />Duplicar molde</button>
            <button type="button" className="hz-btn" onClick={() => setMeta('rename')}><i className="bi bi-pencil" />Renombrar</button>
            {mold.templateKey
              ? <button type="button" className="hz-btn" onClick={() => setRestoring(true)}><i className="bi bi-arrow-counterclockwise" />Restaurar molde</button>
              : <button type="button" className="hz-btn" onClick={() => setDeleting(true)}><i className="bi bi-trash3" />Eliminar molde</button>}
          </div>
        </div>
      </aside>

      <main className="col-12 col-lg-8 d-flex flex-column gap-4">
        {current ? (
          <section className="hz-card hz-panel" aria-label="Editor de la fórmula">
            <div className="d-flex flex-column gap-1">
              <label htmlFor="f-label" className="hz-label">Nombre de la pieza</label>
              <input id="f-label" className="hz-input" value={current.label} onChange={(e) => update({ label: e.target.value })} />
            </div>
            <div className="hz-formula-summary" aria-live="polite">{formulaText(current, inputs, draft)}</div>

            <div className="d-flex flex-column gap-2">
              <span className="hz-label">1 · Medida</span>
              <div className="hz-seg">{refs.map((r) => <button key={r.key} type="button" className={`hz-seg-btn ${current.operandA === r.key ? 'active' : ''}`} aria-pressed={current.operandA === r.key} onClick={() => update({ operandA: r.key })}>{r.label}</button>)}</div>
            </div>
            <div className="d-flex flex-column gap-2">
              <span className="hz-label">2 · Operación</span>
              <div className="hz-segmented" role="group" aria-label="Operación">
                {OPS.map((o) => <button key={o.op} type="button" title={o.label} aria-label={o.label} className={`hz-seg-btn ${current.op === o.op ? 'active' : ''}`} aria-pressed={current.op === o.op} onClick={() => update({ op: o.op as Op, operandB: o.op === 'direct' ? undefined : (current.operandB ?? '1') })}>{o.symbol}</button>)}
              </div>
            </div>

            <div className="row g-3">
              {current.op !== 'direct' && (
                <div className="col-12 col-md-6 d-flex flex-column gap-2">
                  <span className="hz-label">3 · Operando</span>
                  <div className="hz-segmented" role="group" aria-label="Tipo de operando">
                    <button type="button" className={`hz-seg-btn ${!operandIsRef ? 'active' : ''}`} aria-pressed={!operandIsRef} onClick={() => update({ operandB: '4' })}>Número</button>
                    <button type="button" className={`hz-seg-btn ${operandIsRef ? 'active' : ''}`} aria-pressed={operandIsRef} onClick={() => update({ operandB: refs[0]?.key })}>Otra medida</button>
                  </div>
                  {operandIsRef ? (
                    <select className="hz-input" aria-label="Otra medida" value={current.operandB} onChange={(e) => update({ operandB: e.target.value })}>{[...inputs.map((i) => ({ key: i.key, label: i.label })), ...draft.filter((f) => f.key !== current.key).map((f) => ({ key: f.key, label: f.label }))].map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
                  ) : (
                    <div className="hz-stepper"><button type="button" aria-label="Restar 1 al operando" onClick={() => step('operandB', -1)}>−</button><input aria-label="Operando" inputMode="decimal" value={current.operandB ?? ''} onChange={(e) => update({ operandB: e.target.value })} /><button type="button" aria-label="Sumar 1 al operando" onClick={() => step('operandB', 1)}>+</button></div>
                  )}
                </div>
              )}
              <div className="col-12 col-md-6 d-flex flex-column gap-2">
                <span className="hz-label">{current.op === 'direct' ? '3' : '4'} · Ajuste (cm)</span>
                <div className="hz-stepper"><button type="button" aria-label="Restar 0,5 al ajuste" onClick={() => step('adjustmentCm', -0.5)}>−</button><input aria-label="Ajuste en cm" inputMode="decimal" value={formatCm(current.adjustmentCm ?? 0)} onChange={(e) => { const n = parseDecimal(e.target.value.replace('−', '-').replace(/^-/, '')); if (n !== null) update({ adjustmentCm: e.target.value.trim().startsWith('-') || e.target.value.includes('−') ? -n : n }); }} /><button type="button" aria-label="Sumar 0,5 al ajuste" onClick={() => step('adjustmentCm', 0.5)}>+</button></div>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2">
              {original
                ? <span className="small text-secondary">Original: {formulaText({ ...original, adjustmentCm: original.adjustmentCm ?? 0 }, inputs, draft)}{(original.adjustmentCm ?? 0) === 0 ? ' + 0 cm' : ''}</span>
                : <span className="small text-secondary">Fórmula propia, sin versión original.</span>}
              <div className="d-flex gap-2">
                {original && modified(current) && <button type="button" className="hz-btn" onClick={() => update({ ...original, adjustmentCm: original.adjustmentCm ?? 0 })}><i className="bi bi-arrow-counterclockwise" />Restaurar original</button>}
                <button type="button" className="hz-icon-btn danger" aria-label="Quitar fórmula" onClick={removeFormula}><i className="bi bi-trash3" /></button>
              </div>
            </div>
          </section>
        ) : <EmptyState icon="bi-calculator" title="Elegí una fórmula" note="O agregá una nueva desde la lista." />}

        <InputsPanel inputs={inputs} onChange={setInputs} />

        {issues.length > 0 && <div className="hz-notice danger" role="alert" style={{ flexDirection: 'column' }}><strong>No se pudo guardar</strong>{issues.map((i) => <span key={i}>{i}</span>)}</div>}
        <div className="d-flex justify-content-end gap-2 align-items-center">
          {!dirty && <span className="small" style={{ color: 'var(--hz-success)' }}><i className="bi bi-check-circle" /> Todo guardado</span>}
          <button type="button" className="hz-btn primary" disabled={!dirty || busy || draft.length === 0} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>

        <section className="hz-card hz-panel" aria-label="Vista previa en vivo">
          <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
            <h2 className="hz-panel-title">Vista previa</h2>
            <select className="hz-input" style={{ width: 200, height: 40 }} aria-label="Grupo para la vista previa" value={groupId || groups.data?.[0]?.id || ''} onChange={(e) => setGroupId(e.target.value)}>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name} · en vivo</option>)}
            </select>
          </div>
          {previewDancers.length === 0 && <span className="text-secondary">Elegí un grupo con bailarinas para ver el resultado.</span>}
          {previewDancers.map((d, i) => {
            const q = previews[i]!;
            const row = q.data?.rows.find((r) => r.key === current?.key);
            return (
              <div key={d.id} className="hz-preview-row">
                <span>{d.name}</span>
                {q.isLoading ? <span className="text-secondary">…</span>
                  : row ? <><span className="hz-real hz-req">{row.realLabel ?? ''}<strong>{row.realValue === null ? '—' : formatCm(row.realValue)}</strong></span><i className="bi bi-arrow-right" /><span className="hz-calc hz-req"><strong>{row.display}</strong> cm</span></>
                    : <span className="small text-secondary">{previewMessage(q.error)}</span>}
              </div>
            );
          })}
        </section>
      </main>

      <MoldMetaModal show={meta !== null} mode={meta ?? 'rename'} mold={mold} draft={draft} inputs={inputs} onClose={() => setMeta(null)} onDone={(id) => { setMeta(null); if (id) onCreated(id); }} />
      <ConfirmDialog show={restoring} title="Restaurar el molde" confirmLabel="Restaurar" busy={busy} onCancel={() => setRestoring(false)} onConfirm={() => void restoreMold()} body={<p className="mb-0">Todas las fórmulas de <strong>{mold.name}</strong> vuelven a su versión original. Las hojas ya guardadas no cambian.</p>} />
      <ConfirmDialog show={deleting} title="Eliminar el molde" confirmLabel="Eliminar molde" busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => void removeMold()} body={<p className="mb-0">Se elimina <strong>{mold.name}</strong> con sus fórmulas, las prendas asignadas y las hojas guardadas de este molde. No se puede deshacer.</p>} />
    </div>
  );
}

function previewMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'MISSING_MEASUREMENTS') return 'Faltan medidas o datos de esta bailarina';
    if (error.code === 'FORMULA_INVALID') return 'Corregí la fórmula para ver el resultado';
    return error.message;
  }
  return 'Sin resultado';
}
export { refLabel };
