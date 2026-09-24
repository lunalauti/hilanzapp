import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, Loading } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { SizeChip } from '../../components/ui/SizeChip';
import { useDancer, useGroups, useSizing } from '../../lib/queries';
import { HistoryTab } from './HistoryTab';
import { MeasuresTab } from './MeasuresTab';
import { SizeTab } from './SizeTab';

const TABS = [{ id: 'medidas', label: 'Medidas' }, { id: 'talle', label: 'Talle' }, { id: 'historial', label: 'Historial' }] as const;
type TabId = (typeof TABS)[number]['id'];

export function DancerPage() {
  const { dancerId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as TabId | null) ?? 'medidas';
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initial) ? initial : 'medidas');
  const dancer = useDancer(dancerId);
  const groups = useGroups();
  const sizing = useSizing(dancerId);

  if (dancer.isLoading) return <Loading />;
  if (dancer.error || !dancer.data) return <ErrorState error={dancer.error ?? new Error('not found')} />;
  const d = dancer.data;
  const group = groups.data?.find((g) => g.id === d.group_id);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Grupos', to: '/' }, { label: group?.name ?? 'Grupo', to: `/groups/${d.group_id}` }, { label: d.name }]}
        title={d.name}
        subtitle={<>{d.age !== null ? `${d.age} años` : 'Sin edad'}{d.notes ? ` · ${d.notes}` : ''}</>}
        actions={
          <>
            {sizing.data && <SizeChip label={sizing.data.effective.label} origin={sizing.data.effective.origin} />}
            <Link to={`/moldes?dancer=${d.id}`} className="hz-btn primary"><i className="bi bi-scissors" />Hoja de molde</Link>
          </>
        }
      />
      <Tabs label="Secciones de la ficha" tabs={[...TABS]} value={tab} onChange={(t) => { setTab(t); setParams({ tab: t }, { replace: true }); }} />
      {tab === 'medidas' && <MeasuresTab dancerId={dancerId} />}
      {tab === 'talle' && <SizeTab dancerId={dancerId} />}
      {tab === 'historial' && <HistoryTab dancerId={dancerId} />}
    </>
  );
}
