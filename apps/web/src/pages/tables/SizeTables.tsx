import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useMeasureDefs, useSizeTable, useSizeTables } from '../../lib/queries';
import type { SizeTableGrid } from '../../lib/types';
import { Cell } from './Cell';
import { AGE_LABEL, TableFormModal } from './TableFormModal';

const CORE = ['pecho', 'cintura', 'cadera'];

export function SizeTables() {
  const list = useSizeTables();
  const [params, setParams] = useSearchParams();
  const activeId = list.data?.find((t) => t.isActive)?.id ?? list.data?.[0]?.id ?? '';
  const tableId = params.get('tabla') ?? activeId;

  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data?.length) return <EmptyState icon="bi-table" title="No hay tablas de talles" note="Se cargan la primera vez que entrás a la app." />;
  return <Editor key={tableId} tableId={tableId} onPick={(id) => setParams({ tabla: id })} />;
}

function Editor({ tableId, onPick }: { tableId: string; onPick: (id: string) => void }) {
  const list = useSizeTables();
  const grid = useSizeTable(tableId);
  const defs = useMeasureDefs();
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [confirm, setConfirm] = useState<'restore' | 'delete' | { size: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [newSize, setNewSize] = useState({ label: '', descriptor: '' });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['size-tables'] }); void qc.invalidateQueries({ queryKey: ['size-table'] }); void qc.invalidateQueries({ queryKey: ['sizing'] }); void qc.invalidateQueries({ queryKey: ['group-dancers'] }); void qc.invalidateQueries({ queryKey: ['production'] }); };

  const columns = useMemo(() => {
    const t = grid.data;
    if (!t) return [];
    const byKey = new Map(t.measures.map((m) => [m.key, m.name]));
    for (const k of extra) { const d = defs.data?.find((x) => x.key === k); if (d) byKey.set(k, d.name); }
    return [...byKey.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => {
      const ia = CORE.indexOf(a.key); const ib = CORE.indexOf(b.key);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.name.localeCompare(b.name, 'es');
    });
  }, [grid.data, extra, defs.data]);

  if (grid.isLoading) return <Loading />;
  if (grid.error || !grid.data) return <ErrorState error={grid.error ?? new Error('not found')} onRetry={() => void grid.refetch()} />;
  const t: SizeTableGrid = grid.data;
  const isTemplate = t.templateKey !== null;
  const available = (defs.data ?? []).filter((d) => d.kind === 'body' && !columns.some((c) => c.key === d.key));

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(null);
    try { await fn(); refresh(); toast.show(ok); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No pudimos completar la acción.'); }
    finally { setBusy(false); setConfirm(null); }
  }

  const save = async (sizeLabel: string, measureKey: string, value: number | null) => {
    await api.patch(`/size-tables/${t.id}/values`, { changes: [{ sizeLabel, measureKey, value }] });
    refresh();
  };

  async function addSize() {
    const label = newSize.label.trim();
    if (!label) return setError('El talle necesita un nombre.');
    await run(() => api.post(`/size-tables/${t.id}/sizes`, { label, descriptor: newSize.descriptor.trim() || null }), `Talle ${label} agregado`);
    setNewSize({ label: '', descriptor: '' });
  }

  return (
    <>
      <PageHeader
        eyebrow="Ajustes"
        title={t.name}
        subtitle={<>{t.isActive ? <span className="hz-status ok"><i className="bi bi-check-circle-fill" />Tabla activa · {AGE_LABEL[t.ageRange]}</span> : <span className="hz-status none"><i className="bi bi-circle" />Tabla inactiva · {AGE_LABEL[t.ageRange]}</span>}{t.source ? ` · ${t.source}` : ''}</>}
        actions={
          <>
            <select className="hz-input" style={{ width: 240 }} aria-label="Otra tabla" value={t.id} onChange={(e) => onPick(e.target.value)}>
              {(list.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.isActive ? ' · activa' : ''}</option>)}
            </select>
            {!t.isActive && <button type="button" className="hz-btn primary" disabled={busy} onClick={() => void run(() => api.post(`/size-tables/${t.id}/activate`), `${t.name} es la tabla activa`)}><i className="bi bi-check2-circle" />Activar</button>}
          </>
        }
      />
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button type="button" className="hz-btn" disabled={busy} onClick={() => void run(async () => { const c = await api.post<SizeTableGrid>(`/size-tables/${t.id}/duplicate`, {}); onPick(c.id); }, 'Copia creada: ya podés editarla')}><i className="bi bi-copy" />Duplicar</button>
        <button type="button" className="hz-btn" onClick={() => setModal('new')}><i className="bi bi-plus-lg" />Nueva tabla</button>
        <button type="button" className="hz-btn" onClick={() => setModal('edit')}><i className="bi bi-pencil" />Renombrar</button>
        {isTemplate && <button type="button" className="hz-btn" onClick={() => setConfirm('restore')}><i className="bi bi-arrow-counterclockwise" />Restaurar</button>}
        {!isTemplate && <button type="button" className="hz-btn" disabled={t.isActive} title={t.isActive ? 'Activá otra tabla antes de eliminarla' : undefined} onClick={() => setConfirm('delete')}><i className="bi bi-trash3" />Eliminar tabla</button>}
      </div>
      {error && <div className="hz-notice danger mb-3" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {!t.isActive && <div className="hz-notice warning mb-3"><i className="bi bi-info-circle" />Esta tabla no está activa: las sugerencias de talle usan la activa de su rango. Podés editarla y activarla cuando esté lista.</div>}

      <div className="hz-card hz-grid-wrap">
        <table className="hz-size-grid">
          <caption className="visually-hidden">Valores de la tabla {t.name} en centímetros</caption>
          <thead><tr><th scope="col">Talle</th>{columns.map((c) => <th key={c.key} scope="col">{c.name}</th>)}<th aria-label="Acciones" /></tr></thead>
          <tbody>
            {t.sizes.map((s) => (
              <tr key={s.id}>
                <th scope="row"><span className="label">{s.label}</span>{s.descriptor && <span className="small text-secondary">{s.descriptor}</span>}</th>
                {columns.map((c) => <td key={c.key}><Cell label={s.label} measure={c.name} value={s.values[c.key]?.value} origin={s.values[c.key]?.origin} onSave={(v) => save(s.label, c.key, v)} /></td>)}
                <td>{!isTemplate && <button type="button" className="hz-icon-btn danger" aria-label={`Quitar el talle ${s.label}`} onClick={() => setConfirm({ size: s.label, id: s.id })}><i className="bi bi-trash3" /></button>}</td>
              </tr>
            ))}
            {t.sizes.length === 0 && <tr><td colSpan={columns.length + 2} className="text-secondary p-4">Todavía no tiene talles. Agregá el primero abajo.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="d-flex flex-wrap gap-4 hz-legend mt-3" aria-label="Referencias">
        <span><span className="hz-cell-mark plain" />Fuente</span>
        <span><span className="hz-cell-mark">≈</span>Interpolado</span>
        <span><i className="bi bi-exclamation-triangle hz-cell-mark" />Extrapolado</span>
        <span><i className="bi bi-pencil-fill hz-cell-mark" />Editado a mano</span>
      </div>

      <div className="row g-3 mt-2">
        <div className="col-12 col-lg-6">
          <div className="hz-card hz-panel">
            <h2 className="hz-panel-title">Agregar un talle</h2>
            <div className="d-flex flex-wrap gap-2">
              <input className="hz-input" style={{ flex: '1 1 120px' }} aria-label="Nombre del talle" placeholder="Talle, por ejemplo 60" value={newSize.label} onChange={(e) => setNewSize({ ...newSize, label: e.target.value })} />
              <input className="hz-input" style={{ flex: '1 1 120px' }} aria-label="Descripción del talle" placeholder="Descripción (opcional)" value={newSize.descriptor} onChange={(e) => setNewSize({ ...newSize, descriptor: e.target.value })} />
              <button type="button" className="hz-btn" disabled={busy} onClick={() => void addSize()}><i className="bi bi-plus-lg" />Talle</button>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="hz-card hz-panel">
            <h2 className="hz-panel-title">Agregar una medida a la tabla</h2>
            <div className="d-flex flex-wrap gap-2">
              <select className="hz-input" style={{ flex: '1 1 200px' }} aria-label="Medida a agregar" defaultValue="" onChange={(e) => { if (e.target.value) { setExtra((x) => [...x, e.target.value]); e.target.value = ''; } }}>
                <option value="">Elegí una medida…</option>
                {available.map((d) => <option key={d.id} value={d.key}>{d.name}</option>)}
              </select>
            </div>
            <span className="small text-secondary">La columna nueva queda vacía: tocá una celda para cargar el valor de cada talle.</span>
          </div>
        </div>
      </div>

      <TableFormModal show={modal !== null} table={modal === 'edit' ? t : undefined} onClose={() => setModal(null)} onSaved={(id) => { refresh(); onPick(id); }} />
      <ConfirmDialog show={confirm === 'restore'} title="Restaurar la tabla" confirmLabel="Restaurar" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void run(() => api.post(`/size-tables/${t.id}/restore`), 'Tabla restaurada a los valores originales')}
        body={<p className="mb-0">Todos los valores de <strong>{t.name}</strong> vuelven a los originales y se pierden tus ediciones. Los talles que asignaste a mano no cambian.</p>} />
      <ConfirmDialog show={confirm === 'delete'} title="Eliminar la tabla" confirmLabel="Eliminar tabla" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void run(async () => { await api.delete(`/size-tables/${t.id}`); onPick(list.data?.find((x) => x.isActive)?.id ?? ''); }, 'Tabla eliminada')}
        body={<p className="mb-0">Se elimina <strong>{t.name}</strong>. Las bailarinas que la tenían elegida vuelven a usar la tabla activa de su rango.</p>} />
      <ConfirmDialog show={typeof confirm === 'object' && confirm !== null} title={`Quitar el talle ${typeof confirm === 'object' && confirm ? confirm.size : ''}`} confirmLabel="Quitar talle" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => typeof confirm === 'object' && confirm && void run(() => api.delete(`/size-tables/${t.id}/sizes/${confirm.id}`), 'Talle quitado')}
        body={<p className="mb-0">Se quita el talle con todos sus valores. Si alguna bailarina lo tiene asignado a mano, se conserva ese talle.</p>} />
    </>
  );
}
