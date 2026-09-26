import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DancerFormModal } from '../components/DancerFormModal';
import { ActionMenu } from '../components/ui/ActionMenu';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { MeasureStatusLabel } from '../components/ui/MeasureStatusLabel';
import { SizeChip } from '../components/ui/SizeChip';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/apiClient';
import { initials, plural } from '../lib/format';
import { useGroupDancers, useInvalidateDancerData } from '../lib/queries';
import type { Group } from '../lib/types';
import type { GroupDancer } from '../lib/types';

export function GroupDancers() {
  const { groupId = '' } = useParams();
  const groupName = useOutletContext<{ group?: Group } | undefined>()?.group?.name;
  const { data: dancers, isLoading, error, refetch } = useGroupDancers(groupId);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [editing, setEditing] = useState<GroupDancer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<GroupDancer | null>(null);
  const [garment, setGarment] = useState('');
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateDancerData();
  const toast = useToast();
  const impact = useQuery({
    queryKey: ['dancer-impact', deleting?.id],
    queryFn: () => api.get<{ measures: number; versions: number; assignments: number; sheets: number }>(`/dancers/${deleting!.id}/impact`),
    enabled: deleting !== null,
  });

  if (isLoading) return <Loading rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const all = dancers ?? [];
  const pending = all.filter((d) => d.measureStatus !== 'complete');
  const garmentCounts = new Map<string, number>();
  for (const d of all) for (const name of new Set(d.garments.map((g) => g.moldName))) garmentCounts.set(name, (garmentCounts.get(name) ?? 0) + 1);
  const byStatus = filter === 'pending' ? pending : all;
  const shown = garment ? byStatus.filter((d) => d.garments.some((g) => g.moldName === garment)) : byStatus;
  // Talle y vestuario recién aparecen cuando hay algo que mostrar.
  const showVest = all.some((d) => d.garments.length > 0);
  const showSize = showVest || all.some((d) => d.size.label !== null);
  const cols = ['40px', 'minmax(0, 2fr)', 'minmax(0, 1.4fr)', ...(showSize ? ['140px'] : []), ...(showVest ? ['minmax(0, 1.6fr)'] : []), '48px'].join(' ');

  async function remove(d: GroupDancer) {
    setBusy(true);
    try {
      await api.delete(`/dancers/${d.id}?confirm=true`);
      invalidate(d.id, groupId);
      toast.show(`${d.name} eliminada`);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="hz-filters mb-0">
          <button type="button" className={`hz-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas {all.length}</button>
          <button type="button" className={`hz-pill ${filter === 'pending' ? 'active' : 'warn'}`} onClick={() => setFilter('pending')}><i className="bi bi-circle-half" />Pendientes {pending.length}</button>
          {[...garmentCounts.entries()].map(([name, n]) => (
            <button key={name} type="button" className={`hz-pill ${garment === name ? 'active' : ''}`} aria-pressed={garment === name} onClick={() => setGarment(garment === name ? '' : name)}>{name} {n}</button>
          ))}
        </div>
        <button type="button" className="hz-btn primary hz-add" onClick={() => setEditing('new')}><i className="bi bi-person-plus" /><span className="hz-add-label">Agregar bailarina</span></button>
      </div>

      {pending.length > 0 && (
        <div className="hz-nextstep" role="region" aria-label="Siguiente paso">
          <i className="bi bi-rulers" aria-hidden="true" />
          <span className="flex-grow-1"><strong>{pending.length === 1 ? '1 bailarina con medidas pendientes' : `${pending.length} bailarinas con medidas pendientes`}</strong></span>
          <Link to={`/groups/${groupId}/faltantes`} className="hz-nextstep-link">Ver faltantes</Link>
          <Link to={`/groups/${groupId}/medir`} className="hz-btn primary">Tomar medidas<span className="d-none d-sm-inline">&nbsp;del grupo</span></Link>
        </div>
      )}

      {all.length === 0 && <EmptyState icon="bi-person-plus" title="Este grupo no tiene bailarinas" note="Agregá la primera para cargar sus medidas." />}
      {all.length > 0 && shown.length === 0 && <EmptyState icon="bi-check2-circle" title="No hay pendientes" note="Todas las bailarinas tienen las medidas completas." />}

      {shown.length > 0 && (
        <div className="hz-list" style={{ ['--hz-cols' as string]: cols }}>
          <div className="hz-thead"><span /><span>Bailarina</span><span>Medidas</span>{showSize && <span>Talle</span>}{showVest && <span>Vestuario</span>}<span /></div>
          {shown.map((d) => (
            <div key={d.id} className="hz-row">
              <span className="avatar" aria-hidden="true">{initials(d.name)}</span>
              <span className="who">
                <Link to={`/dancers/${d.id}`}>{d.name}</Link>
                <span className="d-lg-none sub"><MeasureStatusLabel status={d.measureStatus} done={d.requiredDone} total={d.requiredTotal} /></span>
              </span>
              <span className="d-none d-lg-block"><MeasureStatusLabel status={d.measureStatus} done={d.requiredDone} total={d.requiredTotal} /></span>
              {showSize && <span>{d.size.label ? <SizeChip label={d.size.label} origin={d.size.origin} outOfRange={d.size.outOfRange} /> : <span className="text-secondary">—</span>}</span>}
              {showVest && (
                <span className="vest d-none d-lg-block">{d.garments.length ? d.garments.map((g, i) => <span key={g.assignmentId}>{i > 0 && ', '}{g.moldName}</span>) : <span className="text-secondary">—</span>}</span>
              )}
              <ActionMenu
                className="hz-row-menu"
                label={`Acciones de ${d.name}`}
                actions={[
                  { label: 'Tomar medidas', icon: 'bi-rulers', to: `/dancers/${d.id}/medir?volver=${encodeURIComponent(`/groups/${groupId}`)}` },
                  { label: 'Editar', icon: 'bi-pencil', onSelect: () => setEditing(d) },
                  { label: 'Eliminar', icon: 'bi-trash3', danger: true, onSelect: () => setDeleting(d) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <DancerFormModal show={editing !== null} groupId={groupId} groupName={groupName} siblings={all} dancer={editing === 'new' ? undefined : (editing ?? undefined)} onClose={() => setEditing(null)} />
      <ConfirmDialog
        show={deleting !== null}
        title={`¿Borrar a ${deleting?.name ?? ''}?`}
        confirmLabel="Borrar para siempre"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
        body={
          <div className="d-flex flex-column gap-2">
            <p className="mb-0">Esto no se puede deshacer. Se pierden:</p>
            {impact.data ? (
              <ul className="mb-0">
                <li>{plural(impact.data.measures, 'medida', 'medidas')}</li>
                <li>{plural(impact.data.versions, 'toma de historial', 'tomas de historial')}</li>
                <li>{plural(impact.data.assignments, 'prenda asignada', 'prendas asignadas')}</li>
                {impact.data.sheets > 0 && <li>{plural(impact.data.sheets, 'hoja de molde guardada', 'hojas de molde guardadas')}</li>}
              </ul>
            ) : <span className="text-secondary">Calculando…</span>}
          </div>
        }
      />
    </>
  );
}
