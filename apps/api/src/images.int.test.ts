import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe.skipIf(!up)('imágenes de referencia (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let designId: string;

  async function upload(u: TestUser, design: string, mime = 'image/png', bytes: Buffer = PNG) {
    const api = u === a ? A : B;
    const ticket = await api.post(`/designs/${design}/images/upload-url`, { filename: 'ref.png', mime, size: bytes.length });
    if (ticket.status !== 200) return { ticket };
    const up = await u.db.storage.from('design-images').uploadToSignedUrl(ticket.body.path, ticket.body.token, new Blob([bytes], { type: mime }));
    return { ticket, up };
  }

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    designId = (await A.post('/designs', { name: 'Aurora' })).body.id;
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('rechaza formatos y tamaños no permitidos antes de firmar la subida', async () => {
    const gif = await A.post(`/designs/${designId}/images/upload-url`, { filename: 'x.gif', mime: 'image/gif', size: 100 });
    expect(gif.status).toBe(415);
    expect(gif.body.error.code).toBe('IMAGE_REJECTED');
    const big = await A.post(`/designs/${designId}/images/upload-url`, { filename: 'x.png', mime: 'image/png', size: 6 * 1024 * 1024 });
    expect(big.status).toBe(413);
    expect((await A.post(`/designs/${designId}/images/upload-url`, { filename: 'x.png', mime: 'image/png', size: 0 })).status).toBe(422);
    expect((await A.post('/designs/5f0c9e3e-0000-4000-8000-000000000000/images/upload-url', { filename: 'x.png', mime: 'image/png', size: 10 })).status).toBe(404);
  });

  it('flujo completo: firmar, subir, registrar y ver la imagen en el diseño', async () => {
    const { ticket, up } = await upload(a, designId);
    expect(ticket.body.path).toMatch(new RegExp(`^${a.id}/${designId}/[0-9a-f-]+\\.png$`));
    expect(up?.error).toBeNull();

    const reg = await A.post(`/designs/${designId}/images`, { path: ticket.body.path, filename: 'ref.png' });
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ filename: 'ref.png', mime: 'image/png', sizeBytes: PNG.length });

    const design = (await A.get(`/designs/${designId}`)).body;
    expect(design.images).toHaveLength(1);
    const res = await fetch(design.images[0].url);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await A.get('/designs')).body[0].images).toHaveLength(1);
  });

  it('no registra rutas ajenas, mal formadas o de objetos que no existen', async () => {
    expect((await A.post(`/designs/${designId}/images`, { path: `${b.id}/${designId}/x.png`, filename: 'x.png' })).status).toBe(422);
    expect((await A.post(`/designs/${designId}/images`, { path: `${a.id}/${designId}/../../x.png`, filename: 'x.png' })).status).toBe(422);
    const missing = await A.post(`/designs/${designId}/images`, { path: `${a.id}/${designId}/no-existe.png`, filename: 'x.png' });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('IMAGE_NOT_FOUND');
  });

  it('el bucket rechaza archivos de más de 5 MB o de otro formato aunque se saltee la API', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const tooBig = await a.db.storage.from('design-images').upload(`${a.id}/${designId}/directo.png`, big, { contentType: 'image/png' });
    expect(tooBig.error).not.toBeNull();
    const gif = await a.db.storage.from('design-images').upload(`${a.id}/${designId}/directo.gif`, PNG, { contentType: 'image/gif' });
    expect(gif.error).not.toBeNull();
  });

  it('B no puede ver, subir ni registrar imágenes de A', async () => {
    const own = (await A.get(`/designs/${designId}`)).body.images[0];
    expect((await B.get(`/designs/${designId}`)).status).toBe(404);
    expect((await B.post(`/designs/${designId}/images/upload-url`, { filename: 'x.png', mime: 'image/png', size: 10 })).status).toBe(404);
    expect((await B.del(`/designs/${designId}/images/${own.id}`)).status).toBe(404);
    const anon = await b.db.storage.from('design-images').download(`${a.id}/${designId}/x.png`);
    expect(anon.error).not.toBeNull();
    const intruso = await b.db.storage.from('design-images').upload(`${a.id}/${designId}/hack.png`, PNG, { contentType: 'image/png' });
    expect(intruso.error).not.toBeNull();
  });

  it('eliminar una imagen borra la fila y el archivo', async () => {
    const image = (await A.get(`/designs/${designId}`)).body.images[0];
    const path = (await admin.from('design_images').select('storage_path').eq('id', image.id).single()).data!.storage_path;
    expect((await A.del(`/designs/${designId}/images/${image.id}`)).status).toBe(204);
    expect((await A.get(`/designs/${designId}`)).body.images).toEqual([]);
    const { data } = await admin.storage.from('design-images').list(path.slice(0, path.lastIndexOf('/')));
    expect(data?.some((o) => path.endsWith(o.name))).toBe(false);
    expect((await A.del(`/designs/${designId}/images/${image.id}`)).status).toBe(404);
  });

  it('al borrar un diseño también se borran sus archivos', async () => {
    const id = (await A.post('/designs', { name: 'Con fotos' })).body.id;
    const one = await upload(a, id);
    const two = await upload(a, id);
    await A.post(`/designs/${id}/images`, { path: one.ticket.body.path, filename: 'uno.png' });
    await A.post(`/designs/${id}/images`, { path: two.ticket.body.path, filename: 'dos.png' });
    const folder = `${a.id}/${id}`;
    expect((await admin.storage.from('design-images').list(folder)).data).toHaveLength(2);
    expect((await A.del(`/designs/${id}`)).status).toBe(204);
    expect((await admin.storage.from('design-images').list(folder)).data).toHaveLength(0);
  });
});
