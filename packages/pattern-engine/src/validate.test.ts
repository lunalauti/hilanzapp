import { describe, expect, it } from 'vitest';
import { validateFormulaSet } from './validate';
import type { MoldDefinition } from './types';

const base: MoldDefinition = {
  key: 'm', name: 'M', category: 'otro', sizePriority: 'pecho',
  inputs: [{ key: 'pecho', label: 'Pecho', source: 'measure' }],
  formulas: [{ key: 'a', label: 'A', operandA: 'pecho', op: 'div', operandB: '4' }],
};
const withFormulas = (formulas: MoldDefinition['formulas']): MoldDefinition => ({ ...base, formulas });

describe('validateFormulaSet', () => {
  it('acepta un set válido', () => {
    expect(validateFormulaSet(base)).toEqual([]);
  });
  it('detecta referencia inexistente', () => {
    const e = validateFormulaSet(withFormulas([{ key: 'a', label: 'A', operandA: 'nada', op: 'direct' }]));
    expect(e).toEqual([{ formulaKey: 'a', reason: 'UNKNOWN_REFERENCE', detail: 'nada' }]);
  });
  it('detecta división por cero', () => {
    const e = validateFormulaSet(withFormulas([{ key: 'a', label: 'A', operandA: 'pecho', op: 'div', operandB: '0' }]));
    expect(e.map((x) => x.reason)).toEqual(['DIVISION_BY_ZERO']);
  });
  it('detecta ciclos', () => {
    const e = validateFormulaSet(withFormulas([
      { key: 'a', label: 'A', operandA: 'b', op: 'direct' },
      { key: 'b', label: 'B', operandA: 'a', op: 'direct' },
    ]));
    expect(e.some((x) => x.reason === 'CYCLE')).toBe(true);
  });
  it('detecta claves duplicadas, operando faltante e inválido', () => {
    const dup = validateFormulaSet(withFormulas([
      { key: 'a', label: 'A', operandA: 'pecho', op: 'direct' },
      { key: 'a', label: 'A2', operandA: 'pecho', op: 'direct' },
    ]));
    expect(dup.map((x) => x.reason)).toContain('DUPLICATE_KEY');
    expect(validateFormulaSet(withFormulas([{ key: 'a', label: 'A', operandA: 'pecho', op: 'mul' }])).map((x) => x.reason)).toEqual(['MISSING_OPERAND']);
    expect(validateFormulaSet(withFormulas([{ key: 'a', label: 'A', operandA: 'pecho', op: 'mul', operandB: '3 x' }])).map((x) => x.reason)).toEqual(['INVALID_OPERAND']);
  });
});
