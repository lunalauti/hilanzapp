import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatMoney, formatQty, plural } from '../../lib/format';
import { useCosts, useDesigns, useGroups, useInvalidateInventory, useMaterials, useStats } from '../../lib/queries';
import type { Material, MaterialCostRow } from '../../lib/types';
import { ConsumptionModal } from './ConsumptionModal';
import { MaterialModal } from './MaterialModal';
import { StockModal } from './StockModal';

export function Inventory() {
  const groups = useGroups();
  const designs = useDesigns();
  const materials = useMaterials();
  const [groupPick, setGroupPick] = useState('');
  const [designId, setDesignId] = useState('');
  const groupId = groupPick || groups.data?.[0]?.id || '';
  const group = groups.data?.find((g) => g.id === groupId);
  const costs = useCosts(groupId, designId);
  const invalidate = useInvalidateInventory();
  const toast = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [stockOf, setStockOf] = useState<Material | null>(null);
  const [consumption, setConsumption] = useState(false);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deduct, setDeduct] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (materials.isLoading || groups.isLoading) return <Loading rows={4} />;
  if (materials.error) return <ErrorState error={materials.error} onRetry={() => void materials.refetch()} />;

  const rows: MaterialCostRow[] = costs.data?.materials ?? (materials.data ?? []).map((m) => ({ materialId: m.id, name: m.name, description: m.description, unit: m.unit, unitCost: m.unitCost, stock: m.stockQty, need: 0, remaining: m.stockQty, shortfall: 0, cost: 0 }));
  const byId = new Map((materials.data ?? []).map((m) => [m.id, m]));
  const c = costs.data;
  const top = [...rows].filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
  const bars = [...top.slice(0, 3), ...(top.length > 3 ? [{ name: 'Otros', cost: top.slice(3).reduce((s, r) => s + r.cost, 0) }] : [])];
  const maxNeed = [...(c?.consumption ?? [])].sort((a, b) => (rows.find((r) => r.materialId === b.materialId)?.need ?? 0) - (rows.find((r) => r.materialId === a.materialId)?.need ?? 0))[0];

  async function confirmProduction() {
    setBusy(true); setProblem(null);
    try {
      const res = await api.post<{ deducted: boolean; items: number }>(`/groups/${groupId}/production/confirm`, { designId: designId || null, deductStock: deduct });
      invalidate();
      toast.show(res.deducted ? `Producción confirmada: se descontaron ${plural(res.items, 'material', 'materiales')} del stock` : 'Producción confirmada sin descontar stock');
      setConfirming(false);
    } catch (e) { setProblem(e instanceof ApiError ? e.message : 'No pudimos confirmar la producción.'); }
    finally { setBusy(false); }
  }

  async function removeMaterial(m: Material) {
    setBusy(true);
    try {
      try { await api.delete(`/materials/${m.id}`); }
      catch (e) { if (e instanceof ApiError && e.code === 'HAS_DEPENDENTS') await api.delete(`/materials/${m.id}?confirm=true`); else throw e; }
      invalidate();
      toast.show(`${m.name} eliminado`);
    } catch { toast.show('No pudimos eliminar el material'); }
    finally { setBusy(false); setDeleting(null); }
  }

  const empty = (materials.data ?? []).length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Taller"
        title="Inventario y costos"
        actions={
          <>
            <button type="button" className="hz-btn" onClick={() => setConsumption(true)}><i className="bi bi-rulers" />Consumo</button>
            <button type="button" className="hz-btn primary" onClick={() => setEditing('new')}><i className="bi bi-plus-lg" />Material</button>
          </>
        }
      />

      <div className="hz-card hz-panel mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-5 d-flex flex-column gap-1">
            <label htmlFor="inv-group" className="hz-label">Calcular para</label>
            <select id="inv-group" className="hz-input" value={groupId} onChange={(e) => setGroupPick(e.target.value)}>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name} · {plural(g.dancerCount, 'bailarina', 'bailarinas')}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4 d-flex flex-column gap-1">
            <label htmlFor="inv-design" className="hz-label">Diseño</label>
            <select id="inv-design" className="hz-input" value={designId} onChange={(e) => setDesignId(e.target.value)}>
              <option value="">Todos los diseños</option>
              {(designs.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <button type="button" className="hz-btn primary w-100" disabled={!c || c.totalUnits === 0} onClick={() => { setProblem(null); setConfirming(true); }}><i className="bi bi-check2-circle" />Confirmar producción</button>
          </div>
        </div>
        {c && c.unassignedUnits > 0 && <div className="hz-notice warning"><i className="bi bi-info-circle" />{plural(c.unassignedUnits, 'prenda no tiene', 'prendas no tienen')} un diseño asignado y no {c.unassignedUnits === 1 ? 'entra' : 'entran'} en el cálculo.</div>}
        {costs.error && <ErrorState error={costs.error} onRetry={() => void costs.refetch()} />}
      </div>

      {empty ? (
        <EmptyState icon="bi-box-seam" title="Todavía no cargaste materiales" note="Cargá telas, avíos y su costo para calcular cuánto necesita cada producción." action={<button type="button" className="hz-btn primary" onClick={() => setEditing('new')}><i className="bi bi-plus-lg" />Agregar material</button>} />
      ) : (
        <div className="row g-4">
          <div className="col-12 col-xl-8">
            <div className="hz-card hz-mat-table" role="table" aria-label="Materiales">
              <div className="hz-mat-row head" role="row"><span role="columnheader">Material</span><span role="columnheader">Costo</span><span role="columnheader">Stock</span><span role="columnheader">Necesita</span><span role="columnheader">Queda</span><span role="columnheader" aria-label="Acciones" /></div>
              {rows.map((r) => {
                const m = byId.get(r.materialId)!;
                const low = r.shortfall > 0;
                return (
                  <div key={r.materialId} className={`hz-mat-row ${low ? 'low' : ''}`} role="row">
                    <span role="cell" className="name">{low && <i className="bi bi-exclamation-octagon" aria-label="Falta stock" />}<span><strong>{r.name}</strong>{r.description && <small>{r.description}</small>}</span></span>
                    <span role="cell">{formatMoney(r.unitCost)}<small>/{r.unit}</small></span>
                    <span role="cell">{formatQty(r.stock)} {r.unit}</span>
                    <span role="cell">{r.need > 0 ? `${formatQty(r.need)} ${r.unit}` : '—'}</span>
                    <span role="cell" className="rest">{r.need > 0 ? `${r.remaining < 0 ? '−' : ''}${formatQty(Math.abs(r.remaining))} ${r.unit}` : '—'}</span>
                    <span role="cell" className="acts">
                      <button type="button" className="hz-icon-btn" aria-label={`Stock de ${r.name}`} onClick={() => setStockOf(m)}><i className="bi bi-arrow-left-right" /></button>
                      <button type="button" className="hz-icon-btn" aria-label={`Editar ${r.name}`} onClick={() => setEditing(m)}><i className="bi bi-pencil" /></button>
                      <button type="button" className="hz-icon-btn danger" aria-label={`Eliminar ${r.name}`} onClick={() => setDeleting(m)}><i className="bi bi-trash3" /></button>
                    </span>
                  </div>
                );
              })}
            </div>
            {c && c.shortages.length > 0 && (
              <div className="hz-notice warning mt-3" role="alert" style={{ flexDirection: 'column' }}>
                <strong><i className="bi bi-exclamation-octagon" /> Faltan materiales para esta producción</strong>
                {c.shortages.map((s) => <span key={s.materialId}>{s.name}: faltan {formatQty(s.shortfall)} {s.unit}</span>)}
              </div>
            )}
          </div>

          <div className="col-12 col-xl-4 d-flex flex-column gap-3">
            <section className="hz-card hz-panel" aria-label="Costo de la producción">
              <span className="hz-label">Costo de materiales · {group?.name ?? '—'}</span>
              {c ? (
                <>
                  <span className="hz-cost">{formatMoney(c.materialsCost)}</span>
                  <span className="text-secondary small">{c.totalUnits > 0 ? `≈ ${formatMoney(c.dancerCount ? c.materialsCost / c.dancerCount : 0)} por bailarina · ${plural(c.totalUnits, 'prenda', 'prendas')}` : 'Sin prendas con diseño asignado'}</span>
                  <dl className="hz-facts" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><dt>Mano de obra</dt><dd style={{ fontSize: 18 }}>{formatMoney(c.laborCost)}</dd></div>
                    <div><dt>Total</dt><dd style={{ fontSize: 18 }}>{formatMoney(c.totalCost)}</dd></div>
                  </dl>
                </>
              ) : <Loading rows={1} />}
            </section>

            {bars.length > 0 && (
              <section className="hz-card hz-panel" aria-label="Costo por material">
                <span className="hz-label">Por material</span>
                {bars.map((b) => (
                  <div key={b.name} className="d-flex flex-column gap-1">
                    <div className="d-flex justify-content-between"><span>{b.name}</span><strong>{formatMoney(b.cost)}</strong></div>
                    <div className="hz-progress"><i className="done" style={{ width: `${c && c.materialsCost ? (b.cost / c.materialsCost) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </section>
            )}

            {maxNeed && (
              <section className="hz-card hz-panel" aria-label="Consumo por talle">
                <span className="hz-label">{maxNeed.name} por talle</span>
                {maxNeed.byGarment.map((g) => (
                  <div key={`${g.designName}${g.moldName}`} className="d-flex flex-column gap-2">
                    <span className="small text-secondary">{g.moldName} · {g.designName}</span>
                    <div className="d-flex flex-wrap gap-2">
                      {g.sizes.map((s) => <span key={s.label} className="hz-req hz-real"><strong>T{s.label}</strong>{formatQty(s.quantity)} {maxNeed.unit}</span>)}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      )}

      <Overview onOpenGroup={(id) => navigate(`/groups/${id}/production`)} />

      <MaterialModal show={editing !== null} material={editing === 'new' ? undefined : (editing ?? undefined)} onClose={() => setEditing(null)} />
      <StockModal material={stockOf} onClose={() => setStockOf(null)} />
      <ConsumptionModal show={consumption} initialDesignId={designId} onClose={() => setConsumption(false)} />
      <ConfirmDialog show={deleting !== null} title={`Eliminar ${deleting?.name ?? ''}`} confirmLabel="Eliminar material" busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => deleting && void removeMaterial(deleting)}
        body={<p className="mb-0">Se elimina el material con su historial de movimientos y sus reglas de consumo. No se puede deshacer.</p>} />

      <ConfirmDialog show={confirming} title="Confirmar producción" confirmLabel={deduct ? 'Confirmar y descontar' : 'Confirmar'} busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => void confirmProduction()}
        body={
          <div className="d-flex flex-column gap-3">
            <p className="mb-0">Vas a producir <strong>{plural(c?.totalUnits ?? 0, 'prenda', 'prendas')}</strong> de {group?.name}{designId ? ` (${designs.data?.find((d) => d.id === designId)?.name})` : ''}.</p>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input mt-0" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />Descontar los materiales del stock</label>
            {deduct && c && c.shortages.length > 0 && <div className="hz-notice warning"><i className="bi bi-exclamation-octagon" />Falta stock de {c.shortages.map((s) => s.name).join(', ')}: no se va a poder descontar.</div>}
            {problem && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{problem}</div>}
          </div>
        } />
    </>
  );
}

function Overview({ onOpenGroup }: { onOpenGroup: (id: string) => void }) {
  const stats = useStats();
  if (stats.isLoading) return null;
  if (stats.error || !stats.data || stats.data.dancers === 0) return null;
  const s = stats.data;
  return (
    <section className="mt-5" aria-label="Resumen general">
      <h2 className="hz-panel-title mb-3">Resumen general</h2>
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="hz-card hz-panel h-100">
            <span className="hz-label">Bailarinas por talle</span>
            <div className="d-flex flex-wrap gap-2">{s.dancersBySize.map((x) => <span key={x.label} className="hz-req hz-sug"><strong>T{x.label}</strong>{x.count}</span>)}{s.dancersBySize.length === 0 && <span className="text-secondary">Sin talles todavía.</span>}</div>
            <span className="small text-secondary">{plural(s.dancers, 'bailarina', 'bailarinas')} en {plural(s.groups, 'grupo', 'grupos')}.</span>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="hz-card hz-panel h-100">
            <span className="hz-label">Prendas por talle</span>
            {s.garmentsBySize.map((g) => (
              <div key={g.moldName} className="d-flex flex-column gap-1">
                <div className="d-flex justify-content-between"><strong style={{ fontWeight: 500 }}>{g.moldName}</strong><span className="small text-secondary">{g.total}</span></div>
                <div className="d-flex flex-wrap gap-1">{g.sizes.map((x) => <span key={x.label} className="hz-req hz-calc"><strong>T{x.label}</strong>{x.count}</span>)}</div>
              </div>
            ))}
            {s.garmentsBySize.length === 0 && <span className="text-secondary">Sin prendas asignadas.</span>}
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="hz-card hz-panel h-100">
            <span className="hz-label">Costo por grupo</span>
            {s.costByGroup.map((g) => (
              <button key={g.groupId} type="button" className="hz-cost-row" onClick={() => onOpenGroup(g.groupId)}><span>{g.name}</span><strong>{formatMoney(g.totalCost)}</strong></button>
            ))}
            <div className="d-flex justify-content-between border-top pt-2"><span className="text-secondary">Total</span><strong>{formatMoney(s.totalCost)}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
