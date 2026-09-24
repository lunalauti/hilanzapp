import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('grupos, bailarinas y medidas (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  const as = (u: TestUser) => ({
    get: (p: string) => request(app).get(`/api/v1${p}`).set('Authorization', `Bearer ${u.token}`),
    post: (p: string, body?: object) => request(app).post(`/api/v1${p}`).set('Authorization', `Bearer ${u.token}`).send(body),
    put: (p: string, body?: object) => request(app).put(`/api/v1${p}`).set('Authorization', `Bearer ${u.token}`).send(body),
    patch: (p: string, body?: object) => request(app).patch(`/api/v1${p}`).set('Authorization', `Bearer ${u.token}`).send(body),
    del: (p: string) => request(app).delete(`/api/v1${p}`).set('Authorization', `Bearer ${u.token}`),
  });
  const A = () => as(a);
  const B = () => as(b);
  let groupId: string;
  let group2Id: string;
  let dancerId: string;
  const def: Record<string, string> = {};

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    await A().post('/me/bootstrap');
    const defs = (await A().get('/measure-definitions')).body as { id: string; key: string }[];
    for (const d of defs) def[d.key] = d.id;
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  describe('grupos', () => {
    it('crea, lista con conteos y renombra', async () => {
      const created = await A().post('/groups', { name: '  Ágata  ' });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe('Ágata');
      groupId = created.body.id;
      group2Id = (await A().post('/groups', { name: 'Jade' })).body.id;

      const list = await A().get('/groups');
      expect(list.body.map((g: { name: string }) => g.name)).toEqual(['Ágata', 'Jade']);
      expect(list.body[0]).toMatchObject({ dancerCount: 0, complete: 0 });

      const renamed = await A().patch(`/groups/${group2Id}`, { name: 'Jade 2' });
      expect(renamed.body.name).toBe('Jade 2');
    });

    it('rechaza nombre vacío con 422', async () => {
      const res = await A().post('/groups', { name: '   ' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0]).toMatchObject({ path: 'name', message: 'El nombre es obligatorio' });
    });

    it('B no ve ni modifica los grupos de A', async () => {
      expect((await B().get('/groups')).body).toEqual([]);
      expect((await B().patch(`/groups/${groupId}`, { name: 'hack' })).status).toBe(404);
      expect((await B().del(`/groups/${groupId}`)).status).toBe(404);
      expect((await B().get(`/groups/${groupId}/dancers`)).status).toBe(404);
    });
  });

  describe('bailarinas', () => {
    it('crea con los campos mínimos y valida', async () => {
      const ok = await A().post('/dancers', { groupId, name: 'Martina', age: 30 });
      expect(ok.status).toBe(201);
      dancerId = ok.body.id;
      expect(ok.body).toMatchObject({ name: 'Martina', age: 30, group_id: groupId });
      expect((await A().post('/dancers', { groupId, name: '' })).status).toBe(422);
      expect((await A().post('/dancers', { groupId, name: 'X', age: 200 })).status).toBe(422);
      expect((await A().post('/dancers', { groupId: '5f0c9e3e-0000-4000-8000-000000000000', name: 'X' })).status).toBe(404);
      expect((await B().post('/dancers', { groupId, name: 'Intrusa' })).status).toBe(404);
    });

    it('actualiza datos y mueve de grupo conservando medidas', async () => {
      await A().put(`/dancers/${dancerId}/measurements/${def.pecho}`, { valueCm: 88 });
      const moved = await A().patch(`/dancers/${dancerId}`, { groupId: group2Id, notes: 'alérgica al látex' });
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({ group_id: group2Id, notes: 'alérgica al látex' });
      const m = (await A().get(`/dancers/${dancerId}/measurements`)).body as { key: string; valueCm: number | null }[];
      expect(m.find((x) => x.key === 'pecho')?.valueCm).toBe(88);
      await A().patch(`/dancers/${dancerId}`, { groupId });
      expect((await A().patch(`/dancers/${dancerId}`, { campoInventado: 1 })).status).toBe(422);
    });

    it('lista el grupo con estado de medidas y talle efectivo', async () => {
      let row = (await A().get(`/groups/${groupId}/dancers`)).body[0];
      expect(row).toMatchObject({ name: 'Martina', measureStatus: 'partial', requiredDone: 1, requiredTotal: 7 });
      for (const [key, value] of Object.entries({ cintura: 70, cadera: 94, cuello: 36, ancho_espalda: 40, largo_delantero: 44, largo_trasero: 42 })) {
        await A().put(`/dancers/${dancerId}/measurements/${def[key]}`, { valueCm: value });
      }
      row = (await A().get(`/groups/${groupId}/dancers`)).body[0];
      expect(row.measureStatus).toBe('complete');
      // pecho 88 empata entre T40 (86) y T42 (90): gana el talle mayor
      expect(row.size).toMatchObject({ label: '42', origin: 'suggested', suggested: '42', manual: null, outOfRange: false });
      const stats = (await A().get('/groups')).body.find((g: { id: string }) => g.id === groupId);
      expect(stats).toMatchObject({ dancerCount: 1, complete: 1 });
    });
  });

  describe('medidas', () => {
    it('valida los valores', async () => {
      for (const valueCm of [-1, 'ochenta', null]) {
        const res = await A().put(`/dancers/${dancerId}/measurements/${def.cintura}`, { valueCm });
        expect(res.status, JSON.stringify(valueCm)).toBe(422);
      }
      expect((await A().put(`/dancers/${dancerId}/measurements/${def.cintura}`, { valueCm: 70, takenOn: '12/09/2026' })).status).toBe(422);
    });

    it('cada edición crea una versión y el historial va del más nuevo al más viejo', async () => {
      await A().put(`/dancers/${dancerId}/measurements/${def.brazo}`, { valueCm: 30, takenOn: '2026-03-14' });
      await A().put(`/dancers/${dancerId}/measurements/${def.brazo}`, { valueCm: 31, takenOn: '2026-06-03', note: 'con malla' });
      const last = await A().put(`/dancers/${dancerId}/measurements/${def.brazo}`, { valueCm: 32.5, takenOn: '2026-09-12' });
      expect(last.body).toMatchObject({ valueCm: 32.5, isCurrent: true });

      const history = (await A().get(`/dancers/${dancerId}/measurements/${def.brazo}/history`)).body;
      expect(history.map((v: { valueCm: number }) => v.valueCm)).toEqual([32.5, 31, 30]);
      expect(history.filter((v: { isCurrent: boolean }) => v.isCurrent)).toHaveLength(1);
      const current = (await A().get(`/dancers/${dancerId}/measurements`)).body.find((x: { key: string }) => x.key === 'brazo');
      expect(current).toMatchObject({ valueCm: 32.5, takenOn: '2026-09-12' });
    });

    it('restaura una versión anterior como nueva versión vigente', async () => {
      const history = (await A().get(`/dancers/${dancerId}/measurements/${def.brazo}/history`)).body;
      const old = history.find((v: { valueCm: number }) => v.valueCm === 31);
      const res = await A().post(`/dancers/${dancerId}/measurements/${def.brazo}/restore`, { versionId: old.id });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ valueCm: 31, isCurrent: true });
      const after = (await A().get(`/dancers/${dancerId}/measurements/${def.brazo}/history`)).body;
      expect(after).toHaveLength(4);
      expect((await A().post(`/dancers/${dancerId}/measurements/${def.cintura}/restore`, { versionId: old.id })).status).toBe(404);
    });

    it('compara dos tomas', async () => {
      const res = await A().get(`/dancers/${dancerId}/measurements/compare?from=2026-06-30&to=2026-09-30`);
      expect(res.status).toBe(200);
      const brazo = res.body.find((r: { key: string }) => r.key === 'brazo');
      expect(brazo).toMatchObject({ from: 31, to: 31, diff: 0 });
      const early = (await A().get(`/dancers/${dancerId}/measurements/compare?from=2026-03-31&to=2026-09-01`)).body.find((r: { key: string }) => r.key === 'brazo');
      expect(early).toMatchObject({ from: 30, to: 31, diff: 1 });
      expect((await A().get(`/dancers/${dancerId}/measurements/compare?from=hoy&to=2026-09-01`)).status).toBe(422);
    });

    it('agrega medidas personalizadas con clave única', async () => {
      const one = await A().post('/measure-definitions', { name: 'Largo falda trasera' });
      const two = await A().post('/measure-definitions', { name: 'Largo falda trasera' });
      expect(one.status).toBe(201);
      expect(one.body).toMatchObject({ key: 'largo_falda_trasera', isBase: false, kind: 'body' });
      expect(two.body.key).toBe('largo_falda_trasera_2');
      const saved = await A().put(`/dancers/${dancerId}/measurements/${one.body.id}`, { valueCm: 68, note: 'Desde segunda cintura' });
      expect(saved.body).toMatchObject({ valueCm: 68, note: 'Desde segunda cintura' });
      expect((await A().post('/measure-definitions', { name: '' })).status).toBe(422);
    });

    it('B no puede leer ni cargar medidas de A', async () => {
      expect((await B().get(`/dancers/${dancerId}/measurements`)).status).toBe(404);
      expect((await B().put(`/dancers/${dancerId}/measurements/${def.pecho}`, { valueCm: 1 })).status).toBe(404);
    });
  });

  describe('borrado', () => {
    it('pide confirmación con el conteo antes de borrar una bailarina con datos', async () => {
      const res = await A().del(`/dancers/${dancerId}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'HAS_DEPENDENTS' });
      expect(res.body.error.details.count).toBeGreaterThan(5);
    });

    it('un grupo con bailarinas pide confirmación y con confirm borra en cascada', async () => {
      const res = await A().del(`/groups/${groupId}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'HAS_DEPENDENTS', details: { count: 1 } });
      expect((await A().del(`/groups/${groupId}?confirm=true`)).status).toBe(204);
      const { count } = await admin.from('measurement_versions').select('id', { count: 'exact', head: true }).eq('owner_id', a.id);
      expect(count).toBe(0);
      expect((await A().get(`/dancers/${dancerId}`)).status).toBe(404);
    });

    it('borra un grupo vacío sin confirmación y una bailarina sin datos', async () => {
      expect((await A().del(`/groups/${group2Id}`)).status).toBe(204);
      const g = (await A().post('/groups', { name: 'Nuevo' })).body.id;
      const d = (await A().post('/dancers', { groupId: g, name: 'Sin datos' })).body.id;
      expect((await A().del(`/dancers/${d}`)).status).toBe(204);
    });
  });
});
