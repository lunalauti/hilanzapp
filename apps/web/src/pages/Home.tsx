import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SetupBanner } from '../components/SetupBanner';
import { GroupFormModal } from '../components/GroupFormModal';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { PageHeader } from '../components/ui/PageHeader';
import { useGroups } from '../lib/queries';
import { plural } from '../lib/format';

export function Home() {
  const { data: groups, isLoading, error, refetch } = useGroups();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => (groups ?? []).filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase())), [groups, query]);
  const dancers = (groups ?? []).reduce((n, g) => n + g.dancerCount, 0);
  const pending = (groups ?? []).reduce((n, g) => n + g.partial + g.none, 0);

  return (
    <>
      <PageHeader
        eyebrow="Buen día"
        title="Tus grupos"
        actions={
          <>
            <label className="hz-search hz-search-fixed">
              <i className="bi bi-search" />
              <input type="search" placeholder="Buscar grupo" aria-label="Buscar grupo" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo grupo</button>
          </>
        }
      />

      <SetupBanner />
      {isLoading && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {groups && groups.length === 0 && (
        <EmptyState icon="bi-people" title="Empezá creando tu primer grupo" note="Un grupo reúne a las bailarinas que comparten vestuario, como Ágata o Jade." action={<button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo grupo</button>} />
      )}

      {groups && groups.length > 0 && (
        <>
          <div className="hz-stats">
            <div className="hz-stat"><strong>{groups.length}</strong><span>grupos</span></div>
            <div className="hz-stat"><strong>{dancers}</strong><span>bailarinas</span></div>
            {pending > 0 && <div className="hz-stat warn"><strong>{pending}</strong><span>con medidas pendientes</span></div>}
          </div>
          {filtered.length === 0 && <EmptyState icon="bi-search" title="Ningún grupo coincide" note={`No hay grupos con “${query}”.`} />}
          <div className="hz-grid">
            {filtered.map((g) => {
              const donePct = g.dancerCount ? Math.round((g.complete / g.dancerCount) * 100) : 0;
              const partPct = g.dancerCount ? Math.round((g.partial / g.dancerCount) * 100) : 0;
              return (
                <Link key={g.id} to={`/groups/${g.id}`} className="hz-card hz-group-card">
                  <div className="d-flex align-items-baseline justify-content-between gap-2">
                    <span className="name">{g.name}</span>
                    <span className="meta">{plural(g.dancerCount, 'bailarina', 'bailarinas')}<i className="bi bi-chevron-right ms-1" /></span>
                  </div>
                  <div className="hz-progress" role="img" aria-label={`${donePct}% con medidas completas`}>
                    <i className="done" style={{ width: `${donePct}%` }} /><i className="part" style={{ width: `${partPct}%` }} />
                  </div>
                  <div className="d-flex justify-content-between small text-secondary">
                    <span>{g.dancerCount === 0 ? 'Sin bailarinas' : g.complete === 0 && g.partial === 0 ? 'Sin medidas cargadas' : `${plural(g.complete, 'completa', 'completas')}${g.partial ? ` · ${plural(g.partial, 'parcial', 'parciales')}` : ''}`}</span>
                    <strong className="text-body">{donePct} %</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <GroupFormModal show={creating} onClose={() => setCreating(false)} />
    </>
  );
}
