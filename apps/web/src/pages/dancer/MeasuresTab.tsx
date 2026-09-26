import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, Loading } from '../../components/ui/States';
import { api } from '../../lib/apiClient';
import { formatCm, joinEs } from '../../lib/format';
import { useInvalidateDancerData, useMeasurements, useMeasurePlan } from '../../lib/queries';
import type { MeasureItem, PlanItem } from '../../lib/types';
import { CustomMeasureModal } from './CustomMeasureModal';
import { MeasureField } from './MeasureField';

function PlanRow({ item, to }: { item: PlanItem; to: string }) {
  const by = item.requiredBy.map((r) => r.label).join(' · ');
  return (
    <Link to={to} className="hz-plan-row" aria-label={`${item.name}: ${item.value === null ? 'falta' : `${formatCm(item.value)} cm`}`}>
      <span className="flex-grow-1 min-w-0 d-flex flex-column"><span className="n">{item.name}</span><span className="by">{by}</span></span>
      {item.value !== null
        ? <span className="hz-real-chip"><strong>{formatCm(item.value)}</strong> cm</span>
        : <span className="hz-missing-chip"><i className="bi bi-rulers" />Falta<i className="bi bi-arrow-right" /></span>}
    </Link>
  );
}

export function MeasuresTab({ dancerId }: { dancerId: string }) {
  const { data, isLoading, error, refetch } = useMeasurements(dancerId);
  const plan = useMeasurePlan(dancerId);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidateDancerData();
  const toast = useToast();

  if (isLoading || plan.isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (plan.error) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  const items = plan.data?.items ?? [];
  const planKeys = new Set(items.map((i) => i.key));
  const others = (data ?? []).filter((m) => !planKeys.has(m.key));
  const others_base = others.filter((m) => m.isBase);
  const others_custom = others.filter((m) => !m.isBase);

  const fromGarments = items.filter((i) => i.requiredBy.some((r) => r.kind !== 'design'));
  const onlyDesign = items.filter((i) => i.requiredBy.every((r) => r.kind === 'design'));
  const designNames = [...new Set(onlyDesign.flatMap((i) => i.requiredBy.map((r) => r.label)))];
  const onlyBase = fromGarments.length > 0 && fromGarments.every((i) => i.requiredBy.every((r) => r.kind === 'base'));
  const missing = items.filter((i) => i.value === null);
  const askedBy = [...new Set(missing.flatMap((i) => i.requiredBy.filter((r) => r.kind !== 'base').map((r) => r.label)))];
  const back = encodeURIComponent(`/dancers/${dancerId}?tab=medidas`);
  const flow = `/dancers/${dancerId}/medir?volver=${back}`;
  const rowTo = (i: PlanItem) => `/dancers/${dancerId}/medir?medida=${i.key}&solo=${i.key}&volver=${back}`;

  async function save(item: MeasureItem, value: number) {
    await api.put(`/dancers/${dancerId}/measurements/${item.definitionId}`, { valueCm: value });
    invalidate(dancerId);
    toast.show(`${item.name}: ${String(value).replace('.', ',')} cm`);
  }

  return (
    <div className="d-flex flex-column gap-4">
      {missing.length > 0 && (
        <section className="hz-missing-card" aria-label="Medidas que faltan">
          <div className="d-flex align-items-center gap-2 title"><i className="bi bi-rulers" /><span>{missing.length === 1 ? 'Te falta 1 medida' : `Te faltan ${missing.length} medidas`}</span></div>
          <span className="text">
            {askedBy.length ? <>Las {missing.length === 1 ? 'pide' : 'piden'} {joinEs(askedBy)}. Sin ellas no se calcula la hoja de molde.</> : 'Son las medidas base para completar la ficha.'}
          </span>
          <Link to={flow} className="hz-tm-primary"><i className="bi bi-rulers" />Tomar medidas</Link>
        </section>
      )}
      {items.length > 0 && missing.length === 0 && <div className="hz-notice ok"><i className="bi bi-check-circle" />Medidas completas para lo que piden sus prendas.</div>}

      {fromGarments.length > 0 && (
        <section className="d-flex flex-column gap-2" aria-labelledby="req-title">
          <h2 id="req-title" className="hz-plan-title">{onlyBase ? 'Medidas base requeridas' : 'Requeridas por sus prendas'}</h2>
          <div className="hz-plan-list">{fromGarments.map((i) => <PlanRow key={i.key} item={i} to={rowTo(i)} />)}</div>
        </section>
      )}

      {designNames.map((name) => (
        <section key={name} className="d-flex flex-column gap-2" aria-label={`Para ${name}`}>
          <h2 className="hz-plan-title">Para {name}<span>Medidas especiales del diseño</span></h2>
          <div className="hz-plan-list">
            {onlyDesign.filter((i) => i.requiredBy.some((r) => r.label === name)).map((i) => <PlanRow key={i.key} item={i} to={rowTo(i)} />)}
          </div>
        </section>
      ))}

      {items.length === 0 && (
        <div className="hz-notice warning"><i className="bi bi-info-circle" />Todavía no hay medidas requeridas: asignale vestuario para saber cuáles hacen falta.</div>
      )}

      <section className="hz-card hz-panel" aria-labelledby="others-title">
        <div className="d-flex justify-content-between align-items-baseline gap-2">
          <h2 id="others-title" className="hz-panel-title">Otras medidas</h2>
          <span className="small" style={{ color: 'var(--hz-real)' }}><i className="bi bi-rulers" /> reales · en cm</span>
        </div>
        {others_base.length > 0 && <div className="hz-measures">{others_base.map((m) => <MeasureField key={m.definitionId} item={m} onSave={save} />)}</div>}
        {others_custom.length > 0 && <div className="hz-measures">{others_custom.map((m) => <MeasureField key={m.definitionId} item={m} onSave={save} />)}</div>}
        <span className="small text-secondary">Las medidas reales nunca se reemplazan por los resultados del molde.</span>
        <button type="button" className="hz-btn dashed" onClick={() => setAdding(true)}><i className="bi bi-plus-lg" />Agregar medida personalizada</button>
      </section>

      <CustomMeasureModal show={adding} dancerId={dancerId} onClose={() => setAdding(false)} onSaved={(name) => { invalidate(dancerId); toast.show(`${name} guardada`); }} />
    </div>
  );
}
