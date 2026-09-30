import { NoPatternBadge } from '../components/ui/NoPatternBadge';
import { SizeAveragesModal } from '../components/production/SizeAveragesModal';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/apiClient';
import { openPdf } from '../lib/files';
import { plural } from '../lib/format';
import { keys, useProduction } from '../lib/queries';
import type { Production as ProductionData } from '../lib/types';

export function Production() {
  const { groupId = '' } = useParams();
  const { data, isLoading, error, refetch } = useProduction(groupId);
  const [open, setOpen] = useState<{ mold: string; size: string } | null>(null);
  const [averagesFor, setAveragesFor] = useState<{ moldTypeId: string; moldName: string; sizeLabel: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  if (isLoading) return <Loading rows={3} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const p = data!;

  function setData(updated: ProductionData) {
    queryClient.setQueryData(keys.production(groupId), updated);
  }

  async function exportPdf() {
    setExporting(true);
    try { openPdf(await api.getBlob(`/groups/${groupId}/production/pdf`), 'produccion.pdf'); }
    catch { toast.show('No pudimos generar el PDF'); }
    finally { setExporting(false); }
  }

  async function togglePattern(moldTypeId: string, sizeLabel: string, done: boolean) {
    try { setData(await api.put<ProductionData>(`/groups/${groupId}/production/pattern`, { moldTypeId, sizeLabel, done })); }
    catch { toast.show('No se pudo guardar'); }
  }

  async function toggleSewn(assignmentId: string, done: boolean) {
    try { setData(await api.put<ProductionData>(`/assignments/${assignmentId}/sewn`, { done })); }
    catch { toast.show('No se pudo guardar'); }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-end hz-no-print">
        <button type="button" className="hz-btn primary" disabled={exporting || p.byGarment.length === 0} onClick={() => void exportPdf()}><i className="bi bi-file-earmark-pdf" />{exporting ? 'Generando…' : 'Exportar PDF'}</button>
      </div>
      {p.pending.length > 0 && (
        <section className="hz-notice warning" style={{ flexDirection: 'column' }} aria-label="Bailarinas pendientes">
          <strong><i className="bi bi-hourglass-split" /> {plural(p.pending.length, 'pendiente', 'pendientes')}, no entran en el conteo</strong>
          <span>Se suman cuando tengan prenda y las medidas necesarias.</span>
          <div className="d-flex flex-column gap-2">
            {p.pending.map((x) => (
              <Link key={x.dancerId} to={`/dancers/${x.dancerId}`} className="d-flex justify-content-between align-items-center px-3 py-2 rounded-3 text-decoration-none" style={{ background: 'var(--hz-surface-float)', border: '1px solid var(--hz-warning-border)', color: 'var(--hz-warning)' }}>
                <span><strong>{x.name}</strong> · {x.reason === 'no_assignment' ? 'sin prendas asignadas' : `sin talle (${x.moldNames.join(', ')})`}</span>
                <i className="bi bi-arrow-right" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {p.byGarment.length === 0 && <EmptyState icon="bi-list-check" title="Todavía no hay nada para producir" note="Asigná prendas a las bailarinas y cargá sus medidas: el resumen aparece solo." />}

      {p.byGarment.map((g) => {
        const selected = open?.mold === g.moldKey ? g.sizes.find((s) => s.label === open.size) : undefined;
        const sewnTotal = g.sizes.reduce((n, s) => n + s.sewnTotal, 0);
        const sewnCount = g.sizes.reduce((n, s) => n + s.sewnCount, 0);
        return (
          <section key={g.moldKey} className="hz-card hz-panel" aria-label={g.moldName}>
            <div className="d-flex justify-content-between align-items-baseline">
              <h2 className="hz-panel-title d-flex align-items-center gap-2">{g.moldName}{g.hasPattern === false && <NoPatternBadge />}</h2>
              <span className="text-secondary">{plural(g.total, 'prenda', 'prendas')} · {sewnCount} de {sewnTotal} confeccionadas</span>
            </div>
            <div className="d-flex flex-column gap-2">
              {g.sizes.map((s) => {
                const active = selected?.label === s.label;
                const allSewn = s.sewnTotal > 0 && s.sewnCount === s.sewnTotal;
                return (
                  <div key={s.label} className="hz-prod-size-row d-flex align-items-center gap-2 flex-wrap">
                    <label className="hz-check-label">
                      <input
                        type="checkbox" checked={s.patternDone} disabled={!s.moldTypeId}
                        aria-label={`Patrón listo: ${g.moldName} talle ${s.label}`}
                        onChange={(e) => s.moldTypeId && void togglePattern(s.moldTypeId, s.label, e.target.checked)}
                      />
                      Patrón listo
                    </label>
                    <button type="button" className={`hz-size-btn ${active ? 'active' : ''}`} aria-pressed={active} aria-label={`${g.moldName} talle ${s.label}: ${plural(s.count, 'prenda', 'prendas')}`} onClick={() => setOpen(active ? null : { mold: g.moldKey, size: s.label })}>
                      <span className="t">T{s.label}</span><span className={`q ${allSewn ? 'hz-sewn-complete' : ''}`}>{s.count}</span>
                    </button>
                    <span className="small text-secondary">{s.sewnCount}/{s.sewnTotal} confeccionadas</span>
                    {s.moldTypeId && (
                      <button type="button" className="hz-btn dashed" onClick={() => setAveragesFor({ moldTypeId: s.moldTypeId!, moldName: g.moldName, sizeLabel: s.label })}>
                        <i className="bi bi-rulers" />Ver medidas del talle
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {selected && (
              <div className="hz-names" role="region" aria-label={`${g.moldName} talle ${selected.label}`}>
                <span className="lbl">{g.moldName} T{selected.label}</span>
                <div className="d-flex flex-column gap-1">
                  {selected.units.map((u) => (
                    <label key={u.assignmentId} className="hz-check-label">
                      <input type="checkbox" checked={u.sewn} aria-label={`Confección lista: ${u.dancerName}`} onChange={(e) => void toggleSewn(u.assignmentId, e.target.checked)} />
                      {u.dancerName}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
      {p.byGarment.length > 0 && <span className="small text-secondary">Total: {plural(p.totalUnits, 'prenda', 'prendas')} para {plural(p.dancerCount - p.pending.length, 'bailarina', 'bailarinas')}. Tocá un talle para ver quiénes son.</span>}

      {averagesFor && (
        <SizeAveragesModal
          show groupId={groupId} moldTypeId={averagesFor.moldTypeId} moldName={averagesFor.moldName} sizeLabel={averagesFor.sizeLabel}
          onClose={() => setAveragesFor(null)}
        />
      )}
    </div>
  );
}
