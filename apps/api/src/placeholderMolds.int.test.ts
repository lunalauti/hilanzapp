import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('prendas sin molde (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let emi: string;
  let ana: string;
  let designId: string;
  let evaseMoldId: string;
  let evaseGarmentId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};
  const evase = (measureIds: string[], extra: Record<string, unknown> = {}) => ({ custom: { name: 'Vestido evasé', category: 'vestido', sizePriority: 'cadera', measureIds, ...extra }, laborCost: 14000 });

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Amatista' })).body.id;
    emi = (await A.post('/dancers', { groupId, name: 'Emi', age: 30 })).body.id;
    ana = (await A.post('/dancers', { groupId, name: 'Ana', age: 30 })).body.id;
    for (const [id, cadera] of [[emi, 90], [ana, 100]] as const) {
      await A.put(`/dancers/${id}/measurements/${def.pecho}`, { valueCm: 84 });
      await A.put(`/dancers/${id}/measurements/${def.cadera}`, { valueCm: cadera });
    }
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('un diseño acepta una prenda sin molde con sus medidas, en el orden elegido', async () => {
    const res = await A.post('/designs', {
      name: 'Jardín',
      garments: [{ moldTypeId: mold.pantalon, laborCost: 9000 }, evase([def.pecho!, def.cadera!, def.largo_falda!])],
    });
    expect(res.status).toBe(201);
    designId = res.body.id;
    const g = res.body.garments.find((x: { moldName: string }) => x.moldName === 'Vestido evasé');
    expect(g).toMatchObject({ hasPattern: false, category: 'vestido', sizePriority: 'cadera', laborCost: 14000, assignedCount: 0 });
    expect(g.requiredMeasures.map((m: { key: string }) => m.key)).toEqual(['pecho', 'cadera', 'largo_falda']);
    expect(res.body.garments.find((x: { moldName: string }) => x.moldName === 'Pantalón')).toMatchObject({ hasPattern: true, requiredMeasures: [] });
    evaseMoldId = g.moldTypeId;
    evaseGarmentId = g.id;
    const listed = (await A.get('/mold-types')).body.find((m: { id: string }) => m.id === evaseMoldId);
    expect(listed).toMatchObject({ hasPattern: false, formulas: [] });
    expect(listed.key).toMatch(/^propia_vestido_evase/);
  });

  it('rechaza nombres repetidos dentro del diseño y datos incompletos', async () => {
    const dup = await A.post('/designs', { name: 'Otro', garments: [evase([def.pecho!]), evase([def.cadera!])] });
    expect(dup.status).toBe(422);
    expect(dup.body.error.code).toBe('DUPLICATE_GARMENT_NAME');
    const sameAsMold = await A.post('/designs', { name: 'Otro2', garments: [{ moldTypeId: mold.pantalon }, { custom: { name: 'pantalón', category: 'pantalon', sizePriority: 'cadera', measureIds: [] } }] });
    expect(sameAsMold.status).toBe(422);
    const empty = await A.post('/designs', { name: 'Otro3', garments: [{ custom: { name: ' ', category: 'vestido', sizePriority: 'pecho', measureIds: [] } }] });
    expect(empty.status).toBe(422);
    const noData = await A.post('/designs', { name: 'Otro4', garments: [{ laborCost: 1 }] });
    expect(noData.status).toBe(422);
    const badMeasure = await A.post('/designs', { name: 'Otro5', garments: [evase(['00000000-0000-4000-8000-000000000000'])] });
    expect(badMeasure.status).toBe(422);
    expect(badMeasure.body.error.code).toBe('UNKNOWN_MEASURE');
    expect(((await A.get('/mold-types')).body as { hasPattern: boolean }[]).filter((m) => !m.hasPattern)).toHaveLength(1);
  });

  it('se asigna al grupo como cualquier prenda y sugiere talle con la prioridad elegida', async () => {
    expect((await A.post(`/groups/${groupId}/design-assignment`, { designId })).body).toMatchObject({ created: 4, garments: 2 });
    const asg = (await A.get(`/dancers/${emi}/assignments`)).body as { moldName: string; hasPattern: boolean; suggested: string | null; effective: { label: string | null; origin: string | null } }[];
    const e = asg.find((x) => x.moldName === 'Vestido evasé')!;
    expect(e.hasPattern).toBe(false);
    expect(e.suggested).toBeTruthy();
    expect(e.effective).toMatchObject({ label: e.suggested, origin: 'suggested' });
    const design = (await A.get(`/designs/${designId}`)).body;
    expect(design.garments.find((g: { moldName: string }) => g.moldName === 'Vestido evasé').assignedCount).toBe(2);
  });

  it('el talle manual por prenda manda también sobre una prenda sin molde', async () => {
    const asg = (await A.get(`/dancers/${emi}/assignments`)).body as { id: string; moldName: string; suggested: string | null }[];
    const e = asg.find((x) => x.moldName === 'Vestido evasé')!;
    const table = (await A.get('/size-tables')).body as { id: string; ageRange: string }[];
    expect(table.length).toBeGreaterThan(0);
    const other = e.suggested === '44' ? '46' : '44';
    const patch = await A.patch(`/assignments/${e.id}`, { manualSizeLabel: other });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ manualSizeLabel: other, effective: { label: other, origin: 'assignment' } });
    await A.patch(`/assignments/${e.id}`, { manualSizeLabel: null });
  });

  it('las medidas de la prenda entran al plan de medidas y a lo que hay que tomar', async () => {
    const plan = (await A.get(`/dancers/${ana}/measure-plan`)).body as { items: { key: string; requiredBy: { kind: string; label: string }[]; value: number | null }[] };
    const largo = plan.items.find((i) => i.key === 'largo_falda')!;
    expect(largo.requiredBy).toEqual([{ kind: 'garment', label: 'Vestido evasé' }]);
    expect(largo.value).toBeNull();
    expect(plan.items.find((i) => i.key === 'cadera')!.requiredBy.map((r) => r.label)).toEqual(expect.arrayContaining(['Vestido evasé', 'Pantalón']));
  });

  it('la hoja de molde de una prenda sin molde no calcula piezas pero valida las medidas', async () => {
    const missing = await A.post('/calculations', { dancerId: emi, moldTypeId: evaseMoldId });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('MISSING_MEASUREMENTS');
    expect(missing.body.error.details.missing.map((m: { key: string }) => m.key)).toEqual(['largo_falda']);
    await A.put(`/dancers/${emi}/measurements/${def.largo_falda}`, { valueCm: 55 });
    const ok = await A.post('/calculations', { dancerId: emi, moldTypeId: evaseMoldId });
    expect(ok.status).toBe(200);
    expect(ok.body.mold.hasPattern).toBe(false);
    expect(ok.body.rows).toEqual([]);
    expect(ok.body.inputs.map((i: { key: string; value: number }) => [i.key, i.value])).toEqual([['pecho', 84], ['cadera', 90], ['largo_falda', 55]]);
  });

  it('cuenta en producción y en costos con consumo por talle y mano de obra', async () => {
    const prod = (await A.get(`/groups/${groupId}/production`)).body;
    const g = prod.byGarment.find((x: { moldName: string }) => x.moldName === 'Vestido evasé');
    expect(g).toMatchObject({ hasPattern: false, total: 2 });
    expect(prod.byGarment.find((x: { moldName: string }) => x.moldName === 'Pantalón').hasPattern).toBe(true);

    const tela = (await A.post('/materials', { name: 'Tela evasé', unit: 'm', unitCost: 1000, stockQty: 50 })).body.id;
    await A.put('/consumption-rules', { designGarmentId: evaseGarmentId, materialId: tela, rules: [{ sizeLabel: null, quantity: 1.5 }] });
    const costs = (await A.get(`/groups/${groupId}/costs?design_id=${designId}`)).body;
    const pg = costs.perGarment.find((x: { moldName: string }) => x.moldName === 'Vestido evasé');
    expect(pg).toMatchObject({ hasPattern: false, units: 2, laborCost: 28000, materialsCost: 3000 });
    expect(costs.consumption[0].byGarment[0]).toMatchObject({ moldName: 'Vestido evasé', hasPattern: false });
  });

  it('se edita la prenda propia mientras no tenga molde y se conserva su id, consumo y mano de obra', async () => {
    const res = await A.patch(`/designs/${designId}`, {
      garments: [{ moldTypeId: mold.pantalon }, { moldTypeId: evaseMoldId, custom: { name: 'Vestido evasé largo', category: 'vestido', sizePriority: 'both', measureIds: [def.cadera!, def.pecho!] } }],
    });
    expect(res.status).toBe(200);
    const g = res.body.garments.find((x: { moldTypeId: string }) => x.moldTypeId === evaseMoldId);
    expect(g).toMatchObject({ id: evaseGarmentId, moldName: 'Vestido evasé largo', sizePriority: 'both', laborCost: 14000 });
    expect(g.requiredMeasures.map((m: { key: string }) => m.key)).toEqual(['cadera', 'pecho']);
  });

  it('otra usuaria no puede tocar la prenda ni el molde vacío', async () => {
    expect((await B.get(`/designs/${designId}`)).status).toBe(404);
    expect((await B.patch(`/mold-types/${evaseMoldId}`, { name: 'x' })).status).toBe(404);
  });

  it('al quitar la prenda del diseño se van sus asignaciones y el molde vacío', async () => {
    const res = await A.patch(`/designs/${designId}`, { garments: [{ moldTypeId: mold.pantalon }] });
    expect(res.status).toBe(200);
    expect(res.body.garments).toHaveLength(1);
    expect(((await A.get('/mold-types')).body as { id: string }[]).some((m) => m.id === evaseMoldId)).toBe(false);
    const asg = (await A.get(`/dancers/${emi}/assignments`)).body as { moldName: string }[];
    expect(asg.map((x) => x.moldName)).toEqual(['Pantalón']);
  });

  it('escribir fórmulas en un molde vacío lo convierte en un molde con patrón', async () => {
    const g = (await A.post('/designs', { name: 'Solo evasé', garments: [evase([def.pecho!, def.cadera!])] })).body.garments[0];
    const put = await A.put(`/mold-types/${g.moldTypeId}/formulas`, {
      formulas: [{ key: 'cuarto_cadera', label: '1/4 cadera', operandA: 'cadera', op: 'div', operandB: '4' }],
    });
    expect(put.status).toBe(200);
    expect(put.body.hasPattern).toBe(true);
    const design = (await A.get(`/designs/${(await A.get('/designs')).body.find((d: { name: string }) => d.name === 'Solo evasé').id}`)).body;
    expect(design.garments[0]).toMatchObject({ hasPattern: true, requiredMeasures: [] });
  });

  describe('vincular a un molde existente', () => {
    let design2: string;
    let placeholder: string;
    let garment: string;

    beforeAll(async () => {
      const res = await A.post('/designs', { name: 'Evasé 2', garments: [evase([def.pecho!, def.cadera!])] });
      design2 = res.body.id;
      placeholder = res.body.garments[0].moldTypeId;
      garment = res.body.garments[0].id;
      await A.post(`/groups/${groupId}/design-assignment`, { designId: design2 });
      const asg = (await A.get(`/dancers/${emi}/assignments`)).body as { id: string; moldName: string }[];
      await A.patch(`/assignments/${asg.find((x) => x.moldName === 'Vestido evasé')!.id}`, { manualSizeLabel: '42' });
      const tela = (await A.post('/materials', { name: 'Tela link', unit: 'm', unitCost: 100, stockQty: 10 })).body.id;
      await A.put('/consumption-rules', { designGarmentId: garment, materialId: tela, rules: [{ sizeLabel: null, quantity: 2 }] });
    });

    it('la vista previa muestra las medidas nuevas que pide el molde y quiénes no las tienen', async () => {
      const prev = (await A.get(`/mold-types/${placeholder}/link-preview?target=${mold.vestido_campana_canesu}`)).body;
      expect(prev.assignments).toBe(2);
      expect(prev.garments).toBe(1);
      expect(prev.newMeasures.length).toBeGreaterThan(0);
      expect(prev.newMeasures.map((m: { key: string }) => m.key)).not.toContain('pecho');
      expect(prev.dancersMissing).toBe(2);
      expect(prev.dancerNames.sort()).toEqual(['Ana', 'Emi']);
    });

    it('no vincula si el origen ya tiene molde ni si el destino no tiene fórmulas', async () => {
      const real = await A.get(`/mold-types/${mold.pantalon}/link-preview?target=${mold.vestido_campana_canesu}`);
      expect(real.status).toBe(422);
      expect(real.body.error.code).toBe('NOT_A_PLACEHOLDER');
      const other = (await A.post('/designs', { name: 'Vacío', garments: [{ custom: { name: 'Falda propia', category: 'falda', sizePriority: 'cadera', measureIds: [] } }] })).body.garments[0].moldTypeId;
      const empty = await A.post(`/mold-types/${placeholder}/link`, { targetMoldTypeId: other });
      expect(empty.status).toBe(422);
      expect(empty.body.error.code).toBe('TARGET_HAS_NO_PATTERN');
    });

    it('rechaza vincular a un molde que el diseño ya tiene y a bailarinas ya asignadas', async () => {
      await A.patch(`/designs/${design2}`, { garments: [{ moldTypeId: placeholder }, { moldTypeId: mold.vestido_campana_canesu }] });
      const res = await A.post(`/mold-types/${placeholder}/link`, { targetMoldTypeId: mold.vestido_campana_canesu });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_IN_DESIGN');
      await A.patch(`/designs/${design2}`, { garments: [{ moldTypeId: placeholder }] });
    });

    it('otra usuaria no puede vincular', async () => {
      expect((await B.post(`/mold-types/${placeholder}/link`, { targetMoldTypeId: mold.vestido_campana_canesu })).status).toBe(404);
    });

    it('vincula conservando la prenda, las asignaciones, el talle manual, la mano de obra y el consumo', async () => {
      const res = await A.post(`/mold-types/${placeholder}/link`, { targetMoldTypeId: mold.vestido_campana_canesu });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ garments: 1, assignments: 2, target: { name: expect.stringMatching(/Vestido/) } });
      const design = (await A.get(`/designs/${design2}`)).body;
      expect(design.garments[0]).toMatchObject({ id: garment, moldTypeId: mold.vestido_campana_canesu, hasPattern: true, laborCost: 14000, assignedCount: 2 });
      const asg = (await A.get(`/dancers/${emi}/assignments`)).body as { moldTypeId: string; manualSizeLabel: string | null; hasPattern: boolean }[];
      expect(asg.find((x) => x.moldTypeId === mold.vestido_campana_canesu)).toMatchObject({ manualSizeLabel: '42', hasPattern: true });
      expect(((await A.get('/mold-types')).body as { id: string }[]).some((m) => m.id === placeholder)).toBe(false);
      const rules = (await A.get(`/consumption-rules?designId=${design2}`)).body as { quantity: number }[];
      expect(rules).toHaveLength(1);
    });
  });
});
