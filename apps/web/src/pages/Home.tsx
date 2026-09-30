import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SetupBanner } from '../components/SetupBanner';
import { GroupCategoryModal } from '../components/GroupCategoryModal';
import { GroupFormModal } from '../components/GroupFormModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/apiClient';
import { keys, useGroupCategories, useGroups } from '../lib/queries';
import { plural } from '../lib/format';
import type { Group } from '../lib/types';

const NO_CATEGORY = '__sin_categoria__';
const COLLAPSE_KEY = 'hz-home-collapsed-categories';

function loadCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]') as string[]); }
  catch { return new Set(); }
}
function saveCollapsed(s: Set<string>) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s])); } catch { /* modo privado o storage bloqueado: se ignora */ }
}

function GroupCard({ g }: { g: Group }) {
  const donePct = g.dancerCount ? Math.round((g.complete / g.dancerCount) * 100) : 0;
  const partPct = g.dancerCount ? Math.round((g.partial / g.dancerCount) * 100) : 0;
  return (
    <Link to={`/groups/${g.id}`} className={`hz-card hz-group-card ${g.archived_at ? 'archived' : ''}`}>
      <div className="d-flex align-items-baseline justify-content-between gap-2">
        <span className="name">{g.name}{g.archived_at && <span className="hz-archived-badge">Archivado</span>}</span>
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
}

function CategorySection({ id, name, items, onArchiveAll }: { id: string; name: string; items: Group[]; onArchiveAll?: (id: string, name: string, items: Group[]) => void }) {
  const [collapsedSet, setCollapsedSet] = useState(loadCollapsed);
  const collapsed = collapsedSet.has(id);
  const activeCount = items.filter((g) => !g.archived_at).length;

  function toggle() {
    setCollapsedSet((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsed(next);
      return next;
    });
  }

  return (
    <section className="hz-group-category" aria-label={name}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <button type="button" className="hz-category-toggle" aria-expanded={!collapsed} onClick={toggle}>
          <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-down'}`} aria-hidden />
          <h2 className="hz-group-category-title mb-0">{name}<span className="small text-secondary fw-normal">{plural(items.length, 'grupo', 'grupos')}</span></h2>
        </button>
        {onArchiveAll && activeCount > 0 && (
          <button type="button" className="hz-btn" onClick={() => onArchiveAll(id, name, items)}><i className="bi bi-archive" />Archivar todos</button>
        )}
      </div>
      {!collapsed && <div className="hz-grid">{items.map((g) => <GroupCard key={g.id} g={g} />)}</div>}
    </section>
  );
}

export function Home() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: groups, isLoading, error, refetch } = useGroups(showArchived);
  const categories = useGroupCategories();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [archivingCategory, setArchivingCategory] = useState<{ id: string; name: string; items: Group[] } | null>(null);
  const [archivingBusy, setArchivingBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const filtered = useMemo(() => (groups ?? []).filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase())), [groups, query]);
  const dancers = (groups ?? []).reduce((n, g) => n + g.dancerCount, 0);
  const pending = (groups ?? []).reduce((n, g) => n + g.partial + g.none, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, Group[]>();
    for (const g of filtered) {
      const key = g.category_id ?? NO_CATEGORY;
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return map;
  }, [filtered]);
  const hasCategories = (categories.data?.length ?? 0) > 0;

  async function archiveCategory() {
    if (!archivingCategory) return;
    const active = archivingCategory.items.filter((g) => !g.archived_at);
    setArchivingBusy(true);
    try {
      await Promise.all(active.map((g) => api.patch(`/groups/${g.id}`, { archived: true })));
      await qc.invalidateQueries({ queryKey: keys.groups });
      toast.show(`${plural(active.length, 'grupo archivado', 'grupos archivados')} en ${archivingCategory.name}`);
      setArchivingCategory(null);
    } finally {
      setArchivingBusy(false);
    }
  }

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
            <button type="button" className="hz-btn" onClick={() => setManagingCategories(true)}><i className="bi bi-tags" />Categorías</button>
            <button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo grupo</button>
          </>
        }
      />

      <SetupBanner />
      {isLoading && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {groups && groups.length === 0 && !showArchived && (
        <EmptyState icon="bi-people" title="Empezá creando tu primer grupo" note="Un grupo reúne a las bailarinas que comparten vestuario, como Ágata o Jade." action={<button type="button" className="hz-btn primary" onClick={() => setCreating(true)}><i className="bi bi-plus-lg" />Nuevo grupo</button>} />
      )}

      {groups && (groups.length > 0 || showArchived) && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div className="hz-stats mb-0">
              <div className="hz-stat"><strong>{groups.length}</strong><span>grupos</span></div>
              <div className="hz-stat"><strong>{dancers}</strong><span>bailarinas</span></div>
              {pending > 0 && <div className="hz-stat warn"><strong>{pending}</strong><span>con medidas pendientes</span></div>}
            </div>
            <button type="button" className={`hz-pill ${showArchived ? 'active' : ''}`} aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}><i className="bi bi-archive" />Ver archivados</button>
          </div>

          {filtered.length === 0 && <EmptyState icon="bi-search" title="Ningún grupo coincide" note={`No hay grupos con “${query}”.`} />}

          {filtered.length > 0 && !hasCategories && (
            <div className="hz-grid">{filtered.map((g) => <GroupCard key={g.id} g={g} />)}</div>
          )}

          {filtered.length > 0 && hasCategories && (
            <>
              {categories.data!.map((c) => {
                const items = byCategory.get(c.id);
                if (!items?.length) return null;
                return <CategorySection key={c.id} id={c.id} name={c.name} items={items} onArchiveAll={(id, name, catItems) => setArchivingCategory({ id, name, items: catItems })} />;
              })}
              {byCategory.get(NO_CATEGORY)?.length ? (
                <CategorySection id={NO_CATEGORY} name="Sin categoría" items={byCategory.get(NO_CATEGORY)!} />
              ) : null}
            </>
          )}
        </>
      )}

      <GroupFormModal show={creating} onClose={() => setCreating(false)} />
      <GroupCategoryModal show={managingCategories} onClose={() => setManagingCategories(false)} />
      <ConfirmDialog
        show={archivingCategory !== null}
        title={`Archivar los grupos de ${archivingCategory?.name ?? ''}`}
        confirmLabel="Archivar todos"
        busyLabel="Archivando…"
        busy={archivingBusy}
        onCancel={() => setArchivingCategory(null)}
        onConfirm={() => void archiveCategory()}
        body={<p className="mb-0">Se van a archivar {plural(archivingCategory?.items.filter((g) => !g.archived_at).length ?? 0, 'grupo', 'grupos')} de esta categoría. Podés desarchivarlos de a uno después, desde cada grupo.</p>}
      />
    </>
  );
}
