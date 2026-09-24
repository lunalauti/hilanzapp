import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('diseños y catálogos (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  const mold: Record<string, string> = {};
  const catalog: Record<string, string> = {};
  let designId: string;

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    await B.post('/me/bootstrap');
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    for (const c of (await A.get('/catalog-options')).body as { id: string; label: string; category: string }[]) catalog[`${c.category}:${c.label}`] = c.id;
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  describe('catálogos', () => {
    it('trae los catálogos precargados del Req 11.2', async () => {
      const neck = (await A.get('/catalog-options?category=neckline')).body.map((c: { label: string }) => c.label);
      expect(neck).toEqual(expect.arrayContaining(['Redondo', 'V', 'Cuadrado', 'Corazón', 'Halter']));
      const sleeve = (await A.get('/catalog-options?category=sleeve')).body.map((c: { label: string }) => c.label);
      expect(sleeve).toHaveLength(7);
      expect((await A.get('/catalog-options?category=skirt')).body).toHaveLength(7);
      expect((await A.get('/catalog-options?category=otra')).status).toBe(422);
    });

    it('"Otro" guarda un valor personalizado y queda reutilizable', async () => {
      const created = await A.post('/catalog-options', { category: 'neckline', label: 'Escote en barco' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ label: 'Escote en barco', isCustom: true, category: 'neckline' });
      const again = await A.post('/catalog-options', { category: 'neckline', label: 'escote en BARCO' });
      expect(again.status).toBe(200);
      expect(again.body.id).toBe(created.body.id);
      const list = (await A.get('/catalog-options?category=neckline')).body;
      expect(list.filter((c: { label: string }) => /barco/i.test(c.label))).toHaveLength(1);
      expect((await A.post('/catalog-options', { category: 'sleeve', label: '  ' })).status).toBe(422);
      expect((await B.get('/catalog-options?category=neckline')).body.some((c: { label: string }) => c.label === 'Escote en barco')).toBe(false);
    });
  });

  describe('diseños', () => {
    it('crea un diseño con características, prendas y medidas especiales', async () => {
      const special = (await A.post('/measure-definitions', { name: 'Altura de volado' })).body.id;
      const res = await A.post('/designs', {
        name: 'Aurora', notes: 'Hombro izquierdo descubierto', constructionDetails: 'Cierre invisible en la espalda',
        necklineId: catalog['neckline:Corazón'], sleeveId: catalog['sleeve:Sin manga'], skirtId: catalog['skirt:Campana'],
        hasRuffle: true, isAsymmetric: false,
        garments: [{ moldTypeId: mold.vestido_campana_canesu, laborCost: 15000 }, { moldTypeId: mold.pantalon }],
        specialMeasureIds: [special],
      });
      expect(res.status).toBe(201);
      designId = res.body.id;
      expect(res.body).toMatchObject({
        name: 'Aurora', hasRuffle: true, isAsymmetric: false, notes: 'Hombro izquierdo descubierto',
        neckline: { label: 'Corazón' }, sleeve: { label: 'Sin manga' }, skirt: { label: 'Campana' },
        specialMeasures: [{ key: 'altura_de_volado', name: 'Altura de volado' }],
      });
      expect(res.body.garments.map((g: { moldKey: string; laborCost: number | null }) => [g.moldKey, g.laborCost])).toEqual([['vestido_campana_canesu', 15000], ['pantalon', null]]);
    });

    it('valida el nombre y las referencias', async () => {
      expect((await A.post('/designs', { name: ' ' })).status).toBe(422);
      expect((await A.post('/designs', { name: 'X', garments: [{ moldTypeId: 'no-es-uuid' }] })).status).toBe(422);
      expect((await A.post('/designs', { name: 'X', garments: [{ moldTypeId: mold.pantalon, laborCost: -5 }] })).status).toBe(422);
      expect((await A.post('/designs', { name: 'X', necklineId: catalog['neckline:V'], garments: [{ moldTypeId: '5f0c9e3e-0000-4000-8000-000000000000' }] })).status).toBe(409);
    });

    it('lista y consulta el detalle', async () => {
      const list = (await A.get('/designs')).body;
      expect(list.map((d: { name: string }) => d.name)).toContain('Aurora');
      const one = await A.get(`/designs/${designId}`);
      expect(one.body.garments).toHaveLength(2);
      expect((await A.get('/designs/5f0c9e3e-0000-4000-8000-000000000000')).status).toBe(404);
    });

    it('edita sin perder las prendas que se conservan y quita las que ya no están', async () => {
      const before = (await A.get(`/designs/${designId}`)).body;
      const vestidoRow = before.garments.find((g: { moldKey: string }) => g.moldKey === 'vestido_campana_canesu');
      const res = await A.patch(`/designs/${designId}`, {
        name: 'Aurora II', hasRuffle: false, sleeveId: catalog['sleeve:Larga'],
        garments: [{ moldTypeId: mold.vestido_campana_canesu, laborCost: 18000 }, { moldTypeId: mold.manga }],
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Aurora II', hasRuffle: false, sleeve: { label: 'Larga' }, skirt: { label: 'Campana' } });
      const keys = res.body.garments.map((g: { moldKey: string }) => g.moldKey);
      expect(keys).toEqual(['vestido_campana_canesu', 'manga']);
      expect(res.body.garments[0]).toMatchObject({ id: vestidoRow.id, laborCost: 18000 });
      expect((await A.patch(`/designs/${designId}`, { campoInventado: 1 })).status).toBe(422);
      expect((await A.patch(`/designs/${designId}`, { specialMeasureIds: [] })).body.specialMeasures).toEqual([]);
      expect((await A.patch(`/designs/${designId}`, { necklineId: null })).body.neckline).toBeNull();
    });

    it('un valor "Otro" se puede usar en un diseño nuevo', async () => {
      const custom = (await A.post('/catalog-options', { category: 'skirt', label: 'Falda con godets' })).body.id;
      const res = await A.post('/designs', { name: 'Godets', skirtId: custom });
      expect(res.body.skirt).toMatchObject({ label: 'Falda con godets', isCustom: true });
    });
  });

  describe('asignación y borrado', () => {
    it('asignar el diseño a un grupo crea las prendas de sus bailarinas', async () => {
      const group = (await A.post('/groups', { name: 'Ágata' })).body.id;
      const d1 = (await A.post('/dancers', { groupId: group, name: 'Martina', age: 30 })).body.id;
      await A.post('/dancers', { groupId: group, name: 'Sofía', age: 30 });
      const res = await A.post(`/groups/${group}/design-assignment`, { designId });
      expect(res.body).toMatchObject({ created: 4, dancers: 2, garments: 2 });
      const asg = (await A.get(`/dancers/${d1}/assignments`)).body;
      expect(asg.map((x: { designName: string }) => x.designName)).toEqual(['Aurora II', 'Aurora II']);
    });

    it('pide confirmación con el conteo antes de borrar un diseño asignado', async () => {
      const res = await A.del(`/designs/${designId}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'HAS_DEPENDENTS', details: { count: 4 } });
      expect((await A.del(`/designs/${designId}?confirm=true`)).status).toBe(204);
      expect((await A.get(`/designs/${designId}`)).status).toBe(404);
    });

    it('un diseño sin asignaciones se borra directo', async () => {
      const id = (await A.post('/designs', { name: 'Borrador' })).body.id;
      expect((await A.del(`/designs/${id}`)).status).toBe(204);
    });
  });

  it('B no ve ni modifica los diseños de A', async () => {
    const id = (await A.post('/designs', { name: 'Privado' })).body.id;
    expect((await B.get('/designs')).body).toEqual([]);
    expect((await B.get(`/designs/${id}`)).status).toBe(404);
    expect((await B.patch(`/designs/${id}`, { name: 'hack' })).status).toBe(404);
    expect((await B.del(`/designs/${id}`)).status).toBe(404);
    expect((await B.post('/designs', { name: 'Robado', necklineId: catalog['neckline:V'] })).status).toBe(409);
  });
});
