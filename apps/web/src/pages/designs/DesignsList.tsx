import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DesignFormModal } from '../../components/designs/DesignFormModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useDesigns } from '../../lib/queries';
import { plural } from '../../lib/format';

export function DesignsList() {
  const { data, isLoading, error, refetch } = useDesigns();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow="Taller" title="Diseños" actions={<button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo diseño</button>} />
      {isLoading && <Loading rows={3} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon="bi-brush" title="Todavía no hay diseños" note="Un diseño junta las prendas, el escote, la manga, la falda y las fotos de referencia de un vestuario." action={<button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Crear diseño</button>} />
      )}
      <div className="hz-grid">
        {(data ?? []).map((d) => {
          const cover = d.images.find((i) => i.url);
          return (
            <Link key={d.id} to={`/disenos/${d.id}`} className="hz-card hz-design-card">
              <div className="hz-design-cover">{cover?.url ? <img src={cover.url} alt="" /> : <i className="bi bi-brush" />}</div>
              <div className="d-flex flex-column gap-1 p-3">
                <span className="name">{d.name}</span>
                <span className="small text-secondary">{d.garments.length ? d.garments.map((g) => g.moldName).join(' · ') : 'Sin prendas'}</span>
                <span className="small text-secondary">{plural(d.images.length, 'imagen', 'imágenes')}{d.hasRuffle ? ' · con volado' : ''}{d.isAsymmetric ? ' · asimétrico' : ''}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <DesignFormModal show={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/disenos/${id}`)} />
    </>
  );
}
