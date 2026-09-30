import { describe, expect, it } from 'vitest';
import { reorderById } from './reorder';

describe('reorderById', () => {
  it('mueve un elemento a la posición de otro, corriendo los del medio', () => {
    expect(reorderById(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderById(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
  });
  it('sin cambios si el origen y el destino son el mismo, o alguno no existe', () => {
    const list = ['a', 'b', 'c'];
    expect(reorderById(list, 'b', 'b')).toBe(list);
    expect(reorderById(list, 'x', 'a')).toBe(list);
    expect(reorderById(list, 'a', 'x')).toBe(list);
  });
});
