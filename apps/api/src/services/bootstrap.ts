import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ensureCatalogs, ensureMeasureDefinitions, ensureMolds, ensureSizeTables,
  restoreMoldTemplate, restoreSizeTableTemplate,
} from '../repositories/templates';

export interface BootstrapResult {
  alreadyBootstrapped: boolean;
  created: { molds: number; sizeTables: number };
}

/** Copia las plantillas a filas propias de la usuaria. Es idempotente y no pisa lo que ella editó. */
export async function bootstrapUser(db: SupabaseClient, ownerId: string): Promise<BootstrapResult> {
  const defs = await ensureMeasureDefinitions(db, ownerId);
  await ensureCatalogs(db, ownerId);
  const molds = await ensureMolds(db, ownerId, defs);
  const sizeTables = await ensureSizeTables(db, ownerId, defs);
  return { alreadyBootstrapped: molds === 0 && sizeTables === 0, created: { molds, sizeTables } };
}

export async function restoreTemplate(db: SupabaseClient, ownerId: string, kind: 'mold' | 'sizeTable', key: string): Promise<void> {
  if (kind === 'mold') await restoreMoldTemplate(db, ownerId, key);
  else await restoreSizeTableTemplate(db, ownerId, key);
}
