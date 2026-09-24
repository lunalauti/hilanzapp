import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BatchPdfModal } from '../components/BatchPdfModal';
import { DancerFormModal } from '../components/DancerFormModal';
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
  const [batch, setBatch] = useState(false);
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
  const shown = filter === 'pending' ? pending : all;

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
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="hz-btn" onClick={() => setBatch(true)} disabled={all.length === 0}><i className="bi bi-file-earmark-pdf" />Hojas de molde en PDF</button>
          <button type="button" className="hz-btn primary" onClick={() => setEditing('new')}><i className="bi bi-person-plus" />Agregar bailarina</button>
        </div>
      </div>

      {all.length === 0 && <EmptyState icon="bi-person-plus" title="Este grupo no tiene bailarinas" note="Agregá la primera para cargar sus medidas." />}
      {all.length > 0 && shown.length === 0 && <EmptyState icon="bi-check2-circle" title="No hay pendientes" note="Todas las bailarinas tienen las medidas completas." />}

      {shown.length > 0 && (
        <div className="hz-list">
          <div className="hz-thead"><span /><span>Bailarina</span><span>Medidas</span><span>Talle efectivo</span><span>Vestuario</span><span style={{ textAlign: 'right' }}>Acciones</span></div>
          {shown.map((d) => (
            <div key={d.id} className="hz-row">
              <span className="avatar" aria-hidden="true">{initials(d.name)}</span>
              <span className="who">
                <Link to={`/dancers/${d.id}`}>{d.name}</Link>
                <span className="d-lg-none"><MeasureStatusLabel status={d.measureStatus} done={d.requiredDone} total={d.requiredTotal} /></span>
              </span>
              <span className="d-none d-lg-block"><MeasureStatusLabel status={d.measureStatus} done={d.requiredDone} total={d.requiredTotal} /></span>
              <span><SizeChip label={d.size.label} origin={d.size.origin} outOfRange={d.size.outOfRange} /></span>
              <span className="vest">{d.garments.length ? d.garments.map((g) => g.moldName).join(', ') : '—'}</span>
              <span className="d-none d-lg-flex justify-content-end gap-1">
                <button type="button" className="hz-icon-btn" aria-label={`Editar ${d.name}`} onClick={() => setEditing(d)}><i className="bi bi-pencil" /></button>
                <button type="button" className="hz-icon-btn danger" aria-label={`Eliminar ${d.name}`} onClick={() => setDeleting(d)}><i className="bi bi-trash3" /></button>
              </span>
              <span className="d-flex d-lg-none gap-1" style={{ gridColumn: '2 / -1' }}>
                <button type="button" className="hz-icon-btn" aria-label={`Editar ${d.name}`} onClick={() => setEditing(d)}><i className="bi bi-pencil" /></button>
                <button type="button" className="hz-icon-btn danger" aria-label={`Eliminar ${d.name}`} onClick={() => setDeleting(d)}><i className="bi bi-trash3" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <BatchPdfModal show={batch} groupId={groupId} onClose={() => setBatch(false)} />
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
