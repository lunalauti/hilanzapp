import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGroupPlan } from '../../lib/queries';
import { TakeMeasures } from './TakeMeasures';

/** `/dancers/:id/medir?solo=a,b&volver=/ruta&medida=clave` */
export function DancerTakeRoute() {
  const { dancerId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const soloParam = params.get('solo');
  const only = useMemo(() => (soloParam ? soloParam.split(',').filter(Boolean) : undefined), [soloParam]);
  const volver = params.get('volver') || `/dancers/${dancerId}?tab=medidas`;
  const sheetTarget = volver.startsWith('/moldes') ? `${volver}${volver.includes('?') ? '&' : '?'}medidas=nuevas` : `/moldes?dancer=${dancerId}`;
  return (
    <TakeMeasures
      key={dancerId}
      dancerId={dancerId}
      only={only}
      startKey={params.get('medida') ?? undefined}
      onExit={() => navigate(volver, { replace: true })}
      onOpenSheet={() => navigate(sheetTarget, { replace: true })}
    />
  );
}

/** `/groups/:id/medir`: recorre a las bailarinas con faltantes, una por vez. */
export function GroupTakeRoute() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const plan = useGroupPlan(groupId, true);
  const [order, setOrder] = useState<{ id: string; name: string; missing: number }[] | null>(null);
  const [pos, setPos] = useState(0);
  if (order === null && plan.data) setOrder(plan.data.dancers.map((d) => ({ id: d.id, name: d.name, missing: d.missing })));
  const exit = () => navigate(`/groups/${groupId}`, { replace: true });

  if (!order) return null;
  if (order.length === 0) {
    return (
      <div className="hz-tm" role="presentation">
        <div className="hz-tm-backdrop" onClick={exit} aria-hidden="true" />
        <div className="hz-tm-panel" role="dialog" aria-modal="true" aria-label="Tomar medidas del grupo">
          <div className="hz-tm-body">
            <div className="hz-tm-empty"><i className="bi bi-check2-circle" aria-hidden="true" /><h2>No falta nada</h2><span>Todas las bailarinas tienen las medidas que piden sus prendas.</span></div>
          </div>
          <footer className="hz-tm-foot col"><Link to={`/groups/${groupId}/production`} className="hz-tm-primary">Ver producción</Link><button type="button" className="hz-tm-outline" onClick={exit}>Volver al grupo</button></footer>
        </div>
      </div>
    );
  }
  const current = order[pos];
  if (!current) { exit(); return null; }
  const next = order[pos + 1] ?? null;
  return (
    <TakeMeasures
      key={current.id}
      dancerId={current.id}
      onExit={exit}
      chain={{
        position: pos + 1, total: order.length,
        next: next ? { name: next.name, missing: next.missing } : null,
        onNext: () => setPos(pos + 1),
        onSkipDancer: () => (order[pos + 2] ? setPos(pos + 2) : exit()),
        onFinish: exit,
      }}
    />
  );
}
