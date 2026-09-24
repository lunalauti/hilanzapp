import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, Loading } from '../../components/ui/States';
import { api } from '../../lib/apiClient';
import { useInvalidateDancerData, useMeasurements } from '../../lib/queries';
import type { MeasureItem } from '../../lib/types';
import { CustomMeasureModal } from './CustomMeasureModal';
import { MeasureField } from './MeasureField';

export function MeasuresTab({ dancerId }: { dancerId: string }) {
  const { data, isLoading, error, refetch } = useMeasurements(dancerId);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidateDancerData();
  const toast = useToast();

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const base = (data ?? []).filter((m) => m.isBase);
  const custom = (data ?? []).filter((m) => !m.isBase);

  async function save(item: MeasureItem, value: number) {
    await api.put(`/dancers/${dancerId}/measurements/${item.definitionId}`, { valueCm: value });
    invalidate(dancerId);
    toast.show(`${item.name}: ${String(value).replace('.', ',')} cm`);
  }

  return (
    <div className="d-flex flex-column gap-4">
      <section className="hz-card hz-panel" aria-labelledby="base-title">
        <div className="d-flex justify-content-between align-items-baseline gap-2">
          <h2 id="base-title" className="hz-panel-title">Medidas base</h2>
          <span className="small" style={{ color: 'var(--hz-real)' }}><i className="bi bi-rulers" /> reales · en cm</span>
        </div>
        <div className="hz-measures">{base.map((m) => <MeasureField key={m.definitionId} item={m} onSave={save} />)}</div>
        <span className="small text-secondary">Las medidas reales nunca se reemplazan por los resultados del molde. * requerida para el estado completo.</span>
      </section>

      <section className="hz-card hz-panel" aria-labelledby="custom-title">
        <h2 id="custom-title" className="hz-panel-title">Personalizadas</h2>
        {custom.length > 0 && <div className="hz-measures">{custom.map((m) => <MeasureField key={m.definitionId} item={m} onSave={save} />)}</div>}
        <button type="button" className="hz-btn dashed" onClick={() => setAdding(true)}><i className="bi bi-plus-lg" />Agregar medida personalizada</button>
      </section>

      <CustomMeasureModal show={adding} dancerId={dancerId} onClose={() => setAdding(false)} onSaved={(name) => { invalidate(dancerId); toast.show(`${name} guardada`); }} />
    </div>
  );
}
