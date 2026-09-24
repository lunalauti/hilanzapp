import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { SizeChip } from '../components/ui/SizeChip';
import { useToast } from '../components/ui/Toast';
import { ApiError } from '../lib/api';
import { api } from '../lib/apiClient';
import { formatCm, parseDecimal } from '../lib/format';
import { useCalculation, useDancer, useGroupDancers, useGroups, useMeasurements, useMolds, type CalcRequest } from '../lib/queries';
import type { CalcRow, MissingItem, Mold } from '../lib/types';

export function MoldSheet() {
  const [params, setParams] = useSearchParams();
  const dancerId = params.get('dancer') ?? '';
  const moldId = params.get('mold') ?? '';
  const dancer = useDancer(dancerId);
  const groups = useGroups();
  const molds = useMolds();
  const [pickedGroup, setPickedGroup] = useState('');
  const groupId = dancer.data?.group_id ?? pickedGroup;
  const groupDancers = useGroupDancers(groupId);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'dancer') next.delete('mold');
    setParams(next, { replace: true });
  };

  const mold = molds.data?.find((m) => m.id === moldId) ?? null;
  const group = groups.data?.find((g) => g.id === groupId);

  return (
    <>
      <PageHeader eyebrow={dancer.data ? `${dancer.data.name} · ${group?.name ?? ''}` : 'Taller'} title="Hoja de molde" />

      <section className="hz-card hz-panel mb-4 hz-no-print" aria-label="Qué molde calcular">
        <div className="row g-3">
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="pick-group" className="hz-label">Grupo</label>
            <select id="pick-group" className="hz-input" value={groupId} onChange={(e) => { setPickedGroup(e.target.value); set('dancer', ''); }}>
              <option value="">Elegí un grupo…</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="pick-dancer" className="hz-label">Bailarina</label>
            <select id="pick-dancer" className="hz-input" value={dancerId} disabled={!groupId} onChange={(e) => set('dancer', e.target.value)}>
              <option value="">Elegí una bailarina…</option>
              {(groupDancers.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="pick-mold" className="hz-label">Molde</label>
            <select id="pick-mold" className="hz-input" value={moldId} disabled={!dancerId} onChange={(e) => set('mold', e.target.value)}>
              <option value="">Elegí un molde…</option>
              {(molds.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {molds.error && <ErrorState error={molds.error} onRetry={() => void molds.refetch()} />}
      {!dancerId || !mold ? (
        <EmptyState icon="bi-scissors" title="Elegí una bailarina y un molde" note="Vas a ver sus medidas reales y todos los resultados calculados, sin hacer cuentas a mano." />
      ) : (
        <Sheet key={`${dancerId}-${moldId}`} dancerId={dancerId} dancerName={dancer.data?.name ?? ''} mold={mold} />
      )}
    </>
  );
}

function Sheet({ dancerId, dancerName, mold }: { dancerId: string; dancerName: string; mold: Mold }) {
  const measures = useMeasurements(dancerId);
  const toast = useToast();
  const manualInputs = mold.inputs.filter((i) => i.source === 'manual');
  const choiceInputs = mold.inputs.filter((i) => i.source === 'choice');
  const measureInputs = mold.inputs.filter((i) => i.source === 'measure');

  const [manual, setManual] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries(choiceInputs.map((c) => [c.key, c.defaultOptionId ?? c.options?.[0]?.id ?? ''])));
  const [xl, setXl] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    const invalid: string[] = [];
    for (const i of manualInputs) {
      const raw = manual[i.key] ?? '';
      if (raw.trim() === '') continue;
      const n = parseDecimal(raw);
      if (n === null) invalid.push(i.key); else out[i.key] = n;
    }
    return { values: out, invalid };
  }, [manual, manualInputs]);

  const request: CalcRequest | null = parsed.invalid.length ? null : { dancerId, moldTypeId: mold.id, manualInputs: parsed.values, choices };
  const calc = useCalculation(request);
  const missing = calc.error instanceof ApiError && calc.error.code === 'MISSING_MEASUREMENTS' ? ((calc.error.details as { missing: MissingItem[] }).missing) : null;
  const missingStandard = calc.error instanceof ApiError && calc.error.code === 'MISSING_STANDARD';
  const missingBody = missing?.filter((m) => m.source === 'measure') ?? [];
  const missingManual = missing?.filter((m) => m.source === 'manual') ?? [];
  const currentByKey = new Map((measures.data ?? []).map((m) => [m.key, m]));
  const missingKeys = new Set(missingBody.map((m) => m.key));
  const result = calc.data && !calc.isError ? calc.data : null;
  const blocked = missingBody.length > 0;

  async function save() {
    if (!request) return;
    setSaving(true);
    try { await api.post('/pattern-sheets', request); toast.show('Hoja de molde guardada'); }
    catch { toast.show('No pudimos guardar la hoja'); }
    finally { setSaving(false); }
  }

  const sections = result ? groupBySection(result.rows) : [];

  return (
    <div className={`hz-sheet ${xl ? 'xl' : ''}`}>
      <div className="hz-sheet-print mb-3">
        <h2 className="h4 mb-1">{dancerName} · {mold.name}</h2>
        <div className="small text-secondary">Impreso {new Date().toLocaleDateString('es-AR')} · Medida real = borde continuo · Resultado = borde discontinuo</div>
      </div>

      {blocked && (
        <div className="hz-notice warning mb-4" role="alert" style={{ flexDirection: 'column' }}>
          <strong><i className="bi bi-lock-fill" /> No se puede calcular todavía</strong>
          <span>Faltan {missingBody.length} de las {measureInputs.length} medidas que pide este molde. Tocá una para cargarla en la ficha de {dancerName}.</span>
          <div className="d-flex flex-wrap gap-2">
            {missingBody.map((m) => (
              <Link key={m.key} to={`/dancers/${dancerId}?tab=medidas`} className="hz-req missing text-decoration-none">{m.label}<i className="bi bi-arrow-right ms-1" /></Link>
            ))}
          </div>
        </div>
      )}
      {missingStandard && <div className="hz-notice warning mb-4" role="alert"><i className="bi bi-exclamation-triangle" />La tabla de talles no tiene el valor estándar que necesita este molde. Completalo en Tablas de talles.</div>}
      {calc.error && !missing && !missingStandard && <ErrorState error={calc.error} />}

      <div className="row g-4 mb-4">
        <section className="col-12 col-lg-5 hz-no-print">
          <div className="hz-card hz-panel h-100">
            <div className="d-flex justify-content-between align-items-baseline">
              <h2 className="hz-panel-title">Medidas requeridas</h2>
              {!measures.isLoading && <span className="small" style={{ color: blocked ? 'var(--hz-warning)' : 'var(--hz-success)' }}>{measureInputs.length - missingKeys.size} de {measureInputs.length}</span>}
            </div>
            <div className="hz-reqs">
              {measureInputs.map((i) => {
                const item = currentByKey.get(i.measureKey ?? i.key);
                const isMissing = missingKeys.has(i.key) || (item && item.valueCm === null);
                return isMissing
                  ? <span key={i.key} className="hz-req missing"><i className="bi bi-exclamation-triangle" />{i.label}</span>
                  : <span key={i.key} className="hz-req hz-real">{i.label}<strong>{formatCm(item?.valueCm)}</strong></span>;
              })}
            </div>

            {manualInputs.length > 0 && (
              <div className="row g-3">
                {manualInputs.map((i) => {
                  const bad = parsed.invalid.includes(i.key);
                  const lacking = missingManual.some((m) => m.key === i.key);
                  return (
                    <div key={i.key} className="col-6 d-flex flex-column gap-1">
                      <label htmlFor={`in-${i.key}`} className="hz-label">{i.label}</label>
                      <div className={`hz-measure-box ${bad ? 'is-invalid' : 'hz-real'}`} style={lacking && !bad ? { background: 'var(--hz-surface-float)', border: '1px dashed var(--hz-line-strong)' } : undefined}>
                        <input id={`in-${i.key}`} inputMode="decimal" placeholder="—" value={manual[i.key] ?? ''} onChange={(e) => setManual({ ...manual, [i.key]: e.target.value })} aria-invalid={bad} />
                        <span className="unit">cm</span>
                      </div>
                      {bad && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />Ingresá un número.</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {choiceInputs.map((c) => (
              <div key={c.key} className="d-flex flex-column gap-2">
                <span className="hz-label">{c.label}</span>
                <div className="hz-segmented" role="group" aria-label={c.label}>
                  {c.options?.map((o) => (
                    <button key={o.id} type="button" className={`hz-seg-btn ${choices[c.key] === o.id ? 'active' : ''}`} aria-pressed={choices[c.key] === o.id} onClick={() => setChoices({ ...choices, [c.key]: o.id })}>{o.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="col-12 col-lg-7">
          <div className="hz-card" style={{ overflow: 'hidden' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3">
              <div className="d-flex align-items-center gap-2">
                <h2 className="hz-panel-title">{mold.name}</h2>
                {result && <SizeChip label={result.size.label} origin={result.size.origin} small />}
              </div>
              <span className="small text-secondary">Todos los valores en cm</span>
            </div>
            <div className="hz-sheet-head"><span>Pieza</span><span style={{ color: 'var(--hz-real)' }}><i className="bi bi-rulers" /> Medida real</span><span style={{ color: 'var(--hz-calc)' }}>Fórmula</span><span style={{ color: 'var(--hz-calc)' }}>= Resultado</span></div>
            {calc.isLoading && <div className="p-3"><Loading rows={3} /></div>}
            {!result && !calc.isLoading && !blocked && !missingStandard && <div className="p-4 text-secondary">Completá los datos de arriba para ver los resultados.</div>}
            {blocked && <div className="p-3 text-secondary small"><i className="bi bi-lock" /> Los resultados aparecen cuando estén todas las medidas.</div>}
            {sections.map((s) => (
              <div key={s.name ?? 'main'}>
                {s.name && <div className="px-3 py-2 hz-label" style={{ background: 'var(--hz-surface-base)' }}>{s.name}</div>}
                {s.rows.map((r) => (
                  <div key={r.key} className="hz-sheet-row">
                    <span className="piece">{r.label}</span>
                    <span className="cells">
                      {r.realValue !== null ? <span className="real hz-real"><span className="l">{r.realLabel}</span><span className="n">{formatCm(r.realValue)}</span></span> : <span className="text-secondary small">—</span>}
                      <span className="formula">{r.formula}</span>
                      <span className="result hz-calc"><span className="n">{r.display}</span><span className="small">cm</span></span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="d-flex flex-wrap gap-2 hz-no-print">
        <button type="button" className="hz-btn primary" disabled={!result || saving} onClick={() => void save()}><i className="bi bi-save" />{saving ? 'Guardando…' : 'Guardar hoja'}</button>
        <button type="button" className="hz-btn" disabled={!result} onClick={() => window.print()}><i className="bi bi-printer" />Imprimir A4</button>
        <button type="button" className="hz-btn" aria-pressed={xl} onClick={() => setXl(!xl)}><i className="bi bi-arrows-fullscreen" />Modo mesa de corte</button>
      </div>
    </div>
  );
}

function groupBySection(rows: CalcRow[]): { name: string | null; rows: CalcRow[] }[] {
  const out: { name: string | null; rows: CalcRow[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.name === r.section) last.rows.push(r); else out.push({ name: r.section, rows: [r] });
  }
  return out;
}
