import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../lib/errors';
import * as dancersRepo from '../repositories/dancers';
import * as designs from '../repositories/designs';
import * as images from '../repositories/images';
import * as molds from '../repositories/molds';
import { unwrap } from '../lib/db';
import { groupPlan } from './groupPlan';
import { plansForDancers } from './measurePlan';
import { resolveDancerSizing } from './sizing';
import { groupProduction } from './production';
import { formatDate, type MissingPdfData, type ProductionPdfData, type SheetPdfData } from './pdf';

interface Snapshot {
  dancer: { name: string }; mold: { name: string };
  size: { label: string | null; origin: string | null };
  inputs: { key: string; label: string; source: string; value: number | string | null }[];
  rows: { label: string; section: string | null; realLabel: string | null; realValue: number | null; formula: string; display: string }[];
  manualInputs: Record<string, number>; choices: Record<string, string>; savedAt?: string;
}

const fmt = (n: number) => String(n).replace('.', ',');
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'hoja';

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch { return null; }
}

export async function sheetPdfData(db: SupabaseClient, sheetId: string): Promise<SheetPdfData> {
  const sheet = await molds.getSheet(db, sheetId);
  if (!sheet) throw notFound('Hoja de molde no encontrada');
  const snap = sheet.snapshot as Snapshot;
  const dancer = await dancersRepo.getDancer(db, sheet.dancer_id);
  const group = dancer ? (unwrap(await db.from('groups').select('name').eq('id', dancer.group_id).maybeSingle()) as { name: string } | null) : null;
  const stored = await molds.getMold(db, sheet.mold_type_id);

  const manualInputs = snap.inputs.filter((i) => i.source === 'manual' && i.value !== null).map((i) => ({ label: i.label, value: fmt(Number(i.value)) }));
  const choiceText = snap.inputs.filter((i) => i.source === 'choice').map((i) => {
    const option = stored?.def.inputs.find((x) => x.key === i.key)?.options?.find((o) => o.id === i.value);
    return option ? `${i.label.toLowerCase()} ${option.label.toLowerCase()}` : null;
  }).filter(Boolean).join(', ') || null;

  const notes: string[] = [];
  let imgs: SheetPdfData['images'] = [];
  if (sheet.design_id) {
    const [design] = await designs.listDesigns(db, sheet.design_id);
    if (design) {
      if (design.name) notes.push(`Diseño: ${design.name}`);
      if (design.notes) notes.push(design.notes);
      if (design.construction_details) notes.push(design.construction_details);
      const rows = (await images.imagesOf(db, [design.id])).filter((i) => i.mime !== 'image/webp');
      const urls = await images.signedUrls(db, rows.map((r) => r.storage_path));
      const fetched = await Promise.all(rows.slice(0, 3).map(async (r) => ({ filename: r.filename, buffer: await fetchImage(urls.get(r.storage_path) ?? '') })));
      imgs = fetched.filter((f): f is { filename: string; buffer: Buffer } => f.buffer !== null);
    }
  }

  let noPattern: SheetPdfData['noPattern'];
  if (stored && !stored.hasPattern) {
    const plan = dancer ? (await plansForDancers(db, [dancer])).get(dancer.id) : undefined;
    const taken = new Map((plan?.items ?? []).map((i) => [i.key, i.takenOn]));
    const design = sheet.design_id ? (await designs.listDesigns(db, sheet.design_id))[0] : undefined;
    noPattern = {
      designName: design?.name ?? null, category: stored.def.category,
      sizeBasis: ({ pecho: 'pecho', cadera: 'cadera', both: 'pecho y cadera' } as const)[stored.def.sizePriority],
      measures: snap.inputs.filter((i) => i.source === 'measure').map((i) => ({
        label: i.label, value: i.value === null ? null : fmt(Number(i.value)), takenOn: taken.get(stored.def.inputs.find((x) => x.key === i.key)?.measureKey ?? i.key) ?? null,
      })),
    };
  }

  return {
    ...(noPattern ? { noPattern } : {}),
    dancerName: snap.dancer.name, groupName: group?.name ?? null, moldName: snap.mold.name,
    sizeLabel: sheet.size_label ?? snap.size.label, sizeOrigin: snap.size.origin,
    createdAt: sheet.created_at, measuredOn: dancer?.measured_on ?? null,
    rows: snap.rows, manualInputs, choiceText, notes, images: imgs,
  };
}

export async function productionPdfData(db: SupabaseClient, groupId: string): Promise<ProductionPdfData> {
  const group = unwrap(await db.from('groups').select('name').eq('id', groupId).maybeSingle()) as { name: string } | null;
  if (!group) throw notFound('Grupo no encontrado');
  const p = await groupProduction(db, groupId);
  return {
    groupName: group.name, generatedAt: new Date().toISOString(), totalUnits: p.totalUnits,
    byGarment: p.byGarment.map((g) => ({ moldName: g.moldName, hasPattern: g.hasPattern, total: g.total, sizes: g.sizes })),
    pending: p.pending.map((x) => ({ name: x.name, reason: x.reason === 'no_assignment' ? 'sin prendas asignadas' : `sin talle (${x.moldNames.join(', ')})` })),
  };
}

export async function missingPdfData(db: SupabaseClient, groupId: string): Promise<MissingPdfData> {
  const group = unwrap(await db.from('groups').select('name').eq('id', groupId).maybeSingle()) as { name: string } | null;
  if (!group) throw notFound('Grupo no encontrado');
  const plan = await groupPlan(db, groupId, { onlyMissing: true });
  return {
    groupName: group.name, generatedAt: new Date().toISOString(),
    dancers: plan.dancers.map((d) => ({
      name: d.name,
      missing: d.cells.flatMap((c, i) => (c.required && c.value === null ? [plan.measures[i]!.name] : [])),
    })),
  };
}

/** Hoja simplificada de una prenda sin molde, sin guardarla: sirve aunque falten medidas ("falta · anotar"). */
export async function garmentSheetPdfData(db: SupabaseClient, dancerId: string, moldTypeId: string, designId: string | null): Promise<SheetPdfData> {
  const dancer = await dancersRepo.getDancer(db, dancerId);
  if (!dancer) throw notFound('Bailarina no encontrada');
  const stored = await molds.getMold(db, moldTypeId);
  if (!stored) throw notFound('Molde no encontrado');
  if (stored.hasPattern) throw new AppError(422, 'HAS_PATTERN', 'Esta prenda tiene molde: exportá su hoja de molde');
  const group = unwrap(await db.from('groups').select('name').eq('id', dancer.group_id).maybeSingle()) as { name: string } | null;
  const assignmentManual = await molds.findAssignmentSize(db, dancer.id, stored.id, designId);
  const { view, measures } = await resolveDancerSizing(db, dancer, { size_priority: stored.def.sizePriority }, assignmentManual);
  const plan = (await plansForDancers(db, [dancer])).get(dancer.id);
  const taken = new Map((plan?.items ?? []).map((i) => [i.key, i.takenOn]));
  const design = designId ? (await designs.listDesigns(db, designId))[0] : undefined;
  return {
    dancerName: dancer.name, groupName: group?.name ?? null, moldName: stored.def.name,
    sizeLabel: view.label, sizeOrigin: view.origin, createdAt: new Date().toISOString(), measuredOn: dancer.measured_on,
    rows: [], manualInputs: [], choiceText: null, notes: [], images: [],
    noPattern: {
      designName: design?.name ?? null, category: stored.def.category,
      sizeBasis: ({ pecho: 'pecho', cadera: 'cadera', both: 'pecho y cadera' } as const)[stored.def.sizePriority],
      measures: stored.def.inputs.filter((i) => i.source === 'measure').map((i) => {
        const key = i.measureKey ?? i.key;
        const v = measures[key];
        return { label: i.label, value: v === undefined ? null : fmt(v), takenOn: taken.get(key) ?? null };
      }),
    },
  };
}

export async function batchSheets(db: SupabaseClient, ids: string[]): Promise<SheetPdfData[]> {
  if (ids.length === 0) throw new AppError(422, 'VALIDATION_ERROR', 'Elegí al menos una hoja');
  const out: SheetPdfData[] = [];
  for (const id of ids) out.push(await sheetPdfData(db, id));
  return out;
}

export { formatDate };
