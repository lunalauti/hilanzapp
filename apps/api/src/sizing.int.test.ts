import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('talles y asignaciones (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let dancerId: string;
  let dancer2Id: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    await B.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    const { data } = await admin.from('mold_types').select('id, key').eq('owner_id', a.id);
    for (const m of data ?? []) mold[m.key] = m.id;

    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;
    dancerId = (await A.post('/dancers', { groupId, name: 'Martina', age: 30 })).body.id;
    dancer2Id = (await A.post('/dancers', { groupId, name: 'Sofía', age: 30 })).body.id;
    for (const [key, value] of Object.entries({ pecho: 88, cintura: 70, cadera: 100 })) {
      await A.put(`/dancers/${dancerId}/measurements/${def[key]}`, { valueCm: value });
    }
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('da el desglose por medida y el talle sugerido general (prioridad pecho)', async () => {
    const res = await A.get(`/dancers/${dancerId}/sizing`);
    expect(res.status).toBe(200);
    expect(res.body.table).toMatchObject({ name: expect.stringContaining('Mujeres'), ageRange: 'mujer', forced: false });
    expect(res.body.perMeasure.map((m: { measureKey: string; sizeLabel: string }) => [m.measureKey, m.sizeLabel])).toEqual([['pecho', '42'], ['cintura', '44'], ['cadera', '46']]);
    expect(res.body).toMatchObject({ priority: 'pecho', suggested: '42', effective: { label: '42', origin: 'suggested' } });
  });

  it('la prioridad depende de la prenda: pecho, cadera o ambas', async () => {
    const cuerpo = (await A.get(`/dancers/${dancerId}/sizing?mold_type_id=${mold.cuerpo_base}`)).body;
    const pantalon = (await A.get(`/dancers/${dancerId}/sizing?mold_type_id=${mold.pantalon}`)).body;
    const vestido = (await A.get(`/dancers/${dancerId}/sizing?mold_type_id=${mold.vestido_campana_canesu}`)).body;
    expect([cuerpo.suggested, pantalon.suggested, vestido.suggested]).toEqual(['42', '46', '42']);
    expect(vestido).toMatchObject({ priority: 'both', needsReview: true, components: { pecho: '42', cadera: '46' } });
    expect(pantalon.needsReview).toBe(false);
  });

  it('sin medidas no sugiere y avisa qué falta', async () => {
    const res = await A.get(`/dancers/${dancer2Id}/sizing?mold_type_id=${mold.pantalon}`);
    expect(res.body).toMatchObject({ suggested: null, missing: ['cadera'], effective: { label: null, origin: null } });
  });

  it('talle manual general: pisa el sugerido pero ambos se conservan', async () => {
    const set = await A.put(`/dancers/${dancerId}/size`, { manualSizeLabel: '44' });
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({ suggested: '42', manual: { dancer: '44' }, effective: { label: '44', origin: 'dancer' } });
    expect((await A.put(`/dancers/${dancerId}/size`, { manualSizeLabel: '99' })).body.error).toMatchObject({ code: 'UNKNOWN_SIZE' });
    const group = (await A.get(`/groups/${groupId}/dancers`)).body.find((d: { id: string }) => d.id === dancerId);
    expect(group.size).toMatchObject({ label: '44', origin: 'dancer', suggested: '42', manual: '44' });
  });

  it('talle por prenda: prenda → general → sugerido', async () => {
    const created = await A.post('/assignments', { dancerId, moldTypeId: mold.pantalon });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await A.post('/assignments', { dancerId, moldTypeId: mold.pantalon })).status).toBe(409);

    let list = (await A.get(`/dancers/${dancerId}/assignments`)).body;
    expect(list[0]).toMatchObject({ moldKey: 'pantalon', suggested: '46', effective: { label: '44', origin: 'dancer' } });

    const patched = await A.patch(`/assignments/${id}`, { manualSizeLabel: '50' });
    expect(patched.body).toMatchObject({ suggested: '46', effective: { label: '50', origin: 'assignment' } });
    list = (await A.get(`/dancers/${dancerId}/assignments`)).body;
    expect(list[0].effective).toEqual({ label: '50', origin: 'assignment' });
    const g = (await A.get(`/groups/${groupId}/dancers`)).body.find((d: { id: string }) => d.id === dancerId);
    expect(g.garments).toEqual([expect.objectContaining({ moldKey: 'pantalon', sizeLabel: '50' })]);

    await A.patch(`/assignments/${id}`, { manualSizeLabel: null });
    await A.put(`/dancers/${dancerId}/size`, { manualSizeLabel: null });
    list = (await A.get(`/dancers/${dancerId}/assignments`)).body;
    expect(list[0].effective).toEqual({ label: '46', origin: 'suggested' });
    expect((await A.del(`/assignments/${id}`)).status).toBe(204);
    expect((await A.del(`/assignments/${id}`)).status).toBe(404);
  });

  it('se puede forzar otra tabla de talles por bailarina', async () => {
    const { data } = await admin.from('size_tables').select('id').eq('owner_id', a.id).eq('template_key', 'ninos').single();
    await A.patch(`/dancers/${dancerId}`, { sizeTableId: data!.id });
    const res = (await A.get(`/dancers/${dancerId}/sizing`)).body;
    expect(res.table).toMatchObject({ ageRange: 'nino', forced: true });
    expect(res).toMatchObject({ suggested: '12', outOfRange: true });
    await A.patch(`/dancers/${dancerId}`, { sizeTableId: null });
    expect((await A.get(`/dancers/${dancerId}/sizing`)).body.table.forced).toBe(false);
  });

  it('elige la tabla por edad', async () => {
    const teen = (await A.post('/dancers', { groupId, name: 'Teen', age: 15 })).body.id;
    await A.put(`/dancers/${teen}/measurements/${def.pecho}`, { valueCm: 83 });
    const res = (await A.get(`/dancers/${teen}/sizing`)).body;
    expect(res.table.ageRange).toBe('adolescente');
    expect(res.suggested).toBe('16');
  });

  it('asigna un diseño a todo el grupo, sin duplicar', async () => {
    const design = (await a.db.from('designs').insert({ name: 'Aurora' }).select('id').single()).data!.id;
    await a.db.from('design_garments').insert([{ design_id: design, mold_type_id: mold.pantalon }, { design_id: design, mold_type_id: mold.cuerpo_base }]);
    const first = await A.post(`/groups/${groupId}/design-assignment`, { designId: design });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ created: 6, dancers: 3, garments: 2 });
    const again = await A.post(`/groups/${groupId}/design-assignment`, { designId: design });
    expect(again.body).toMatchObject({ created: 0, existing: 6 });

    const g = (await A.get(`/groups/${groupId}/dancers`)).body.find((d: { id: string }) => d.id === dancerId);
    expect(g.garments.map((x: { moldKey: string; designName: string }) => [x.moldKey, x.designName]).sort()).toEqual([['cuerpo_base', 'Aurora'], ['pantalon', 'Aurora']]);

    expect((await B.post(`/groups/${groupId}/design-assignment`, { designId: design })).status).toBe(404);
    expect((await B.post('/assignments', { dancerId, moldTypeId: mold.pantalon })).status).toBe(404);
  });
});
