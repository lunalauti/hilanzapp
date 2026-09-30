import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../lib/errors';
import { unwrap } from '../lib/db';
import * as repo from '../repositories/inventory';
import { groupDancersView } from './dancers';
import type { LaborBudgetPdfData, MaterialsListPdfData } from './pdf';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Unit { designId: string; moldTypeId: string; moldName: string; hasPattern: boolean; designName: string; size: string; count: number }

/** Qué prendas hay que producir en un grupo, agrupadas por diseño, molde y talle efectivo. */
async function groupUnits(db: SupabaseClient, groupId: string, designId?: string | null) {
  const dancers = await groupDancersView(db, groupId);
  const map = new Map<string, Unit>();
  let withoutDesign = 0;
  for (const d of dancers) {
    for (const g of d.garments) {
      if (!g.sizeLabel) continue;
      if (!g.designId) { if (!designId) withoutDesign++; continue; }
      if (designId && g.designId !== designId) continue;
      const k = `${g.designId}|${g.moldTypeId}|${g.sizeLabel}`;
      const u = map.get(k) ?? { designId: g.designId, moldTypeId: g.moldTypeId, moldName: g.moldName, hasPattern: g.hasPattern, designName: g.designName ?? '', size: g.sizeLabel, count: 0 };
      u.count++;
      map.set(k, u);
    }
  }
  return { dancerCount: dancers.length, units: [...map.values()], withoutDesign };
}

export async function groupCosts(db: SupabaseClient, groupId: string, designId?: string | null) {
  const [{ dancerCount, units, withoutDesign }, materials] = await Promise.all([groupUnits(db, groupId, designId), repo.listMaterials(db)]);
  const designIds = [...new Set(units.map((u) => u.designId))];
  const { garments, rules } = designIds.length ? await repo.rulesForDesign(db) : { garments: [], rules: [] };
  const garmentOf = new Map(garments.filter((g) => designIds.includes(g.design_id)).map((g) => [`${g.design_id}|${g.mold_type_id}`, g]));

  const need = new Map<string, number>();
  const perGarment = new Map<string, { designId: string; designName: string; moldTypeId: string; moldName: string; hasPattern: boolean; units: number; materialsCost: number; laborCost: number }>();
  const matById = new Map(materials.map((m) => [m.id, m]));

  for (const u of units) {
    const garment = garmentOf.get(`${u.designId}|${u.moldTypeId}`);
    const key = `${u.designId}|${u.moldTypeId}`;
    const pg = perGarment.get(key) ?? { designId: u.designId, designName: u.designName, moldTypeId: u.moldTypeId, moldName: u.moldName, hasPattern: u.hasPattern, units: 0, materialsCost: 0, laborCost: 0 };
    pg.units += u.count;
    if (garment) {
      pg.laborCost += Number(garment.labor_cost ?? 0) * u.count;
      const mine = rules.filter((r) => r.design_garment_id === garment.id);
      for (const mid of new Set(mine.map((r) => r.material_id))) {
        const forMat = mine.filter((r) => r.material_id === mid);
        const qty = Number((forMat.find((r) => r.size_label === u.size) ?? forMat.find((r) => r.size_label === null))?.quantity ?? 0);
        if (!qty) continue;
        need.set(mid, (need.get(mid) ?? 0) + qty * u.count);
        pg.materialsCost += qty * u.count * Number(matById.get(mid)?.unit_cost ?? 0);
      }
    }
    perGarment.set(key, pg);
  }

  const rows = materials.map((m) => {
    const n = r3(need.get(m.id) ?? 0);
    const stock = Number(m.stock_qty);
    const cost = r2(n * Number(m.unit_cost));
    return { materialId: m.id, name: m.name, description: m.description, unit: m.unit, unitCost: Number(m.unit_cost), stock, need: n, remaining: r3(stock - n), shortfall: r3(Math.max(0, n - stock)), cost };
  });
  const materialsCost = r2(rows.reduce((s, x) => s + x.cost, 0));
  const laborCost = r2([...perGarment.values()].reduce((s, g) => s + g.laborCost, 0));
  const totalUnits = units.reduce((s, u) => s + u.count, 0);

  // consumo por unidad y por talle (lo que muestra la pantalla "Lycra por talle")
  const consumption = rows.filter((x) => x.need > 0).map((x) => ({
    materialId: x.materialId, name: x.name, unit: x.unit,
    byGarment: [...new Set(units.map((u) => `${u.designId}|${u.moldTypeId}`))].flatMap((key) => {
      const garment = garmentOf.get(key);
      if (!garment) return [];
      const mine = rules.filter((r) => r.design_garment_id === garment.id && r.material_id === x.materialId);
      if (!mine.length) return [];
      const sizes = [...new Set(units.filter((u) => `${u.designId}|${u.moldTypeId}` === key).map((u) => u.size))];
      return [{ designName: garment.designs.name, moldName: garment.mold_types.name, hasPattern: units.find((u) => `${u.designId}|${u.moldTypeId}` === key)?.hasPattern ?? true, sizes: sizes.map((s) => ({ label: s, quantity: Number((mine.find((r) => r.size_label === s) ?? mine.find((r) => r.size_label === null))?.quantity ?? 0) })) }];
    }),
  }));

  return {
    dancerCount, totalUnits, unassignedUnits: withoutDesign,
    materials: rows, shortages: rows.filter((x) => x.shortfall > 0).map((x) => ({ materialId: x.materialId, name: x.name, unit: x.unit, shortfall: x.shortfall })),
    materialsCost, laborCost, totalCost: r2(materialsCost + laborCost), costPerDancer: dancerCount ? r2((materialsCost + laborCost) / dancerCount) : 0,
    perGarment: [...perGarment.values()].map((g) => ({ ...g, materialsCost: r2(g.materialsCost), laborCost: r2(g.laborCost) })),
    consumption,
  };
}

/** Lista de materiales sin precios, para pasarle al proveedor: cuánto material lleva cada prenda. */
export async function materialsListPdfData(db: SupabaseClient, groupId: string, designId?: string | null, garmentId?: string | null): Promise<MaterialsListPdfData> {
  const group = unwrap(await db.from('groups').select('name').eq('id', groupId).maybeSingle()) as { name: string } | null;
  if (!group) throw notFound('Grupo no encontrado');

  const { units } = await groupUnits(db, groupId, designId ?? null);
  const designIds = [...new Set(units.map((u) => u.designId))];
  const { garments, rules } = designIds.length ? await repo.rulesForDesign(db) : { garments: [], rules: [] };
  const garmentOf = new Map(garments.filter((g) => designIds.includes(g.design_id)).map((g) => [`${g.design_id}|${g.mold_type_id}`, g]));
  const materials = await repo.listMaterials(db);
  const matById = new Map(materials.map((m) => [m.id, m]));

  const perGarment = new Map<string, { moldName: string; garment: repo.GarmentRef | undefined; units: Unit[] }>();
  for (const u of units) {
    const key = `${u.designId}|${u.moldTypeId}`;
    const garment = garmentOf.get(key);
    if (garmentId && garment?.id !== garmentId) continue;
    const pg = perGarment.get(key) ?? { moldName: u.moldName, garment, units: [] };
    pg.units.push(u);
    perGarment.set(key, pg);
  }

  return {
    groupName: group.name, generatedAt: new Date().toISOString(),
    garments: [...perGarment.values()].map((pg) => {
      const mine = pg.garment ? rules.filter((r) => r.design_garment_id === pg.garment!.id) : [];
      const materialIds = [...new Set(mine.map((r) => r.material_id))];
      const materialsOut = materialIds.flatMap((mid) => {
        const m = matById.get(mid);
        if (!m) return [];
        const forMat = mine.filter((r) => r.material_id === mid);
        const general = forMat.find((r) => r.size_label === null);
        const bySize = forMat.filter((r) => r.size_label !== null);
        const total = r3(pg.units.reduce((s, u) => s + Number((bySize.find((r) => r.size_label === u.size) ?? general)?.quantity ?? 0) * u.count, 0));
        if (!total) return [];
        const perUnit = r3(Number((general ?? bySize[0])?.quantity ?? 0));
        return [{ name: m.name, description: m.description, unit: m.unit, perUnit, total, approx: bySize.length > 1 }];
      });
      return { moldName: pg.moldName, dancerCount: pg.units.reduce((s, u) => s + u.count, 0), materials: materialsOut };
    }),
  };
}

/** Presupuesto de confección para el cliente: solo mano de obra, sin ningún dato de materiales. */
export async function laborBudgetPdfData(db: SupabaseClient, groupId: string, designId?: string | null): Promise<LaborBudgetPdfData> {
  const group = unwrap(await db.from('groups').select('name').eq('id', groupId).maybeSingle()) as { name: string } | null;
  if (!group) throw notFound('Grupo no encontrado');
  const designName = designId ? (unwrap(await db.from('designs').select('name').eq('id', designId).maybeSingle()) as { name: string } | null)?.name ?? null : null;

  const costs = await groupCosts(db, groupId, designId);
  const garments = costs.perGarment.filter((g) => g.laborCost > 0).map((g) => ({
    moldName: g.moldName, units: g.units, laborCostUnit: g.units ? r2(g.laborCost / g.units) : 0, laborCostTotal: g.laborCost,
  }));
  return { groupName: group.name, generatedAt: new Date().toISOString(), designName, garments, total: costs.laborCost };
}

export async function confirmGroupProduction(db: SupabaseClient, groupId: string, designId: string | null, deductStock: boolean) {
  const costs = await groupCosts(db, groupId, designId);
  const items = costs.materials.filter((m) => m.need > 0).map((m) => ({ material_id: m.materialId, qty: m.need }));
  if (!deductStock) return { deducted: false, items: 0, totalUnits: costs.totalUnits, shortages: costs.shortages };
  if (!items.length) throw new AppError(422, 'NOTHING_TO_DEDUCT', 'No hay materiales cargados para descontar: definí el consumo de las prendas del diseño');
  try {
    const n = await repo.confirmProduction(db, groupId, designId, items);
    return { deducted: true, items: n, totalUnits: costs.totalUnits, shortages: [] };
  } catch (e) {
    if (e instanceof AppError && e.code === 'INSUFFICIENT_STOCK') throw new AppError(409, 'INSUFFICIENT_STOCK', e.message, { shortages: costs.shortages });
    throw e;
  }
}

export async function stats(db: SupabaseClient, groupList: { id: string; name: string }[]) {
  const bySize = new Map<string, number>();
  const garmentsBySize = new Map<string, Map<string, number>>();
  const costByGroup: { groupId: string; name: string; dancers: number; units: number; materialsCost: number; laborCost: number; totalCost: number }[] = [];
  let dancers = 0;
  for (const g of groupList) {
    const list = await groupDancersView(db, g.id);
    dancers += list.length;
    for (const d of list) {
      if (d.size.label) bySize.set(d.size.label, (bySize.get(d.size.label) ?? 0) + 1);
      for (const x of d.garments) {
        if (!x.sizeLabel) continue;
        const m = garmentsBySize.get(x.moldName) ?? new Map<string, number>();
        m.set(x.sizeLabel, (m.get(x.sizeLabel) ?? 0) + 1);
        garmentsBySize.set(x.moldName, m);
      }
    }
    const c = await groupCosts(db, g.id);
    costByGroup.push({ groupId: g.id, name: g.name, dancers: list.length, units: c.totalUnits, materialsCost: c.materialsCost, laborCost: c.laborCost, totalCost: c.totalCost });
  }
  const order = (a: string, b: string) => (parseFloat(a.replace(/^\D+/, '')) - parseFloat(b.replace(/^\D+/, ''))) || a.localeCompare(b, 'es');
  return {
    groups: groupList.length, dancers,
    dancersBySize: [...bySize.entries()].sort(([a], [b]) => order(a, b)).map(([label, count]) => ({ label, count })),
    garmentsBySize: [...garmentsBySize.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([moldName, m]) => ({ moldName, total: [...m.values()].reduce((s, n) => s + n, 0), sizes: [...m.entries()].sort(([a], [b]) => order(a, b)).map(([label, count]) => ({ label, count })) })),
    costByGroup, totalCost: r2(costByGroup.reduce((s, x) => s + x.totalCost, 0)),
  };
}
