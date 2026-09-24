import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('inventario, consumo y costos (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let designId: string;
  let garmentId: string;
  const mat: Record<string, string> = {};
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};

  const costs = async () => (await A.get(`/groups/${groupId}/costs?design_id=${designId}`)).body;
  const row = (c: { materials: { name: string }[] }, name: string) => c.materials.find((m: { name: string }) => m.name === name) as unknown as Record<string, number>;
  const stockOf = async (id: string | undefined) => Number((await A.get('/materials')).body.find((m: { id: string }) => m.id === id).stockQty);

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;
    for (const [name, cadera] of [['Ana', 90], ['Bea', 98], ['Cami', 98], ['Dani', 106]] as const) {
      const id = (await A.post('/dancers', { groupId, name, age: 30 })).body.id;
      await A.put(`/dancers/${id}/measurements/${def.pecho}`, { valueCm: 88 });
      await A.put(`/dancers/${id}/measurements/${def.cadera}`, { valueCm: cadera });
    }
    const design = (await A.post('/designs', { name: 'Aurora', garments: [{ moldTypeId: mold.pantalon, laborCost: 1000 }] })).body;
    designId = design.id;
    garmentId = design.garments[0].id;
    await A.post(`/groups/${groupId}/design-assignment`, { designId });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  describe('materiales y stock', () => {
    it('crea materiales con costo y stock inicial (con su movimiento)', async () => {
      const lycra = await A.post('/materials', { name: 'Lycra negra', description: 'Ancho 1,5 m', unit: 'm', unitCost: 1000, stockQty: 10 });
      expect(lycra.status).toBe(201);
      expect(lycra.body).toMatchObject({ name: 'Lycra negra', unit: 'm', unitCost: 1000, stockQty: 10, description: 'Ancho 1,5 m' });
      mat.lycra = lycra.body.id;
      mat.tul = (await A.post('/materials', { name: 'Tul ilusión', unitCost: 500, stockQty: 2 })).body.id;
      mat.lenteja = (await A.post('/materials', { name: 'Lentejuela', unit: 'm', unitCost: 200 })).body.id;
      const moves = (await A.get(`/materials/${mat.lycra}/movements`)).body;
      expect(moves).toEqual([expect.objectContaining({ delta: 10, reason: 'manual', note: 'Stock inicial' })]);
      expect((await A.get('/materials')).body.map((m: { name: string }) => m.name)).toEqual(['Lentejuela', 'Lycra negra', 'Tul ilusión']);
    });

    it('valida los datos', async () => {
      expect((await A.post('/materials', { name: ' ' })).status).toBe(422);
      expect((await A.post('/materials', { name: 'X', unitCost: -1 })).status).toBe(422);
      expect((await A.post('/materials', { name: 'X', stockQty: -3 })).status).toBe(422);
      expect((await A.patch(`/materials/${mat.lycra}`, { stockQty: 5 })).status).toBe(422);
    });

    it('edita nombre y costo, pero el stock solo cambia con movimientos', async () => {
      const res = await A.patch(`/materials/${mat.tul}`, { unitCost: 500, description: 'Nude' });
      expect(res.body).toMatchObject({ description: 'Nude', stockQty: 2 });
      expect((await A.patch('/materials/5f0c9e3e-0000-4000-8000-000000000000', { name: 'X' })).status).toBe(404);
    });

    it('registra ingresos y egresos, y nunca deja el stock negativo', async () => {
      expect((await A.post(`/materials/${mat.lenteja}/stock`, { delta: 50, note: 'compra' })).body.stockQty).toBe(50);
      expect((await A.post(`/materials/${mat.lenteja}/stock`, { delta: -10 })).body.stockQty).toBe(40);
      const over = await A.post(`/materials/${mat.lenteja}/stock`, { delta: -100 });
      expect(over.status).toBe(409);
      expect(over.body.error.code).toBe('INSUFFICIENT_STOCK');
      expect(await stockOf(mat.lenteja)).toBe(40);
      expect((await A.post(`/materials/${mat.lenteja}/stock`, { delta: 0 })).status).toBe(422);
      const moves = (await A.get(`/materials/${mat.lenteja}/movements`)).body;
      expect(moves.map((m: { delta: number }) => m.delta)).toEqual([-10, 50]);
    });
  });

  describe('consumo por prenda y talle', () => {
    it('define consumo general y por talle, y lo reemplaza sin duplicar', async () => {
      const put = (materialId: string | undefined, rules: object[]) => A.put('/consumption-rules', { designGarmentId: garmentId, materialId, rules });
      expect((await put(mat.lycra, [{ sizeLabel: null, quantity: 1 }, { sizeLabel: '40', quantity: 0.8 }, { sizeLabel: '48', quantity: 1.3 }])).status).toBe(200);
      expect((await put(mat.tul, [{ sizeLabel: null, quantity: 0.5 }])).status).toBe(200);
      const list = (await A.get(`/consumption-rules?designId=${designId}`)).body;
      expect(list).toHaveLength(4);
      expect(list[0]).toMatchObject({ designName: 'Aurora', moldName: 'Pantalón' });
      await put(mat.tul, [{ sizeLabel: null, quantity: 0.5 }]);
      expect((await A.get(`/consumption-rules?designId=${designId}`)).body).toHaveLength(4);
    });

    it('valida las reglas', async () => {
      const put = (body: object) => A.put('/consumption-rules', { designGarmentId: garmentId, materialId: mat.lycra, ...body });
      expect((await put({ rules: [{ sizeLabel: null, quantity: 0 }] })).status).toBe(422);
      expect((await put({ rules: [{ sizeLabel: '40', quantity: 1 }, { sizeLabel: '40', quantity: 2 }] })).status).toBe(422);
      expect((await put({ designGarmentId: '5f0c9e3e-0000-4000-8000-000000000000', rules: [] })).status).toBe(404);
      expect((await put({ materialId: '5f0c9e3e-0000-4000-8000-000000000000', rules: [] })).status).toBe(404);
    });
  });

  describe('costos del grupo', () => {
    it('calcula necesidad, stock restante, costo de materiales, mano de obra y costo por bailarina', async () => {
      const c = await costs();
      expect(c).toMatchObject({ dancerCount: 4, totalUnits: 4, unassignedUnits: 0, materialsCost: 5100, laborCost: 4000, totalCost: 9100, costPerDancer: 2275, shortages: [] });
      expect(row(c, 'Lycra negra')).toMatchObject({ need: 4.1, stock: 10, remaining: 5.9, shortfall: 0, cost: 4100, unitCost: 1000 });
      expect(row(c, 'Tul ilusión')).toMatchObject({ need: 2, stock: 2, remaining: 0, shortfall: 0, cost: 1000 });
      expect(row(c, 'Lentejuela')).toMatchObject({ need: 0, cost: 0 });
      expect(c.perGarment).toEqual([expect.objectContaining({ designName: 'Aurora', moldName: 'Pantalón', units: 4, materialsCost: 5100, laborCost: 4000 })]);
    });

    it('detalla el consumo por talle de cada material', async () => {
      const lycra = (await costs()).consumption.find((x: { name: string }) => x.name === 'Lycra negra');
      const sizes = lycra.byGarment[0].sizes as { label: string; quantity: number }[];
      expect(Object.fromEntries(sizes.map((s) => [s.label, s.quantity]))).toEqual({ '40': 0.8, '44': 1, '48': 1.3 });
    });

    it('marca los faltantes cuando la producción necesita más de lo que hay', async () => {
      await A.post(`/materials/${mat.tul}/stock`, { delta: -0.5 });
      const c = await costs();
      expect(c.shortages).toEqual([{ materialId: mat.tul, name: 'Tul ilusión', unit: 'm', shortfall: 0.5 }]);
      expect(row(c, 'Tul ilusión')).toMatchObject({ stock: 1.5, remaining: -0.5, shortfall: 0.5 });
    });

    it('cambiar el talle de una bailarina recalcula el consumo', async () => {
      const before = row(await costs(), 'Lycra negra')?.need ?? 0;
      const anaId = (await A.get(`/groups/${groupId}/dancers`)).body.find((d: { name: string }) => d.name === 'Ana').garments[0].assignmentId;
      await A.patch(`/assignments/${anaId}`, { manualSizeLabel: '48' });
      expect(row(await costs(), 'Lycra negra')?.need).toBeCloseTo(before + 0.5, 5);
      await A.patch(`/assignments/${anaId}`, { manualSizeLabel: null });
    });

    it('sin diseño asignado no hay consumo y se avisa', async () => {
      const g2 = (await A.post('/groups', { name: 'Sin diseño' })).body.id;
      const d = (await A.post('/dancers', { groupId: g2, name: 'Eli', age: 30 })).body.id;
      await A.put(`/dancers/${d}/measurements/${def.cadera}`, { valueCm: 98 });
      await A.post('/assignments', { dancerId: d, moldTypeId: mold.pantalon });
      const c = (await A.get(`/groups/${g2}/costs`)).body;
      expect(c).toMatchObject({ totalUnits: 0, unassignedUnits: 1, totalCost: 0 });
    });
  });

  describe('confirmar producción', () => {
    it('sin descontar solo informa los faltantes', async () => {
      const res = await A.post(`/groups/${groupId}/production/confirm`, { designId, deductStock: false });
      expect(res.body).toMatchObject({ deducted: false, totalUnits: 4, shortages: [{ name: 'Tul ilusión', shortfall: 0.5 }] });
    });

    it('si falta un material no descuenta nada de ninguno (todo o nada)', async () => {
      const res = await A.post(`/groups/${groupId}/production/confirm`, { designId, deductStock: true });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { shortages: [{ name: 'Tul ilusión' }] } });
      expect(await stockOf(mat.lycra)).toBe(10);
      expect(await stockOf(mat.tul)).toBe(1.5);
    });

    it('con stock suficiente descuenta todos los materiales y deja el registro', async () => {
      await A.post(`/materials/${mat.tul}/stock`, { delta: 5 });
      const res = await A.post(`/groups/${groupId}/production/confirm`, { designId, deductStock: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deducted: true, items: 2, totalUnits: 4 });
      expect(await stockOf(mat.lycra)).toBe(5.9);
      expect(await stockOf(mat.tul)).toBe(4.5);
      const moves = (await A.get(`/materials/${mat.lycra}/movements`)).body;
      expect(moves[0]).toMatchObject({ delta: -4.1, reason: 'production', groupId, designId });
      expect(row(await costs(), 'Lycra negra')).toMatchObject({ stock: 5.9, remaining: 1.8 });
    });

    it('sin consumo cargado no hay nada que descontar', async () => {
      const g = (await A.post('/groups', { name: 'Vacío' })).body.id;
      const res = await A.post(`/groups/${g}/production/confirm`, { designId: null, deductStock: true });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('NOTHING_TO_DEDUCT');
    });
  });

  describe('estadísticas', () => {
    it('resume bailarinas por talle, prendas por talle y costo por grupo', async () => {
      const s = (await A.get('/stats')).body;
      expect(s.dancers).toBeGreaterThanOrEqual(5);
      expect(s.dancersBySize.find((x: { label: string }) => x.label === '42').count).toBe(4);
      const pantalon = s.garmentsBySize.find((x: { moldName: string }) => x.moldName === 'Pantalón');
      expect(pantalon.sizes).toEqual([{ label: '40', count: 1 }, { label: '44', count: 3 }, { label: '48', count: 1 }]);
      expect(s.costByGroup.find((g: { name: string }) => g.name === 'Ágata')).toMatchObject({ dancers: 4, units: 4, materialsCost: 5100, laborCost: 4000, totalCost: 9100 });
      expect(s.totalCost).toBe(9100);
    });
  });

  describe('borrado y aislamiento', () => {
    it('borrar un material con reglas de consumo pide confirmación', async () => {
      const res = await A.del(`/materials/${mat.tul}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'HAS_DEPENDENTS', details: { count: 1 } });
      expect((await A.del(`/materials/${mat.tul}?confirm=true`)).status).toBe(204);
      expect(row(await costs(), 'Lycra negra').need).toBe(4.1);
      expect((await A.del(`/materials/${mat.lenteja}`)).status).toBe(204);
    });

    it('B no ve materiales, costos ni movimientos de A', async () => {
      expect((await B.get('/materials')).body).toEqual([]);
      expect((await B.get(`/groups/${groupId}/costs`)).status).toBe(404);
      expect((await B.post(`/groups/${groupId}/production/confirm`, { deductStock: true })).status).toBe(404);
      expect((await B.post(`/materials/${mat.lycra}/stock`, { delta: 1 })).status).toBe(404);
      expect((await B.get(`/materials/${mat.lycra}/movements`)).status).toBe(404);
      expect((await B.put('/consumption-rules', { designGarmentId: garmentId, materialId: mat.lycra, rules: [] })).status).toBe(404);
      expect((await B.del(`/materials/${mat.lycra}`)).status).toBe(404);
      expect((await admin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('owner_id', b.id)).count).toBe(0);
    });
  });
});
