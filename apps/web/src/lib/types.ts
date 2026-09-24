export type MeasureStatus = 'none' | 'partial' | 'complete';
export type SizeOrigin = 'assignment' | 'dancer' | 'suggested' | null;
export type Priority = 'pecho' | 'cadera' | 'both';

export interface Group {
  id: string; name: string; created_at: string;
  dancerCount: number; complete: number; partial: number; none: number;
}

export interface SizeInfo { label: string | null; origin: SizeOrigin; suggested: string | null; manual: string | null; outOfRange: boolean }
export interface Garment { assignmentId: string; moldKey: string; moldName: string; designName: string | null; sizeLabel: string | null }

export interface GroupDancer {
  id: string; name: string; age: number | null; notes: string | null; groupId: string;
  measureStatus: MeasureStatus; requiredDone: number; requiredTotal: number;
  size: SizeInfo; garments: Garment[];
}

export interface Dancer {
  id: string; group_id: string; name: string; age: number | null; measured_on: string | null;
  manual_size_label: string | null; size_table_id: string | null; notes: string | null;
}

export interface MeasureItem {
  definitionId: string; key: string; name: string; isBase: boolean; required: boolean;
  valueCm: number | null; note: string | null; takenOn: string | null; versionId: string | null;
}

export interface MeasureVersion { id: string; definitionId: string; valueCm: number; note: string | null; takenOn: string; isCurrent: boolean; createdAt: string }
export interface CompareRow { definitionId: string; key: string; name: string; from: number | null; to: number | null; diff: number | null }

export interface MeasureSize { measureKey: string; value: number; sizeLabel: string; outOfRange: 'below' | 'above' | null }
export interface Sizing {
  table: { id: string; name: string; ageRange: string; forced: boolean } | null;
  mold: { id: string; key: string; name: string } | null;
  priority: Priority;
  perMeasure: MeasureSize[];
  components: { pecho: string | null; cadera: string | null };
  suggested: string | null; needsReview: boolean; outOfRange: boolean; missing: string[];
  manual: { assignment: string | null; dancer: string | null };
  effective: { label: string | null; origin: SizeOrigin };
  availableSizes: string[];
}

export interface AssignmentView {
  id: string; moldTypeId: string; moldKey: string; moldName: string; designId: string | null; designName: string | null;
  manualSizeLabel: string | null; suggested: string | null; effective: { label: string | null; origin: SizeOrigin }; needsReview: boolean;
}

export interface MoldInput {
  key: string; label: string; source: 'measure' | 'standard' | 'manual' | 'choice';
  measureKey?: string; options?: { id: string; label: string; value: number }[]; defaultOptionId?: string; required?: boolean;
}
export interface Mold { id: string; key: string; name: string; category: string; sizePriority: Priority; inputs: MoldInput[] }

export interface CalcRow { key: string; label: string; section: string | null; realLabel: string | null; realValue: number | null; formula: string; result: number; display: string }
export interface Calculation {
  dancer: { id: string; name: string; age: number | null };
  mold: { id: string; key: string; name: string; sizePriority: Priority };
  table: { id: string; name: string; ageRange: string } | null;
  size: { label: string | null; origin: SizeOrigin; suggested: string | null };
  inputs: { key: string; label: string; source: string; value: number | string | null }[];
  rows: CalcRow[];
  manualInputs: Record<string, number>;
  choices: Record<string, string>;
}

export interface MissingItem { key: string; label: string; source: string }

export interface ProductionSize { label: string; count: number; dancers: string[] }
export interface Production {
  dancerCount: number; totalUnits: number;
  byGarment: { moldKey: string; moldName: string; total: number; sizes: ProductionSize[] }[];
  pending: { dancerId: string; name: string; reason: 'no_assignment' | 'no_size'; moldNames: string[] }[];
}
