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
  id: string; name: string; age: number | null; notes: string | null; contact?: string | null; groupId: string;
  measureStatus: MeasureStatus; requiredDone: number; requiredTotal: number;
  size: SizeInfo; garments: Garment[];
}

export interface Dancer {
  id: string; group_id: string; name: string; age: number | null; measured_on: string | null;
  manual_size_label: string | null; size_table_id: string | null; notes: string | null; contact?: string | null;
}

export interface MeasureItem {
  definitionId: string; key: string; name: string; isBase: boolean; required: boolean;
  valueCm: number | null; note: string | null; takenOn: string | null; versionId: string | null;
}

export interface MeasureVersion { id: string; definitionId: string; valueCm: number; note: string | null; takenOn: string; isCurrent: boolean; createdAt: string }
export interface CompareRow { definitionId: string; key: string; name: string; from: number | null; to: number | null; diff: number | null }

export interface MeasureSize { measureKey: string; value: number; sizeLabel: string; reference: number; outOfRange: 'below' | 'above' | null }
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
export type Op = 'direct' | 'div' | 'mul' | 'add' | 'sub';
export interface MoldFormula { key: string; label: string; section?: string; operandA: string; op: Op; operandB?: string; adjustmentCm?: number; decimals?: number }
export interface Mold {
  id: string; key: string; name: string; category: string; sizePriority: Priority; templateKey?: string | null;
  inputs: MoldInput[]; formulas: (MoldFormula & { original: MoldFormula | null })[];
}

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

export interface CatalogOption { id: string; category: 'neckline' | 'sleeve' | 'skirt'; label: string; isCustom: boolean }
export interface MeasureDef { id: string; key: string; name: string; kind: 'body' | 'standard'; isBase: boolean; required: boolean }
export interface DesignImage { id: string; filename: string; mime: string; sizeBytes: number; url: string | null }
export interface Design {
  id: string; name: string; notes: string | null; constructionDetails: string | null;
  neckline: { id: string; label: string; isCustom: boolean } | null; sleeve: { id: string; label: string; isCustom: boolean } | null; skirt: { id: string; label: string; isCustom: boolean } | null;
  hasRuffle: boolean; isAsymmetric: boolean; createdAt: string;
  garments: { id: string; moldTypeId: string; moldKey: string; moldName: string; laborCost: number | null }[];
  specialMeasures: { definitionId: string; key: string; name: string }[];
  images: DesignImage[];
}

export type AgeRange = 'bebe' | 'nino' | 'adolescente' | 'mujer' | 'otro';
export type ValueOrigin = 'source' | 'interpolated' | 'extrapolated' | 'user';
export interface SizeTableSummary { id: string; name: string; ageRange: AgeRange; source: string | null; isActive: boolean; baseTableId: string | null; templateKey: string | null; sizeCount: number }
export interface SizeTableGrid {
  id: string; name: string; ageRange: AgeRange; source: string | null; isActive: boolean; baseTableId: string | null; templateKey: string | null;
  measures: { definitionId: string; key: string; name: string }[];
  sizes: { id: string; label: string; descriptor: string | null; sort: number; values: Record<string, { value: number; origin: ValueOrigin }> }[];
}

export interface Material { id: string; name: string; description: string | null; unit: string; unitCost: number; stockQty: number }
export interface MaterialCostRow { materialId: string; name: string; description: string | null; unit: string; unitCost: number; stock: number; need: number; remaining: number; shortfall: number; cost: number }
export interface Costs {
  dancerCount: number; totalUnits: number; unassignedUnits: number;
  materials: MaterialCostRow[]; shortages: { materialId: string; name: string; unit: string; shortfall: number }[];
  materialsCost: number; laborCost: number; totalCost: number; costPerDancer: number;
  perGarment: { designId: string; designName: string; moldTypeId: string; moldName: string; units: number; materialsCost: number; laborCost: number }[];
  consumption: { materialId: string; name: string; unit: string; byGarment: { designName: string; moldName: string; sizes: { label: string; quantity: number }[] }[] }[];
}
export interface ConsumptionRule { id: string; designGarmentId: string; designId: string; designName: string; moldTypeId: string; moldName: string; materialId: string; sizeLabel: string | null; quantity: number }
export interface StockMovement { id: string; delta: number; reason: 'manual' | 'production'; note: string | null; groupId: string | null; designId: string | null; createdAt: string }
export interface Stats {
  groups: number; dancers: number; totalCost: number;
  dancersBySize: { label: string; count: number }[];
  garmentsBySize: { moldName: string; total: number; sizes: { label: string; count: number }[] }[];
  costByGroup: { groupId: string; name: string; dancers: number; units: number; materialsCost: number; laborCost: number; totalCost: number }[];
}
