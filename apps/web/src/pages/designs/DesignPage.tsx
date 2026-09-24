import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AssignGroupModal } from '../../components/designs/AssignGroupModal';
import { DesignFormModal } from '../../components/designs/DesignFormModal';
import { ImageGallery } from '../../components/designs/ImageGallery';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, Loading } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { useDesign } from '../../lib/queries';

export function DesignPage() {
  const { designId = '' } = useParams();
  const { data: design, isLoading, error, refetch } = useDesign(designId);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  if (isLoading) return <Loading />;
  if (error || !design) return <ErrorState error={error ?? new Error('not found')} onRetry={() => void refetch()} />;

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/designs/${designId}?confirm=true`);
      await qc.invalidateQueries({ queryKey: ['designs'] });
      toast.show(`Diseño ${design!.name} eliminado`);
      navigate('/disenos');
    } catch (e) { toast.show(e instanceof ApiError ? e.message : 'No pudimos eliminar el diseño'); }
    finally { setBusy(false); setDeleting(false); }
  }

  const details = (design.constructionDetails ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const facts: [string, string][] = [
    ['Escote', design.neckline?.label ?? '—'], ['Manga', design.sleeve?.label ?? '—'], ['Falda', design.skirt?.label ?? '—'],
    ['Volado', design.hasRuffle ? 'Sí' : 'No'], ['Asimetría', design.isAsymmetric ? 'Sí' : 'No'],
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Diseños', to: '/disenos' }, { label: design.name }]}
        eyebrow={design.garments.map((g) => g.moldName).join(' · ') || 'Sin prendas'}
        title={design.name}
        actions={
          <>
            <button type="button" className="hz-btn" onClick={() => setAssigning(true)}><i className="bi bi-people" />Asignar a grupo</button>
            <button type="button" className="hz-btn primary" onClick={() => setEditing(true)}><i className="bi bi-pencil" />Editar</button>
            <button type="button" className="hz-icon-btn danger" aria-label="Eliminar diseño" onClick={() => setDeleting(true)}><i className="bi bi-trash3" /></button>
          </>
        }
      />
      <div className="row g-4">
        <div className="col-12 col-xl-6"><ImageGallery design={design} /></div>
        <div className="col-12 col-xl-6 d-flex flex-column gap-3">
          <section className="hz-card hz-panel" aria-label="Ficha técnica">
            <dl className="hz-facts">
              {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {design.notes && <p className="mb-0"><span className="hz-label d-block mb-1">Observaciones</span>{design.notes}</p>}
          </section>
          <section className="hz-card hz-panel" aria-label="Detalles de confección">
            <h2 className="hz-panel-title">Detalles de confección</h2>
            {details.length ? <ul className="hz-bullets">{details.map((d) => <li key={d}>{d}</li>)}</ul> : <span className="text-secondary">Sin detalles cargados.</span>}
          </section>
          <section className="hz-card hz-panel" aria-label="Medidas especiales">
            <h2 className="hz-panel-title">Medidas especiales</h2>
            {design.specialMeasures.length ? <div className="d-flex flex-wrap gap-2">{design.specialMeasures.map((m) => <span key={m.definitionId} className="hz-req hz-real"><i className="bi bi-rulers" />{m.name}</span>)}</div> : <span className="text-secondary">Este diseño no pide medidas extra.</span>}
            <span className="small text-secondary">Se piden en la ficha de cada bailarina con este diseño.</span>
          </section>
        </div>
      </div>

      <DesignFormModal show={editing} design={design} onClose={() => setEditing(false)} onSaved={() => undefined} />
      <AssignGroupModal show={assigning} design={design} onClose={() => setAssigning(false)} />
      <ConfirmDialog show={deleting} title={`Eliminar ${design.name}`} confirmLabel="Eliminar diseño" busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => void remove()}
        body={<p className="mb-0">Se van a eliminar el diseño, sus imágenes y las prendas que se asignaron a bailarinas con este diseño. No se puede deshacer.</p>} />
    </>
  );
}
