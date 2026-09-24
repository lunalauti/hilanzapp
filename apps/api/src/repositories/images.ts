import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../lib/errors';
import { unwrap } from '../lib/db';

export const BUCKET = 'design-images';
export const MAX_BYTES = 5 * 1024 * 1024;
export const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const SIGNED_URL_SECONDS = 3600;

export interface ImageRow { id: string; design_id: string; storage_path: string; filename: string; mime: string; size_bytes: number; sort: number }
const COLS = 'id, design_id, storage_path, filename, mime, size_bytes, sort';

export async function imagesOf(db: SupabaseClient, designIds: string[]) {
  if (!designIds.length) return [];
  return unwrap(await db.from('design_images').select(COLS).in('design_id', designIds).order('sort').order('created_at')) as ImageRow[];
}

export async function getImage(db: SupabaseClient, id: string) {
  return unwrap(await db.from('design_images').select(COLS).eq('id', id).maybeSingle()) as ImageRow | null;
}

export async function insertImage(db: SupabaseClient, row: Omit<ImageRow, 'id' | 'sort'> & { sort: number }) {
  return unwrap(await db.from('design_images').insert(row).select(COLS).single()) as ImageRow;
}

export async function deleteImageRow(db: SupabaseClient, id: string) {
  unwrap(await db.from('design_images').delete().eq('id', id));
}

export async function signedUrls(db: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new AppError(502, 'STORAGE_ERROR', 'No pudimos generar los enlaces de las imágenes');
  for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}

export async function createUploadUrl(db: SupabaseClient, path: string) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new AppError(502, 'STORAGE_ERROR', 'No pudimos preparar la subida de la imagen');
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/** Metadatos reales del objeto subido (no los que declara el cliente). */
export async function objectInfo(db: SupabaseClient, path: string): Promise<{ size: number; mime: string } | null> {
  const slash = path.lastIndexOf('/');
  const { data, error } = await db.storage.from(BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
  if (error) throw new AppError(502, 'STORAGE_ERROR', 'No pudimos verificar la imagen subida');
  const found = (data ?? []).find((o) => o.name === path.slice(slash + 1));
  if (!found) return null;
  const meta = (found.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: Number(meta.size ?? 0), mime: String(meta.mimetype ?? '') };
}

export async function removeObjects(db: SupabaseClient, paths: string[]) {
  if (!paths.length) return;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) throw new AppError(502, 'STORAGE_ERROR', 'No pudimos eliminar las imágenes');
}
