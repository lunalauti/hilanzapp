import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/apiClient';
import { openPdf } from '../../lib/files';
import { formatCm } from '../../lib/format';
import { useGroupPlan, useInvalidateDancerData } from '../../lib/queries';
import { parseMeasure, shortName } from '../../lib/takeMeasures';

type CellState = 'idle' | 'saving' | 'error';

/** Celda editable: se escribe el valor y se guarda al salir del campo o con Enter (Enter baja a la fila de abajo). */
function CellInput({ dancerId, dancerName, measure, value, row, col }: {
  dancerId: string; dancerName: string; measure: { definitionId: string; name: string }; value: number | null; row: number; col: number;
}) {
  const [text, setText] = useState(value === null ? '' : formatCm(value));
  const [state, setState] = useState<CellState>('idle');
  const [message, setMessage] = useState('');
  const invalidate = useInvalidateDancerData();
  // Si el valor cambia desde afuera (otra pantalla, recarga), el campo lo refleja.
  useEffect(() => { setText(value === null ? '' : formatCm(value)); }, [value]);

  async function commit() {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === (value === null ? '' : formatCm(value))) { setState('idle'); setMessage(''); return; }
    const parsed = parseMeasure(trimmed);
    if (!parsed.ok) { setState('error'); setMessage(parsed.error); return; }
    setState('saving');
    try {
      await api.put(`/dancers/${dancerId}/measurements/${measure.definitionId}`, { valueCm: parsed.value });
      setState('idle'); setMessage('');
      setText(formatCm(parsed.value));
      invalidate(dancerId);
    } catch {
      setState('error'); setMessage('No se pudo guardar. Probá de nuevo.');
    }
  }

  return (
    <input
      className={`hz-gap-input ${value === null && state === 'idle' ? 'missing' : ''} ${state}`}
      data-cell={`${row}:${col}`}
      inputMode="decimal" autoComplete="off" placeholder="—"
      aria-label={`${measure.name} de ${dancerName}`} aria-invalid={state === 'error' ? true : undefined} title={message || undefined}
      value={text} disabled={state === 'saving'}
      onChange={(e) => { setText(e.target.value); if (state === 'error') setState('idle'); }}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = (e.currentTarget.closest('[role="table"]')?.querySelector<HTMLInputElement>(`[data-cell="${row + 1}:${col}"]`));
        void commit().then(() => next?.focus());
      }}
    />
  );
}

/** Faltantes del grupo: bailarinas × medidas requeridas, en orden corporal. Una celda ámbar abre el flujo en esa medida. */
export function GroupMissing() {
  const { groupId = '' } = useParams();
  const [onlyMissing, setOnlyMissing] = useState(true);
  // Se trae siempre todo: el filtro "solo con faltantes" se aplica acá para que una fila no desaparezca mientras se la completa.
  const plan = useGroupPlan(groupId, false);
  const [frozen, setFrozen] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (plan.data && frozen === null) setFrozen(new Set(plan.data.dancers.filter((d) => d.missing > 0).map((d) => d.id)));
  }, [plan.data, frozen]);
  const toggleFilter = () => {
    setFrozen(plan.data ? new Set(plan.data.dancers.filter((d) => d.missing > 0).map((d) => d.id)) : null);
    setOnlyMissing((v) => !v);
  };
  const toast = useToast();
  const [printing, setPrinting] = useState(false);
  const back = encodeURIComponent(`/groups/${groupId}/faltantes`);
  const cellTo = (dancerId: string, key: string) => `/dancers/${dancerId}/medir?medida=${key}&solo=${key}&volver=${back}`;

  async function print() {
    setPrinting(true);
    try { openPdf(await api.getBlob(`/groups/${groupId}/measure-plan/pdf`), 'faltantes-del-grupo.pdf'); }
    catch { toast.show('No pudimos generar la lista'); }
    finally { setPrinting(false); }
  }

  if (plan.isLoading) return <div className="d-flex align-items-center gap-2" role="status"><span className="hz-spinner sm" aria-hidden="true" /><span className="hz-tm-loading">Contando medidas…</span></div>;
  if (plan.error || !plan.data) {
    return (
      <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />
        <span className="flex-grow-1"><strong>No se pudo armar la lista.</strong> Probá de nuevo en unos segundos.</span>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void plan.refetch()}>Reintentar</button>
      </div>
    );
  }
  const { measures, totals } = plan.data;
  const dancers = onlyMissing ? plan.data.dancers.filter((d) => frozen?.has(d.id) ?? d.missing > 0) : plan.data.dancers;
  const missingTotal = totals.required - totals.done;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="d-flex flex-column gap-1 flex-grow-1" style={{ minWidth: 220, maxWidth: 420 }}>
          <span className="fw-semibold">{totals.done} de {totals.required} medidas · {totals.percent} %</span>
          <div className="hz-progress" role="img" aria-label={`${totals.percent}% de las medidas cargadas`}><i className="done" style={{ width: `${totals.percent}%` }} /></div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button type="button" className={`hz-pill ${onlyMissing ? 'active' : ''}`} aria-pressed={onlyMissing} onClick={toggleFilter}>Solo con faltantes</button>
          <button type="button" className="hz-btn" disabled={printing} onClick={() => void print()}><i className="bi bi-printer" />{printing ? 'Generando…' : 'Imprimir lista'}</button>
          <Link to={`/groups/${groupId}/medir`} className="hz-btn primary"><i className="bi bi-rulers" />Tomar medidas del grupo</Link>
        </div>
      </div>

      {dancers.length === 0 && (
        <EmptyState icon="bi-check2-circle" title={missingTotal === 0 && totals.required > 0 ? 'No falta nada' : 'Todavía no hay medidas por pedir'}
          note={missingTotal === 0 && totals.required > 0 ? `Grupo completo: ${totals.done} de ${totals.required} medidas cargadas.` : 'Asignales vestuario a las bailarinas para saber qué medidas hacen falta.'}
          action={<Link to={`/groups/${groupId}/production`} className="hz-btn">Ver producción</Link>} />
      )}

      {dancers.length > 0 && (
        <>
          {/* Escritorio: tabla */}
          <div className="hz-gap-table d-none d-lg-block" role="table" aria-label="Faltantes del grupo">
            <div role="row" className="hz-gap-row head" style={{ gridTemplateColumns: `200px repeat(${measures.length}, minmax(92px, 1fr))` }}>
              <span role="columnheader">Bailarina</span>
              {measures.map((m) => <span key={m.key} role="columnheader" title={m.name}>{shortName(m.key, m.name)}</span>)}
            </div>
            {dancers.map((d, rowIndex) => (
              <div key={d.id} role="row" className="hz-gap-row" style={{ gridTemplateColumns: `200px repeat(${measures.length}, minmax(92px, 1fr))` }}>
                <span role="rowheader" className="d-flex flex-column"><Link to={`/dancers/${d.id}`} className="fw-semibold text-decoration-none">{d.name}</Link>
                  <span className={`small ${d.missing ? 'text-warning-emphasis' : 'text-success'}`}>{d.missing === 0 ? 'Completas' : d.missing === 1 ? 'Falta 1' : `Faltan ${d.missing}`}</span></span>
                {d.cells.map((c, i) => {
                  const m = measures[i]!;
                  return (
                    <span key={m.key} role="cell" className="cell">
                      {!c.required ? <span className="text-secondary small">no la pide</span>
                        : <CellInput dancerId={d.id} dancerName={d.name} measure={m} value={c.value} row={rowIndex} col={i} />}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Celular: una tarjeta por bailarina */}
          <div className="d-lg-none d-flex flex-column gap-3">
            {dancers.map((d) => (
              <section key={d.id} className="hz-card p-3 d-flex flex-column gap-2" aria-label={d.name}>
                <div className="d-flex justify-content-between align-items-baseline"><strong>{d.name}</strong>
                  <span className={`hz-status ${d.missing ? 'warn' : 'ok'}`}>{d.missing === 0 ? 'Completas' : d.missing === 1 ? 'Falta 1' : `Faltan ${d.missing}`}</span></div>
                <div className="hz-gap-cards">
                  {d.cells.map((c, i) => {
                    const m = measures[i]!;
                    if (!c.required) return null;
                    return (
                      <div key={m.key} className="hz-gap-card">
                        <span className="small text-secondary">{shortName(m.key, m.name)}</span>
                        {c.value !== null ? <span className="fw-semibold"><i className="bi bi-check-lg text-success" /> {formatCm(c.value)}</span>
                          : <Link to={cellTo(d.id, m.key)} className="hz-missing-chip" aria-label={`Cargar ${m.name} de ${d.name}`}>— cargar</Link>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
