import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DesignFormModal } from '../../components/designs/DesignFormModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useDesigns } from '../../lib/queries';
import { plural } from '../../lib/format';

const VIEW_KEY = 'hz-designs-view';
type View = 'grid' | 'list';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
function saveView(v: View) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* modo privado o storage bloqueado: se ignora */ }
}

export function DesignsList() {
  const { data, isLoading, error, refetch } = useDesigns();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(loadView);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    return (data ?? []).filter((d) => !needle || fold(d.name).includes(needle));
  }, [data, query]);

  function pickView(v: View) {
    setView(v);
    saveView(v);
  }

  return (
    <>
      <PageHeader
        eyebrow="Taller"
        title="Diseños"
        actions={
          <>
            <label className="hz-search hz-search-fixed">
              <i className="bi bi-search" />
              <input type="search" placeholder="Buscar diseño" aria-label="Buscar diseño" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="hz-segmented" role="group" aria-label="Vista">
              <button type="button" className={`hz-seg-btn ${view === 'grid' ? 'active' : ''}`} aria-pressed={view === 'grid'} aria-label="Vista en cuadrícula" onClick={() => pickView('grid')}><i className="bi bi-grid-3x3-gap" /></button>
              <button type="button" className={`hz-seg-btn ${view === 'list' ? 'active' : ''}`} aria-pressed={view === 'list'} aria-label="Vista en lista" onClick={() => pickView('list')}><i className="bi bi-list-ul" /></button>
            </div>
            <button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo diseño</button>
          </>
        }
      />
      {isLoading && <Loading rows={3} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon="bi-brush" title="Todavía no hay diseños" note="Un diseño junta las prendas, el escote, la manga, la falda y las fotos de referencia de un vestuario." action={<button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Crear diseño</button>} />
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <EmptyState icon="bi-search" title="Ningún diseño coincide" note={`No hay diseños con “${query.trim()}”.`} />
      )}

      {filtered.length > 0 && view === 'grid' && (
        <div className="hz-grid">
          {filtered.map((d) => {
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
      )}

      {filtered.length > 0 && view === 'list' && (
        <div className="hz-list">
          {filtered.map((d) => (
            <Link key={d.id} to={`/disenos/${d.id}`} className="hz-row">
              <span className="avatar" aria-hidden="true"><i className="bi bi-brush" /></span>
              <span className="who"><span>{d.name}</span></span>
              <span className="vest d-none d-lg-block">{d.garments.length ? d.garments.map((g) => g.moldName).join(' · ') : 'Sin prendas'}</span>
              <span className="small text-secondary text-end">{plural(d.images.length, 'imagen', 'imágenes')}</span>
            </Link>
          ))}
        </div>
      )}

      <DesignFormModal show={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/disenos/${id}`)} />
    </>
  );
}
