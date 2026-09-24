import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restoreTemplate } from './services/bootstrap';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();
if (!up) console.warn('Supabase local no está corriendo: se omiten los tests de integración (npm run db:start).');

async function count(table: string, ownerId: string, filter: Record<string, string> = {}): Promise<number> {
  let q = admin.from(table).select('id', { count: 'exact', head: true }).eq('owner_id', ownerId);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

describe.skipIf(!up)('POST /me/bootstrap (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  const boot = (u: TestUser) => request(app).post('/api/v1/me/bootstrap').set('Authorization', `Bearer ${u.token}`);

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('exige sesión', async () => {
    expect((await request(app).post('/api/v1/me/bootstrap')).status).toBe(401);
  });

  it('crea medidas, catálogos, moldes y tablas de talles', async () => {
    const res = await boot(a);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ alreadyBootstrapped: false, created: { molds: 11, sizeTables: 4 } });
    expect(await count('mold_types', a.id)).toBe(11);
    expect(await count('size_tables', a.id)).toBe(4);
    expect(await count('size_tables', a.id, { is_active: 'true' })).toBe(4);
    expect(await count('catalog_options', a.id)).toBe(19);
    expect(await count('measure_definitions', a.id, { is_base: 'true' })).toBe(23);
    expect(await count('mold_formulas', a.id)).toBe(46);
  });

  it('guarda template_key y el origen de los valores extrapolados', async () => {
    const { data: mold } = await admin.from('mold_types').select('template_key').eq('owner_id', a.id).eq('key', 'cuerpo_base').single();
    expect(mold?.template_key).toBe('cuerpo_base');

    const { data: rows } = await admin
      .from('size_table_values')
      .select('value_cm, origin, size_table_sizes!inner(label, size_tables!inner(template_key)), measure_definitions!inner(key)')
      .eq('owner_id', a.id)
      .eq('measure_definitions.key', 'altura_tiro')
      .eq('size_table_sizes.label', '40')
      .eq('size_table_sizes.size_tables.template_key', 'mujeres');
    expect(rows).toHaveLength(1);
    expect(Number(rows![0]!.value_cm)).toBe(25.6);
    expect(rows![0]!.origin).toBe('extrapolated');
  });

  it('es idempotente: repetirlo no duplica ni pisa ediciones', async () => {
    const moldId = (await admin.from('mold_types').select('id').eq('owner_id', a.id).eq('key', 'cuerpo_base').single()).data!.id;
    await admin.from('mold_formulas').update({ adjustment_cm: 0.5 }).eq('mold_type_id', moldId).eq('key', 'cuarto_pecho');
    const res = await boot(a);
    expect(res.body).toEqual({ alreadyBootstrapped: true, created: { molds: 0, sizeTables: 0 } });
    expect(await count('mold_types', a.id)).toBe(11);
    expect(await count('catalog_options', a.id)).toBe(19);
    expect(await count('mold_formulas', a.id)).toBe(46);
    const { data } = await admin.from('mold_formulas').select('adjustment_cm').eq('mold_type_id', moldId).eq('key', 'cuarto_pecho');
    expect(Number(data![0]!.adjustment_cm)).toBe(0.5);
  });

  it('cada usuaria recibe su propia copia', async () => {
    expect((await boot(b)).status).toBe(200);
    expect(await count('mold_types', b.id)).toBe(11);
    expect(await count('mold_types', a.id)).toBe(11);
    const { data } = await b.db.from('mold_types').select('id');
    expect(data).toHaveLength(11);
  });

  it('completa un molde que quedó sin fórmulas por una falla a mitad de camino', async () => {
    const { data: m } = await admin.from('mold_types').select('id').eq('owner_id', b.id).eq('key', 'pantalon').single();
    await admin.from('mold_formulas').delete().eq('mold_type_id', m!.id);
    const res = await boot(b);
    expect(res.body.created.molds).toBe(1);
    const { count: n } = await admin.from('mold_formulas').select('id', { count: 'exact', head: true }).eq('mold_type_id', m!.id);
    expect(n).toBe(6);
  });

  it('restoreTemplate devuelve un molde y una tabla a su versión original', async () => {
    const moldId = (await admin.from('mold_types').select('id').eq('owner_id', a.id).eq('key', 'cuerpo_base').single()).data!.id;
    await restoreTemplate(a.db, a.id, 'mold', 'cuerpo_base');
    const { data } = await admin.from('mold_formulas').select('adjustment_cm, key').eq('mold_type_id', moldId).eq('key', 'cuarto_pecho');
    expect(Number(data![0]!.adjustment_cm)).toBe(0);

    const table = (await admin.from('size_tables').select('id').eq('owner_id', a.id).eq('template_key', 'ninos').single()).data!.id;
    const sizeId = (await admin.from('size_table_sizes').select('id').eq('table_id', table).eq('label', '12').single()).data!.id;
    await admin.from('size_table_values').update({ value_cm: 999, origin: 'user' }).eq('size_id', sizeId);
    await restoreTemplate(a.db, a.id, 'sizeTable', 'ninos');
    const { data: vals } = await admin.from('size_table_values').select('value_cm, origin, size_table_sizes!inner(label)').eq('owner_id', a.id).eq('size_table_sizes.label', '12').eq('size_table_sizes.table_id', table);
    expect(vals!.every((v) => Number(v.value_cm) < 999 && v.origin === 'source')).toBe(true);
  });
});
