import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/apiClient';
import { formatCm, formatShortDate, todayIso } from '../../lib/format';
import { useDancer, useInvalidateDancerData, useMeasureDefs, useMeasurePlan } from '../../lib/queries';
import {
  buildQueue, initialIndex, nextIndex, parseMeasure, stepStatus, toQueueItem, withExtras, type QueueItem,
} from '../../lib/takeMeasures';
import type { MeasureDef } from '../../lib/types';
import { CustomMeasureModal } from '../dancer/CustomMeasureModal';
import { AddMeasuresSheet } from './AddMeasuresSheet';

/** Datos del recorrido por grupo: se muestran entre una bailarina y la siguiente. */
export interface ChainInfo {
  position: number; total: number;
  next: { name: string; missing: number } | null;
  onNext: () => void; onSkipDancer: () => void; onFinish: () => void;
}

export interface TakeMeasuresProps {
  dancerId: string;
  /** Limita la toma a estas claves de medida (por ejemplo, las que faltan en una hoja de molde). */
  only?: string[];
  /** Empezar en esta medida (por ejemplo, al tocar una celda de faltantes). */
  startKey?: string;
  onExit: () => void;
  /** Acción de "Ver hoja de molde" en el resumen (si no hay, el botón no aparece). */
  onOpenSheet?: () => void;
  chain?: ChainInfo;
}

const isEnter = (e: { key: string }) => e.key === 'Enter';

export function TakeMeasures({ dancerId, only, startKey, onExit, onOpenSheet, chain }: TakeMeasuresProps) {
  const dancer = useDancer(dancerId);
  const plan = useMeasurePlan(dancerId);
  const defs = useMeasureDefs();
  const invalidate = useInvalidateDancerData();

  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLDivElement>(null);

  const helpByKey = useMemo(() => Object.fromEntries((defs.data ?? []).map((d) => [d.key, d.help ?? null])), [defs.data]);
  useEffect(() => {
    if (queue !== null || !plan.data || !defs.data) return;
    const q = buildQueue(plan.data.items, helpByKey, only);
    setQueue(q);
    const at = startKey ? q.findIndex((x) => x.key === startKey) : -1;
    setIndex(at >= 0 ? at : initialIndex(q));
    setSummary(false);
  }, [queue, plan.data, defs.data, helpByKey, only, startKey]);

  useEffect(() => { panel.current?.focus(); }, []);
  // La medida actual siempre queda a la vista en la fila de chips.
  useEffect(() => { chips.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }, [index, queue?.length]);
  useEffect(() => { if (!summary) input.current?.focus(); }, [index, summary, repeating, queue === null]);

  const goTo = useCallback((i: number) => {
    setIndex(i); setText(''); setTried(false); setSaveError(false); setRepeating(false); setSummary(false); setHelpOpen(false);
  }, []);

  const advance = useCallback((q: QueueItem[], from: number, skip: Set<string>) => {
    const n = nextIndex(q, from, skip);
    if (n < 0) setSummary(true); else goTo(n);
  }, [goTo]);

  const current = queue?.[index] ?? null;
  const loaded = current !== null && current.value !== null && !repeating;
  const parsed = parseMeasure(text);
  const error = tried && !parsed.ok ? parsed.error : '';

  async function save() {
    if (!current || !queue) return;
    if (!parsed.ok) { setTried(true); return; }
    setSaving(true);
    setSaveError(false);
    try {
      await api.put(`/dancers/${dancerId}/measurements/${current.definitionId}`, { valueCm: parsed.value });
      const next = queue.map((q, i) => (i === index ? { ...q, value: parsed.value, takenOn: todayIso() } : q));
      const skip = new Set(skipped);
      skip.delete(current.key);
      setQueue(next);
      setSkipped(skip);
      invalidate(dancerId);
      advance(next, index, skip);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function onNext() {
    if (saving || !queue) return;
    if (loaded) { advance(queue, index, skipped); return; }
    void save();
  }

  function onSkip() {
    if (!queue || !current) return;
    const skip = new Set(skipped).add(current.key);
    setSkipped(skip);
    advance(queue, index, skip);
  }

  function addFromDefs(chosen: MeasureDef[]) {
    if (!queue) return;
    const extras = chosen.map((d) => toQueueItem({
      definitionId: d.id, key: d.key, name: d.name, sort: d.sort ?? 500, isBase: d.isBase,
      requiredBy: [{ kind: 'garment', label: 'vos (extra)' }], value: null, takenOn: null,
    }, d.help ?? null, true));
    const next = withExtras(queue, extras);
    setQueue(next);
    setSheetOpen(false);
    if (summary) goTo(queue.length); // desde el resumen, seguir con lo agregado
    else if (queue[index]?.value !== null && !repeating) goTo(queue.length);
  }

  function onCustomSaved(name: string, info?: { definitionId: string; valueCm: number }) {
    if (!queue || !info) return;
    const key = `custom_${info.definitionId}`;
    const item: QueueItem = {
      definitionId: info.definitionId, key, name, short: name, help: null, requiredBy: ['vos (extra)'],
      value: info.valueCm, takenOn: todayIso(), extra: true,
    };
    setQueue(withExtras(queue, [item]));
    invalidate(dancerId);
    void defs.refetch();
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onExit(); }
  };

  const doneCount = queue?.filter((q) => q.value !== null).length ?? 0;
  const total = queue?.length ?? 0;
  const dancerName = dancer.data?.name ?? '';
  const requestedBy = useMemo(() => [...new Set((plan.data?.items ?? []).flatMap((i) => i.requiredBy.map((r) => r.label)))].join(' · '), [plan.data]);
  const failed = (plan.error || dancer.error || defs.error) as Error | null;
  const loading = !failed && queue === null;
  const inQueueKeys = useMemo(() => new Set((queue ?? []).map((q) => q.key)), [queue]);
  const bodyDefs = useMemo(() => (defs.data ?? []).filter((d) => d.kind === 'body'), [defs.data]);

  return (
    <div className="hz-tm" role="presentation" onKeyDown={onKeyDown}>
      <div className="hz-tm-backdrop" onClick={onExit} aria-hidden="true" />
      <div className="hz-tm-panel" role="dialog" aria-modal="true" aria-label="Tomar medidas" ref={panel} tabIndex={-1}>
        <header className="hz-tm-head">
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="hz-tm-iconbtn" aria-label="Cerrar toma de medidas" onClick={onExit}><i className="bi bi-x-lg" /></button>
            <div className="flex-grow-1 min-w-0 d-flex flex-column">
              <span className="who">{dancerName}</span>
              <span className="by">{chain ? `Toma del grupo · ${chain.position} de ${chain.total}` : requestedBy ? `Pedido por: ${requestedBy}` : 'Medidas base'}</span>
            </div>
            {queue && total > 0 && !summary && <span className="prog" aria-live="polite">{Math.min(index + 1, total)} de {total}</span>}
          </div>
          <div className="hz-tm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label="Medidas cargadas">
            <div style={{ width: total ? `${Math.round((doneCount / total) * 100)}%` : '0%' }} />
          </div>
        </header>

        {failed && (
          <div className="hz-tm-body"><div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />No se pudo cargar la ficha. Revisá la conexión.
            <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => { void plan.refetch(); void defs.refetch(); void dancer.refetch(); }}>Reintentar</button></div></div>
        )}

        {loading && (
          <div className="hz-tm-body" aria-live="polite">
            <div className="d-flex align-items-center gap-2"><span className="hz-spinner sm" aria-hidden="true" /><span className="hz-tm-loading">Tomando medidas…</span></div>
            <div className="hz-tm-skel" style={{ width: '40%', height: 14 }} /><div className="hz-tm-skel" style={{ width: '75%', height: 36 }} /><div className="hz-tm-skel" style={{ height: 88 }} />
          </div>
        )}

        {queue && total === 0 && !summary && (
          <>
            <div className="hz-tm-body">
              <div className="hz-tm-empty"><i className="bi bi-check2-circle" aria-hidden="true" /><h2>Nada que tomar</h2>
                <span>Esta bailarina tiene todas las medidas que piden sus prendas.</span></div>
            </div>
            <footer className="hz-tm-foot">
              <button type="button" className="hz-tm-ghost" onClick={() => setSheetOpen(true)}><i className="bi bi-plus-lg" />Agregar medidas</button>
              <button type="button" className="hz-tm-primary" onClick={chain ? chain.onNext : onExit}>{chain ? 'Seguir' : 'Volver a la ficha'}</button>
            </footer>
          </>
        )}

        {queue && current && !summary && (
          <>
            <div className="hz-tm-body">
              {saveError && <div role="alert" className="hz-tm-alert"><i className="bi bi-wifi-off" />No se pudo guardar. El valor queda escrito: tocá <strong>Reintentar</strong>.</div>}
              <div className="d-flex flex-column gap-1">
                <div className="hz-tm-by">
                  <span>Pedida por {current.requiredBy.join(' · ')}</span>
                  {current.extra && <span className="hz-tm-badge extra">EXTRA</span>}
                  {plan.data?.items.find((i) => i.key === current.key)?.requiredBy.some((r) => r.kind === 'design') && <span className="hz-tm-badge special">MEDIDA ESPECIAL</span>}
                </div>
                <h2 className="hz-tm-title">{current.name}</h2>
                {current.help && (
                  <>
                    <button type="button" className="hz-tm-link" aria-expanded={helpOpen} onClick={() => setHelpOpen((o) => !o)}>
                      <i className="bi bi-info-circle" />¿Cómo se toma?<i className={`bi ${helpOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                    </button>
                    {helpOpen && <p className="hz-tm-help">{current.help}</p>}
                  </>
                )}
              </div>

              {loaded && (
                <div className="hz-tm-loaded">
                  <div className="d-flex align-items-center gap-2 ok"><i className="bi bi-check-circle-fill" />Ya cargada · {formatShortDate(current.takenOn)}</div>
                  <div className="hz-tm-real"><span className="n">{formatCm(current.value)}</span><span>cm</span></div>
                  <button type="button" className="hz-tm-outline" onClick={() => { setRepeating(true); setText(''); setTried(false); }}><i className="bi bi-arrow-repeat" />Repetir medición</button>
                  <span className="small text-secondary">La medida anterior se guarda en el historial; no se pisa.</span>
                </div>
              )}

              {!loaded && (
                <div className="d-flex flex-column gap-2">
                  <label htmlFor="hz-valor" className="hz-label">Valor medido</label>
                  <div className="hz-tm-field">
                    <input
                      id="hz-valor" ref={input} type="text" inputMode="decimal" autoComplete="off" placeholder="0"
                      className={error ? 'bad' : ''} aria-invalid={error ? true : undefined} aria-describedby="hz-err"
                      value={text} onChange={(e) => { setText(e.target.value); setSaveError(false); }}
                      onKeyDown={(e) => { if (isEnter(e)) { e.preventDefault(); onNext(); } }}
                    />
                    <span aria-hidden="true" className="unit">cm</span>
                  </div>
                  <div id="hz-err" aria-live="assertive">{error && <span role="alert" className="hz-tm-err"><i className="bi bi-x-circle" />{error}</span>}</div>
                  {repeating && current.value !== null && <span className="hz-tm-before"><i className="bi bi-clock-history" />Antes: {formatCm(current.value)} cm · {formatShortDate(current.takenOn)}</span>}
                </div>
              )}

              <div className="d-flex flex-column gap-1">
                <span className="hz-tm-kicker">Tu toma</span>
                <div role="list" className="hz-tm-chips" ref={chips}>
                  {queue.map((q, i) => {
                    const st = stepStatus(queue, index, i, skipped);
                    const label = `${q.name}: ${st === 'done' ? 'hecha' : st === 'skipped' ? 'saltada' : st === 'current' ? 'actual' : 'pendiente'}`;
                    return (
                      <div key={q.key} role="listitem" className="hz-tm-li">
                        <button type="button" className={`hz-tm-chip ${st}`} aria-label={label} aria-current={st === 'current' ? 'step' : undefined} onClick={() => goTo(i)}>
                          {st === 'current' && <i className="bi bi-record-circle" />}{st === 'done' && <i className="bi bi-check-lg" />}{st === 'skipped' && <i className="bi bi-skip-forward" />}
                          {q.short}{q.extra && st === 'pending' && <span className="x">EXTRA</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="hz-tm-link" onClick={() => setSheetOpen(true)}><i className="bi bi-plus-lg" />Agregar más medidas</button>
              </div>
            </div>

            <footer className="hz-tm-foot">
              <button type="button" className="hz-tm-ghost" aria-label="Medida anterior" disabled={index === 0} onClick={() => goTo(index - 1)}><i className="bi bi-arrow-left" />Anterior</button>
              <button type="button" className="hz-tm-skip" onClick={onSkip}>Saltar</button>
              {saving ? (
                <button type="button" className="hz-tm-primary busy" disabled aria-busy="true"><span className="hz-tm-spin" aria-hidden="true" /><span aria-live="polite">Guardando…</span></button>
              ) : saveError ? (
                <button type="button" className="hz-tm-primary" onClick={() => void save()}><i className="bi bi-arrow-clockwise" />Reintentar</button>
              ) : (
                <button type="button" className="hz-tm-primary" onClick={onNext}>Siguiente<i className="bi bi-arrow-right" /></button>
              )}
            </footer>
          </>
        )}

        {queue && summary && (
          <Summary
            queue={queue} skipped={skipped} doneCount={doneCount} chain={chain}
            dancerName={dancerName} onLoadNow={(i) => goTo(i)} onExit={onExit} onOpenSheet={onOpenSheet}
          />
        )}

        {sheetOpen && queue && (
          <AddMeasuresSheet defs={bodyDefs} inQueue={inQueueKeys} onClose={() => setSheetOpen(false)} onAdd={addFromDefs} onCreateCustom={() => setCustomOpen(true)} />
        )}
      </div>
      <CustomMeasureModal show={customOpen} dancerId={dancerId} onClose={() => setCustomOpen(false)} onSaved={(n, info) => { onCustomSaved(n, info); setSheetOpen(false); }} />
    </div>
  );
}

function Summary({ queue, skipped, doneCount, chain, dancerName, onLoadNow, onExit, onOpenSheet }: {
  queue: QueueItem[]; skipped: Set<string>; doneCount: number; chain?: ChainInfo; dancerName: string; onLoadNow: (i: number) => void; onExit: () => void; onOpenSheet?: () => void;
}) {
  const skippedCount = queue.filter((q) => q.value === null && skipped.has(q.key)).length;
  return (
    <>
      <div className="hz-tm-body">
        <div aria-live="polite" className="d-flex flex-column gap-2">
          <span className="hz-tm-okcircle"><i className="bi bi-check-lg" /></span>
          {chain ? (
            <>
              <h2 className="hz-tm-sumtitle">{dancerName} terminada ✓</h2>
              <span className="hz-tm-sumnote">{doneCount} {doneCount === 1 ? 'cargada' : 'cargadas'}{skippedCount ? ` · ${skippedCount} ${skippedCount === 1 ? 'saltada' : 'saltadas'}` : ''}</span>
            </>
          ) : (
            <>
              <h2 className="hz-tm-sumtitle">Listo, cargaste {doneCount} {doneCount === 1 ? 'medida' : 'medidas'}</h2>
              <span className="hz-tm-sumnote">Cada valor quedó como una versión nueva; las anteriores siguen en el historial.</span>
            </>
          )}
        </div>
        <div className="hz-tm-sumlist">
          {queue.map((q, i) => q.value !== null ? (
            <div key={q.key} className="row-done"><i className="bi bi-check-circle-fill" /><span className="flex-grow-1">{q.name}</span><span className="hz-tm-real sm"><span className="n">{formatCm(q.value)}</span><span>cm</span></span></div>
          ) : (
            <div key={q.key} className="row-skip"><i className="bi bi-skip-forward-fill" /><span className="flex-grow-1">{q.name} · saltada</span>
              <button type="button" className="hz-tm-link" onClick={() => onLoadNow(i)}>Cargar ahora</button></div>
          ))}
        </div>
        {chain && (
          <div className="hz-tm-next">
            {chain.next ? (<><span className="hz-tm-kicker">Siguiente</span><div className="d-flex justify-content-between align-items-baseline"><strong>{chain.next.name}</strong><span className="text-secondary">{chain.next.missing} {chain.next.missing === 1 ? 'falta' : 'faltan'}</span></div></>)
              : <span className="text-secondary">No quedan más bailarinas con faltantes.</span>}
          </div>
        )}
      </div>
      <footer className="hz-tm-foot col">
        {chain ? (
          <>
            {chain.next && <button type="button" className="hz-tm-primary" onClick={chain.onNext}>Seguir</button>}
            <div className="d-flex gap-2">
              {chain.next && <button type="button" className="hz-tm-outline flex-grow-1" onClick={chain.onSkipDancer}>Saltar bailarina</button>}
              <button type="button" className={`${chain.next ? 'hz-tm-outline' : 'hz-tm-primary'} flex-grow-1`} onClick={chain.onFinish}>Terminar</button>
            </div>
          </>
        ) : (
          <>
            {onOpenSheet && <button type="button" className="hz-tm-primary" onClick={onOpenSheet}><i className="bi bi-scissors" />Ver hoja de molde</button>}
            <button type="button" className="hz-tm-outline" onClick={onExit}>Volver a la ficha</button>
          </>
        )}
      </footer>
    </>
  );
}
