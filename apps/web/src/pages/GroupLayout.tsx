import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { BatchPdfModal } from '../components/BatchPdfModal';
import { GroupFormModal } from '../components/GroupFormModal';
import { ActionMenu } from '../components/ui/ActionMenu';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import { ErrorState, Loading } from '../components/ui/States';
import { api } from '../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useGroups } from '../lib/queries';
import { plural } from '../lib/format';

export function GroupLayout() {
  const { groupId = '' } = useParams();
  const { data: groups, isLoading, error, refetch } = useGroups();
  const group = groups?.find((g) => g.id === groupId);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!group) return <ErrorState error={new Error('not found')} />;

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/groups/${groupId}?confirm=true`);
      await qc.invalidateQueries({ queryKey: keys.groups });
      toast.show(`Grupo ${group!.name} eliminado`);
      navigate('/');
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Grupos', to: '/' }, { label: group.name }]}
        title={group.name}
        subtitle={`${plural(group.dancerCount, 'bailarina', 'bailarinas')} · ${group.complete} ${group.complete === 1 ? 'completa' : 'completas'}`}
        actions={
          <ActionMenu
            label="Más acciones del grupo"
            actions={[
              { label: 'Hojas de molde en PDF', icon: 'bi-file-earmark-pdf', onSelect: () => setPdf(true) },
              { label: 'Renombrar grupo', icon: 'bi-pencil', onSelect: () => setRenaming(true) },
              { label: 'Eliminar grupo', icon: 'bi-trash3', danger: true, onSelect: () => setDeleting(true) },
            ]}
          />
        }
      />
      <div className="hz-tabs" role="tablist" aria-label="Secciones del grupo">
        <NavLink end to={`/groups/${groupId}`} role="tab" className={({ isActive }) => `hz-tab d-flex align-items-center justify-content-center text-decoration-none ${isActive ? 'active' : ''}`}>Bailarinas</NavLink>
        <NavLink to={`/groups/${groupId}/production`} role="tab" className={({ isActive }) => `hz-tab d-flex align-items-center justify-content-center text-decoration-none ${isActive ? 'active' : ''}`}>Producción</NavLink>
      </div>
      <Outlet context={{ group }} />

      <BatchPdfModal show={pdf} groupId={groupId} onClose={() => setPdf(false)} />
      <GroupFormModal show={renaming} group={group} onClose={() => setRenaming(false)} />
      <ConfirmDialog
        show={deleting}
        title={`Eliminar el grupo ${group.name}`}
        confirmLabel="Eliminar grupo"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
        body={group.dancerCount > 0
          ? <p className="mb-0">Se van a eliminar <strong>{plural(group.dancerCount, 'bailarina', 'bailarinas')}</strong> con todas sus medidas, prendas y hojas de molde. No se puede deshacer.</p>
          : <p className="mb-0">El grupo está vacío. No se puede deshacer.</p>}
      />
    </>
  );
}
