import { useMeasurePlan } from '../../lib/queries';

/** "Para este vestuario vas a necesitar: …" con las medidas especiales marcadas con asterisco. */
export function NeededMeasures({ dancerId }: { dancerId: string }) {
  const plan = useMeasurePlan(dancerId);
  if (plan.isLoading) return <span className="small text-secondary" role="status">Calculando las medidas…</span>;
  if (!plan.data || plan.data.items.length === 0) return <span className="small text-secondary">Este vestuario no pide medidas.</span>;
  const items = plan.data.items;
  const isSpecial = (i: (typeof items)[number]) => i.requiredBy.every((r) => r.kind === 'design');
  const text = items.map((i, n) => `${n === 0 ? i.name : i.name.replace(/^Contorno de /i, '').toLowerCase()}${isSpecial(i) ? '*' : ''}`).join(', ');
  const designs = [...new Set(items.filter(isSpecial).flatMap((i) => i.requiredBy.map((r) => r.label)))];
  return (
    <div className="hz-needed" role="group" aria-label="Medidas que vas a necesitar">
      <span className="hz-tm-kicker">Para este vestuario vas a necesitar:</span>
      <p className="mb-1">{text}</p>
      {designs.length > 0 && <span className="small text-secondary">* Medida especial de {designs.join(', ')}.</span>}
    </div>
  );
}
