export type CatalogCategory = 'neckline' | 'sleeve' | 'skirt';

export const CATALOGS: Record<CatalogCategory, string[]> = {
  neckline: ['Redondo', 'V', 'Cuadrado', 'Corazón', 'Halter'],
  sleeve: ['Sin manga', 'Corta', '3/4', 'Larga', 'Globo', 'Campana', 'Con volado'],
  skirt: ['Recta', 'Fruncida', '1/2 campana', 'Campana', 'Doble campana', 'Irregular', 'Asimétrica'],
};
