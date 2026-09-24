export type Op = 'direct' | 'div' | 'mul' | 'add' | 'sub';
export type InputSource = 'measure' | 'standard' | 'manual' | 'choice';
export type SizePriority = 'pecho' | 'cadera' | 'both';
export type AgeRange = 'bebe' | 'nino' | 'adolescente' | 'mujer' | 'otro';
export type ValueOrigin = 'source' | 'interpolated' | 'extrapolated' | 'user';

export interface ChoiceOption {
  id: string;
  label: string;
  value: number;
}

export interface MoldInput {
  key: string;
  label: string;
  source: InputSource;
  /** Clave de la medida corporal o del estándar de la tabla de talles; por defecto igual a `key`. */
  measureKey?: string;
  options?: ChoiceOption[];
  defaultOptionId?: string;
  required?: boolean;
}

export interface Formula {
  key: string;
  label: string;
  section?: string;
  /** Clave de un input o de otra fórmula del mismo molde. */
  operandA: string;
  op: Op;
  /** Constante ("0,15", "2/3") o clave de un input/fórmula. */
  operandB?: string;
  adjustmentCm?: number;
  decimals?: number;
}

export interface MoldDefinition {
  key: string;
  name: string;
  category: 'cuerpo' | 'manga' | 'pantalon' | 'falda' | 'vestido' | 'otro';
  sizePriority: SizePriority;
  inputs: MoldInput[];
  formulas: Formula[];
}

export interface CalcContext {
  /** Medidas corporales vigentes por clave, en cm. */
  measures: Record<string, number | undefined>;
  /** Valores estándar de la tabla de talles (altura de cadera, altura de tiro). */
  standards: Record<string, number | undefined>;
  /** Datos ingresados durante la construcción del molde (sisa dibujada, largo de canesú). */
  manual: Record<string, number | undefined>;
  /** Opción elegida por input de tipo `choice` (id de la opción). */
  choices: Record<string, string | undefined>;
}

export interface MissingItem {
  key: string;
  label: string;
  source: InputSource;
}

export interface CalcRow {
  key: string;
  label: string;
  section: string | null;
  realLabel: string | null;
  realValue: number | null;
  formula: string;
  result: number;
  display: string;
}

export type CalcResult = { ok: true; rows: CalcRow[] } | { ok: false; missing: MissingItem[] };

export type FormulaErrorReason =
  | 'DUPLICATE_KEY'
  | 'INVALID_OPERAND'
  | 'MISSING_OPERAND'
  | 'UNKNOWN_REFERENCE'
  | 'CYCLE'
  | 'DIVISION_BY_ZERO';

export interface FormulaError {
  formulaKey: string;
  reason: FormulaErrorReason;
  detail?: string;
}

export interface SizeRow {
  label: string;
  descriptor?: string;
  values: Record<string, number>;
  origins?: Record<string, ValueOrigin>;
}

export interface SizeTable {
  name: string;
  ageRange: AgeRange;
  source: string;
  sizes: SizeRow[];
}
