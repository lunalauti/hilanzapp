import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('editor de moldes y fórmulas (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let dancerId: string;
  let groupId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};

  const chaleco = () => ({
    name: 'Chaleco',
    category: 'otro',
    sizePriority: 'pecho',
    inputs: [
      { key: 'pecho', label: 'Contorno de pecho', source: 'measure' },
      { key: 'ajuste', label: 'Ajuste extra', source: 'manual' },
    ],
    formulas: [
      { key: 'ancho_pecho', label: 'Ancho de pecho', operandA: 'pecho', op: 'div', operandB: '4', adjustmentCm: 0.5 },
      { key: 'con_ajuste', label: 'Con ajuste', operandA: 'ancho_pecho', op: 'add', operandB: 'ajuste' },
    ],
  });
  const calc = (moldId: string | undefined, manualInputs: Record<string, number> = {}) => A.post('/calculations', { dancerId, moldTypeId: moldId, manualInputs });

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;
    dancerId = (await A.post('/dancers', { groupId, name: 'Martina', age: 30 })).body.id;
    for (const [k, v] of Object.entries({ pecho: 88, cintura: 70, cadera: 92, cuello: 36, ancho_espalda: 40, ancho_hombro: 13.5, largo_delantero: 44, largo_trasero: 42, segunda_cintura: 80 })) await A.put(`/dancers/${dancerId}/measurements/${def[k]}`, { valueCm: v });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('crea un molde propio con medidas, datos manuales y fórmulas, y se puede calcular', async () => {
    const res = await A.post('/mold-types', chaleco());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ key: 'chaleco', name: 'Chaleco', sizePriority: 'pecho' });
    expect(res.body.formulas.map((f: { key: string }) => f.key)).toEqual(['ancho_pecho', 'con_ajuste']);
    mold.chaleco = res.body.id;

    const out = await calc(mold.chaleco, { ajuste: 2 });
    expect(out.status).toBe(200);
    expect(out.body.rows.map((r: { key: string; result: number }) => [r.key, r.result])).toEqual([['ancho_pecho', 22.5], ['con_ajuste', 24.5]]);
    expect(out.body.rows[0]).toMatchObject({ formula: '÷ 4 + 0,5', realValue: 88 });
    expect((await A.post('/mold-types', chaleco())).body.key).toBe('chaleco_2');
  });

  it('rechaza fórmulas con errores y explica cuáles', async () => {
    const bad = (formulas: object[], inputs?: object[]) => A.post('/mold-types', { ...chaleco(), formulas, ...(inputs ? { inputs } : {}) });
    const ref = await bad([{ key: 'x', label: 'X', operandA: 'no_existe', op: 'direct' }]);
    expect(ref.status).toBe(422);
    expect(ref.body.error).toMatchObject({ code: 'FORMULA_INVALID', details: { errors: [{ formulaKey: 'x', reason: 'UNKNOWN_REFERENCE', detail: 'no_existe' }] } });

    const zero = await bad([{ key: 'x', label: 'X', operandA: 'pecho', op: 'div', operandB: '0' }]);
    expect(zero.body.error.details.errors[0]).toMatchObject({ reason: 'DIVISION_BY_ZERO' });

    const cycle = await bad([{ key: 'a', label: 'A', operandA: 'b', op: 'direct' }, { key: 'b', label: 'B', operandA: 'a', op: 'direct' }]);
    expect(cycle.body.error.details.errors.some((e: { reason: string }) => e.reason === 'CYCLE')).toBe(true);

    const dup = await bad([{ key: 'pecho', label: 'X', operandA: 'pecho', op: 'direct' }]);
    expect(dup.body.error.details.errors[0]).toMatchObject({ reason: 'DUPLICATE_KEY' });

    const missingOp = await bad([{ key: 'x', label: 'X', operandA: 'pecho', op: 'mul' }]);
    expect(missingOp.body.error.details.errors[0]).toMatchObject({ reason: 'MISSING_OPERAND' });

    const unknownMeasure = await bad([{ key: 'x', label: 'X', operandA: 'foo', op: 'direct' }], [{ key: 'foo', label: 'Foo', source: 'measure', measureKey: 'medida_inexistente' }]);
    expect(unknownMeasure.body.error.details.extra[0]).toContain('medida_inexistente');

    const noOptions = await bad([{ key: 'x', label: 'X', operandA: 'v', op: 'direct' }], [{ key: 'v', label: 'Vuelo', source: 'choice' }]);
    expect(noOptions.body.error.details.extra[0]).toContain('al menos una opción');

    expect((await A.post('/mold-types', { ...chaleco(), name: ' ' })).status).toBe(422);
    expect((await A.post('/mold-types', { ...chaleco(), formulas: [] })).status).toBe(422);
    expect((await A.post('/mold-types', { ...chaleco(), inputs: [{ key: 'Mayús', label: 'x', source: 'measure' }] })).status).toBe(422);
  });

  it('un fallo de validación no toca lo guardado', async () => {
    const before = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === mold.chaleco);
    const res = await A.put(`/mold-types/${mold.chaleco}/formulas`, { formulas: [{ key: 'roto', label: 'Roto', operandA: 'nada', op: 'direct' }] });
    expect(res.status).toBe(422);
    const after = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === mold.chaleco);
    expect(after.formulas).toEqual(before.formulas);
  });

  it('edita una fórmula y los cambios se aplican a los cálculos nuevos', async () => {
    const res = await A.put(`/mold-types/${mold.chaleco}/formulas`, {
      formulas: [{ key: 'ancho_pecho', label: 'Ancho de pecho', operandA: 'pecho', op: 'div', operandB: '4', adjustmentCm: 1 }, { key: 'con_ajuste', label: 'Con ajuste', operandA: 'ancho_pecho', op: 'add', operandB: 'ajuste' }],
    });
    expect(res.status).toBe(200);
    expect((await calc(mold.chaleco, { ajuste: 2 })).body.rows[0].result).toBe(23);
  });

  it('cambia las medidas y datos manuales que pide el molde', async () => {
    const res = await A.put(`/mold-types/${mold.chaleco}/formulas`, {
      inputs: [{ key: 'pecho', label: 'Contorno de pecho', source: 'measure' }, { key: 'cintura', label: 'Contorno de cintura', source: 'measure' }],
      formulas: [{ key: 'ancho_pecho', label: 'Ancho de pecho', operandA: 'pecho', op: 'div', operandB: '4' }, { key: 'ancho_cintura', label: 'Ancho de cintura', operandA: 'cintura', op: 'div', operandB: '4' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.inputs.map((i: { key: string }) => i.key)).toEqual(['pecho', 'cintura']);
    expect((await calc(mold.chaleco)).body.rows.map((r: { result: number }) => r.result)).toEqual([22, 17.5]);
  });

  it('editar una fórmula no altera las hojas ya guardadas', async () => {
    const saved = (await A.post('/pattern-sheets', { dancerId, moldTypeId: mold.cuerpo_base, manualInputs: {} })).body;
    expect(saved.rows.find((r: { key: string }) => r.key === 'cuarto_pecho').result).toBe(22);
    const cuerpo = (await A.get('/mold-types')).body.find((m: { key: string }) => m.key === 'cuerpo_base');
    const changed = cuerpo.formulas.map((f: { key: string; adjustmentCm?: number }) => (f.key === 'cuarto_pecho' ? { ...f, adjustmentCm: 0.5 } : f));
    expect((await A.put(`/mold-types/${mold.cuerpo_base}/formulas`, { formulas: changed })).status).toBe(200);
    expect((await calc(mold.cuerpo_base)).body.rows.find((r: { key: string }) => r.key === 'cuarto_pecho').result).toBe(22.5);
    const sheet = (await A.get(`/pattern-sheets/${saved.id}`)).body;
    expect(sheet.rows.find((r: { key: string }) => r.key === 'cuarto_pecho').result).toBe(22);
  });

  it('cada fórmula precargada trae su versión original para comparar; las propias no', async () => {
    const cuerpo = (await A.get('/mold-types')).body.find((m: { key: string }) => m.key === 'cuerpo_base');
    expect(cuerpo.templateKey).toBe('cuerpo_base');
    const f = cuerpo.formulas.find((x: { key: string }) => x.key === 'cuarto_pecho');
    expect(f.adjustmentCm).toBe(0.5);
    expect(f.original).toMatchObject({ key: 'cuarto_pecho', operandA: 'pecho', op: 'div', operandB: '4' });
    expect(f.original.adjustmentCm).toBeUndefined();
    const own = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === mold.chaleco);
    expect(own.templateKey).toBeNull();
    expect(own.formulas.every((x: { original: unknown }) => x.original === null)).toBe(true);
  });

  it('restaura un molde precargado a su versión original', async () => {
    const res = await A.post(`/mold-types/${mold.cuerpo_base}/restore-defaults`);
    expect(res.status).toBe(200);
    expect(res.body.formulas.find((f: { key: string }) => f.key === 'cuarto_pecho').adjustmentCm).toBe(0);
    expect((await calc(mold.cuerpo_base)).body.rows.find((r: { key: string }) => r.key === 'cuarto_pecho').result).toBe(22);
    const own = await A.post(`/mold-types/${mold.chaleco}/restore-defaults`);
    expect(own.status).toBe(422);
    expect(own.body.error.code).toBe('NO_TEMPLATE');
  });

  it('vista previa en vivo: calcula con una definición sin guardar', async () => {
    const stored = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === mold.chaleco);
    const res = await A.post('/mold-preview', {
      dancerId, moldTypeId: mold.chaleco,
      definition: { formulas: [{ key: 'ancho_pecho', label: 'Ancho de pecho', operandA: 'pecho', op: 'div', operandB: '2', adjustmentCm: 3 }] },
    });
    expect(res.status).toBe(200);
    expect(res.body.rows[0]).toMatchObject({ formula: '÷ 2 + 3', result: 47 });
    const after = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === mold.chaleco);
    expect(after.formulas).toEqual(stored.formulas);
    const bad = await A.post('/mold-preview', { dancerId, moldTypeId: mold.chaleco, definition: { formulas: [{ key: 'x', label: 'X', operandA: 'nada', op: 'direct' }] } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('FORMULA_INVALID');
  });

  it('renombrar y cambiar la prioridad de talle', async () => {
    const res = await A.patch(`/mold-types/${mold.chaleco}`, { name: 'Chaleco corto', sizePriority: 'cadera' });
    expect(res.body).toMatchObject({ name: 'Chaleco corto', sizePriority: 'cadera' });
    expect((await A.patch(`/mold-types/${mold.chaleco}`, { key: 'otro' })).status).toBe(422);
    expect((await A.patch('/mold-types/5f0c9e3e-0000-4000-8000-000000000000', { name: 'X' })).status).toBe(404);
  });

  it('borrar un molde con prendas u hojas pide confirmación y muestra el conteo', async () => {
    await A.post('/assignments', { dancerId, moldTypeId: mold.chaleco });
    const res = await A.del(`/mold-types/${mold.chaleco}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'HAS_DEPENDENTS', details: { count: 1, assignments: 1, sheets: 0 } });
    expect((await A.del(`/mold-types/${mold.chaleco}?confirm=true`)).status).toBe(204);
    expect((await A.get('/mold-types')).body.some((m: { id: string }) => m.id === mold.chaleco)).toBe(false);
    const free = (await A.post('/mold-types', chaleco())).body.id;
    expect((await A.del(`/mold-types/${free}`)).status).toBe(204);
  });

  it('B no ve ni modifica los moldes de A', async () => {
    expect((await B.get('/mold-types')).body.some((m: { id: string }) => m.id === mold.cuerpo_base)).toBe(false);
    expect((await B.put(`/mold-types/${mold.cuerpo_base}/formulas`, { formulas: [{ key: 'x', label: 'X', operandA: 'pecho', op: 'direct' }] })).status).toBe(404);
    expect((await B.patch(`/mold-types/${mold.cuerpo_base}`, { name: 'hack' })).status).toBe(404);
    expect((await B.del(`/mold-types/${mold.cuerpo_base}`)).status).toBe(404);
    expect((await B.post(`/mold-types/${mold.cuerpo_base}/restore-defaults`)).status).toBe(404);
  });
});
