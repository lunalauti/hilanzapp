import type { SupabaseClient } from '@supabase/supabase-js';
import * as repo from '../repositories/designs';
import * as images from '../repositories/images';

export async function designsView(db: SupabaseClient, id?: string) {
  const designs = await repo.listDesigns(db, id);
  const ids = designs.map((d) => d.id);
  const [garments, specials, catalog, imgs] = await Promise.all([repo.garmentsOf(db, ids), repo.specialsOf(db, ids), repo.listCatalog(db), images.imagesOf(db, ids)]);
  const urls = await images.signedUrls(db, imgs.map((i) => i.storage_path));
  const option = (optId: string | null) => {
    const c = catalog.find((x) => x.id === optId);
    return c ? { id: c.id, label: c.label, isCustom: c.is_custom } : null;
  };
  return designs.map((d) => ({
    id: d.id, name: d.name, notes: d.notes, constructionDetails: d.construction_details,
    neckline: option(d.neckline_id), sleeve: option(d.sleeve_id), skirt: option(d.skirt_id),
    hasRuffle: d.has_ruffle, isAsymmetric: d.is_asymmetric, createdAt: d.created_at,
    garments: garments.filter((g) => g.design_id === d.id).map((g) => ({
      id: g.id, moldTypeId: g.mold_type_id, moldKey: g.mold_types.key, moldName: g.mold_types.name, laborCost: g.labor_cost === null ? null : Number(g.labor_cost),
    })),
    images: imgs.filter((i) => i.design_id === d.id).map((i) => ({ id: i.id, filename: i.filename, mime: i.mime, sizeBytes: i.size_bytes, url: urls.get(i.storage_path) ?? null })),
    specialMeasures: specials.filter((s) => s.design_id === d.id).map((s) => ({ definitionId: s.definition_id, key: s.measure_definitions.key, name: s.measure_definitions.name })),
  }));
}
