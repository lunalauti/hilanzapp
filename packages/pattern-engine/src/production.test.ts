import { describe, expect, it } from 'vitest';
import { aggregateProduction } from './production';

const dancers = ['Ana', 'Bea', 'Cami', 'Dani', 'Eli', 'Flor', 'Gala', 'Hebe', 'Ines', 'Juli'].map((name, i) => ({ id: String(i), name }));
const pant = (id: string, size: string | null) => ({ dancerId: id, moldKey: 'pantalon', moldName: 'Pantalón', sizeLabel: size });

describe('aggregateProduction', () => {
  it('cuenta por prenda y talle y lista nombres (ejemplo del Req 7)', () => {
    const assignments = [
      ...['0', '1', '2'].map((id) => pant(id, '8')),
      ...['3', '4', '5', '6'].map((id) => pant(id, '10')),
      ...['7', '8'].map((id) => pant(id, '12')),
      pant('9', '14'),
    ];
    const r = aggregateProduction({ dancers, assignments });
    expect(r.byGarment).toHaveLength(1);
    expect(r.byGarment[0]!.sizes.map((s) => [s.label, s.count])).toEqual([['8', 3], ['10', 4], ['12', 2], ['14', 1]]);
    expect(r.byGarment[0]!.sizes[1]!.dancers).toEqual(['Dani', 'Eli', 'Flor', 'Gala']);
    expect(r.byGarment[0]!.total).toBe(10);
    expect(r.pending).toEqual([]);
  });
  it('deja como pendientes a quien no tiene prenda o talle', () => {
    const r = aggregateProduction({ dancers: dancers.slice(0, 3), assignments: [pant('0', '10'), pant('1', null)] });
    expect(r.byGarment[0]!.total).toBe(1);
    expect(r.pending).toEqual([
      { dancerId: '1', name: 'Bea', reason: 'no_size', moldNames: ['Pantalón'] },
      { dancerId: '2', name: 'Cami', reason: 'no_assignment', moldNames: [] },
    ]);
  });
});
