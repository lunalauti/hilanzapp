import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatCm, formatDate } from '../../lib/format';
import { useCompare, useHistory, useInvalidateDancerData, useMeasurements } from '../../lib/queries';

const today = () => new Date().toISOString().slice(0, 10);

export function HistoryTab({ dancerId }: { dancerId: string }) {
  const measurements = useMeasurements(dancerId);
  const withValue = (measurements.data ?? []).filter((m) => m.valueCm !== null);
  const [defId, setDefId] = useState<string | null>(null);
  const history = useHistory(dancerId, defId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const compare = useCompare(dancerId, from, to, Boolean(from && to));
  const invalidate = useInvalidateDancerData();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!defId && withValue[0]) setDefId(withValue[0].definitionId); }, [defId, withValue]);

  if (measurements.isLoading) return <Loading />;
  if (measurements.error) return <ErrorState error={measurements.error} />;
  if (withValue.length === 0) return <EmptyState icon="bi-clock-history" title="Sin historial todavía" note="Cuando cargues medidas vas a ver acá cada versión." />;

  async function restore(versionId: string) {
    setError(null);
    try {
      await api.post(`/dancers/${dancerId}/measurements/${defId}/restore`, { versionId });
      invalidate(dancerId);
      toast.show('Versión restaurada como valor vigente');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos restaurar la versión.'); }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <section className="hz-card hz-panel" aria-labelledby="hist-title">
        <h2 id="hist-title" className="hz-panel-title">Historial de una medida</h2>
        <select className="hz-input" aria-label="Medida" value={defId ?? ''} onChange={(e) => setDefId(e.target.value)}>
          {withValue.map((m) => <option key={m.definitionId} value={m.definitionId}>{m.name}</option>)}
        </select>
        {error && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}
        {history.isLoading && <Loading rows={2} />}
        <div className="hz-versions">
          {(history.data ?? []).map((v) => (
            <div key={v.id} className="hz-version">
              <span style={{ flex: 1 }}>{formatDate(v.takenOn)}{v.isCurrent && <span style={{ color: 'var(--hz-success)' }}> · vigente</span>}{v.note && <span className="text-secondary"> · {v.note}</span>}</span>
              {!v.isCurrent && <button type="button" className="btn btn-link p-0" onClick={() => void restore(v.id)}>Restaurar</button>}
              <span className="val">{formatCm(v.valueCm)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="hz-card hz-panel" aria-labelledby="cmp-title">
        <h2 id="cmp-title" className="hz-panel-title">Comparar dos tomas</h2>
        <div className="d-flex flex-wrap gap-3">
          <div className="d-flex flex-column gap-1"><label htmlFor="cmp-from" className="hz-label">Desde</label><input id="cmp-from" type="date" className="hz-input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="d-flex flex-column gap-1"><label htmlFor="cmp-to" className="hz-label">Hasta</label><input id="cmp-to" type="date" className="hz-input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        {!from && <span className="small text-secondary">Elegí una fecha de inicio para ver qué cambió.</span>}
        {compare.data && (
          <div className="hz-versions">
            {compare.data.map((r) => (
              <div key={r.definitionId} className="hz-version" style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px', gap: 6 }}>
                <span>{r.name}</span><span className="text-secondary text-end">{formatCm(r.from)}</span><span className="text-end fw-semibold" style={{ color: 'var(--hz-real)' }}>{formatCm(r.to)}</span>
                <span className="text-end fw-semibold">{r.diff === null ? '—' : `${r.diff > 0 ? '+' : ''}${formatCm(r.diff)}`}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
