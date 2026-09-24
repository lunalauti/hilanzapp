import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './apiClient';
import type {
  AssignmentView, CompareRow, Dancer, Group, GroupDancer, MeasureItem, MeasureVersion, Mold, Production, Sizing,
} from './types';

export const keys = {
  groups: ['groups'] as const,
  groupDancers: (id: string) => ['group-dancers', id] as const,
  production: (id: string) => ['production', id] as const,
  dancer: (id: string) => ['dancer', id] as const,
  measurements: (id: string) => ['measurements', id] as const,
  history: (id: string, def: string) => ['history', id, def] as const,
  sizing: (id: string, mold?: string) => ['sizing', id, mold ?? 'general'] as const,
  assignments: (id: string) => ['assignments', id] as const,
  molds: ['molds'] as const,
};

export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: () => api.get<Group[]>('/groups') });
export const useGroupDancers = (id: string) => useQuery({ queryKey: keys.groupDancers(id), queryFn: () => api.get<GroupDancer[]>(`/groups/${id}/dancers`), enabled: Boolean(id) });
export const useProduction = (id: string) => useQuery({ queryKey: keys.production(id), queryFn: () => api.get<Production>(`/groups/${id}/production`) });
export const useDancer = (id: string) => useQuery({ queryKey: keys.dancer(id), queryFn: () => api.get<Dancer>(`/dancers/${id}`), enabled: Boolean(id) });
export const useMeasurements = (id: string) => useQuery({ queryKey: keys.measurements(id), queryFn: () => api.get<MeasureItem[]>(`/dancers/${id}/measurements`), enabled: Boolean(id) });
export const useHistory = (id: string, def: string | null) =>
  useQuery({ queryKey: keys.history(id, def ?? ''), queryFn: () => api.get<MeasureVersion[]>(`/dancers/${id}/measurements/${def}/history`), enabled: Boolean(def) });
export const useSizing = (id: string, mold?: string) =>
  useQuery({ queryKey: keys.sizing(id, mold), queryFn: () => api.get<Sizing>(`/dancers/${id}/sizing${mold ? `?mold_type_id=${mold}` : ''}`) });
export const useAssignments = (id: string) => useQuery({ queryKey: keys.assignments(id), queryFn: () => api.get<AssignmentView[]>(`/dancers/${id}/assignments`) });
export const useMolds = () => useQuery({ queryKey: keys.molds, queryFn: () => api.get<Mold[]>('/mold-types'), staleTime: 5 * 60_000 });
export const useCompare = (id: string, from: string, to: string, enabled: boolean) =>
  useQuery({ queryKey: ['compare', id, from, to], queryFn: () => api.get<CompareRow[]>(`/dancers/${id}/measurements/compare?from=${from}&to=${to}`), enabled });

/** Cualquier cambio de medidas, talles o prendas invalida lo que depende de ellos. */
export function useInvalidateDancerData() {
  const qc = useQueryClient();
  return (dancerId?: string, groupId?: string) => {
    const all = ['groups', 'group-dancers', 'production'];
    for (const k of all) void qc.invalidateQueries({ queryKey: [k] });
    if (dancerId) for (const k of ['dancer', 'measurements', 'history', 'sizing', 'assignments', 'compare']) void qc.invalidateQueries({ queryKey: [k, dancerId] });
    void groupId;
  };
}

export function useApiMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, onSuccess?: (result: TResult, vars: TVars) => void) {
  return useMutation({ mutationFn: fn, onSuccess });
}

export interface CalcRequest {
  dancerId: string; moldTypeId: string; manualInputs: Record<string, number>; choices: Record<string, string>; designId?: string;
}
export const useCalculation = (req: CalcRequest | null) =>
  useQuery({
    queryKey: ['calculation', req],
    queryFn: () => api.post<import('./types').Calculation>('/calculations', req),
    enabled: req !== null,
    retry: false,
    placeholderData: (prev) => prev,
  });

export const useDesigns = () => useQuery({ queryKey: ['designs'], queryFn: () => api.get<import('./types').Design[]>('/designs') });
export const useDesign = (id: string) => useQuery({ queryKey: ['design', id], queryFn: () => api.get<import('./types').Design>(`/designs/${id}`), enabled: Boolean(id) });
export const useCatalog = () => useQuery({ queryKey: ['catalog'], queryFn: () => api.get<import('./types').CatalogOption[]>('/catalog-options'), staleTime: 60_000 });
export const useMeasureDefs = () => useQuery({ queryKey: ['measure-defs'], queryFn: () => api.get<import('./types').MeasureDef[]>('/measure-definitions'), staleTime: 60_000 });

export function useInvalidateDesigns() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['designs'] });
    if (id) void qc.invalidateQueries({ queryKey: ['design', id] });
    void qc.invalidateQueries({ queryKey: ['catalog'] });
    void qc.invalidateQueries({ queryKey: ['measure-defs'] });
  };
}

export const useSizeTables = () => useQuery({ queryKey: ['size-tables'], queryFn: () => api.get<import('./types').SizeTableSummary[]>('/size-tables') });
export const useSizeTable = (id: string) => useQuery({ queryKey: ['size-table', id], queryFn: () => api.get<import('./types').SizeTableGrid>(`/size-tables/${id}`), enabled: Boolean(id) });

export const useMaterials = () => useQuery({ queryKey: ['materials'], queryFn: () => api.get<import('./types').Material[]>('/materials') });
export const useCosts = (groupId: string, designId: string) =>
  useQuery({ queryKey: ['costs', groupId, designId], queryFn: () => api.get<import('./types').Costs>(`/groups/${groupId}/costs${designId ? `?design_id=${designId}` : ''}`), enabled: Boolean(groupId) });
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<import('./types').Stats>('/stats') });
export const useConsumptionRules = (designId: string) =>
  useQuery({ queryKey: ['consumption', designId], queryFn: () => api.get<import('./types').ConsumptionRule[]>(`/consumption-rules?designId=${designId}`), enabled: Boolean(designId) });
export const useMovements = (materialId: string) =>
  useQuery({ queryKey: ['movements', materialId], queryFn: () => api.get<import('./types').StockMovement[]>(`/materials/${materialId}/movements`), enabled: Boolean(materialId) });

export function useInvalidateInventory() {
  const qc = useQueryClient();
  return () => { for (const k of ['materials', 'costs', 'stats', 'consumption', 'movements']) void qc.invalidateQueries({ queryKey: [k] }); };
}
