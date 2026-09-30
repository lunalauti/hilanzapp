import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('categorías de grupo y archivado (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let categoryId: string;
  let groupId: string;
  let group2Id: string;

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('crea, renombra y lista categorías', async () => {
    const created = await A.post('/group-categories', { name: 'Temporada 2026' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Temporada 2026' });
    categoryId = created.body.id;

    const empty = await A.post('/group-categories', { name: '  ' });
    expect(empty.status).toBe(422);

    const renamed = await A.patch(`/group-categories/${categoryId}`, { name: 'Temporada 2026-2027' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Temporada 2026-2027');

    const list = await A.get('/group-categories');
    expect(list.body.map((c: { name: string }) => c.name)).toEqual(['Temporada 2026-2027']);
  });

  it('crea grupos con y sin categoría, y permite moverlos', async () => {
    const g1 = await A.post('/groups', { name: 'Ágata', categoryId });
    expect(g1.status).toBe(201);
    expect(g1.body.categoryId ?? g1.body.category_id).toBeTruthy();
    groupId = g1.body.id;

    const g2 = await A.post('/groups', { name: 'Jade' });
    expect(g2.status).toBe(201);
    group2Id = g2.body.id;

    const moved = await A.patch(`/groups/${group2Id}`, { categoryId });
    expect(moved.status).toBe(200);

    const badCategory = await A.post('/groups', { name: 'Otro', categoryId: '00000000-0000-4000-8000-000000000000' });
    expect(badCategory.status).toBe(404);
  });

  it('eliminar la categoría no borra los grupos: quedan sin categoría', async () => {
    const del = await A.del(`/group-categories/${categoryId}`);
    expect(del.status).toBe(204);
    const groups = await A.get('/groups');
    const g1 = groups.body.find((g: { id: string }) => g.id === groupId);
    const g2 = groups.body.find((g: { id: string }) => g.id === group2Id);
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
    expect(g1.categoryId ?? g1.category_id ?? null).toBeNull();
  });

  it('archivar un grupo lo saca del listado por defecto, sin borrar nada', async () => {
    const archived = await A.patch(`/groups/${group2Id}`, { archived: true });
    expect(archived.status).toBe(200);

    const withoutArchived = await A.get('/groups');
    expect(withoutArchived.body.some((g: { id: string }) => g.id === group2Id)).toBe(false);
    expect(withoutArchived.body.some((g: { id: string }) => g.id === groupId)).toBe(true);

    const withArchived = await A.get('/groups?incluir_archivados=1');
    expect(withArchived.body.some((g: { id: string }) => g.id === group2Id)).toBe(true);

    const unarchived = await A.patch(`/groups/${group2Id}`, { archived: false });
    expect(unarchived.status).toBe(200);
    const back = await A.get('/groups');
    expect(back.body.some((g: { id: string }) => g.id === group2Id)).toBe(true);
  });

  it('otra usuaria no ve las categorías ni los grupos de la primera', async () => {
    expect((await B.get('/group-categories')).body).toEqual([]);
    expect((await B.patch(`/group-categories/${categoryId}`, { name: 'x' })).status).toBe(404);
    expect((await B.patch(`/groups/${groupId}`, { name: 'x' })).status).toBe(404);
  });
});
