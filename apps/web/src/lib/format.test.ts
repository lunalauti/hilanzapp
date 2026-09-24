import { describe, expect, it } from 'vitest';
import { formatCm, initials, parseDecimal, plural } from './format';

describe('parseDecimal', () => {
  it.each([['88', 88], ['88,5', 88.5], ['88.5', 88.5], ['  70 ', 70], ['0', 0]])('%s → %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
  it.each(['', 'abc', '-3', '8,8,8', '12 cm', '1e3', ','])('rechaza %j', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe('formato', () => {
  it('formatea con coma y guion para vacío', () => {
    expect(formatCm(88.5)).toBe('88,5');
    expect(formatCm(null)).toBe('—');
  });
  it('iniciales y plurales', () => {
    expect(initials('Martina López')).toBe('ML');
    expect(plural(1, 'bailarina', 'bailarinas')).toBe('1 bailarina');
    expect(plural(12, 'bailarina', 'bailarinas')).toBe('12 bailarinas');
  });
});
