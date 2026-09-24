export interface MeasureTemplate {
  key: string;
  name: string;
  kind: 'body' | 'standard';
  isBase: boolean;
  /** Cuenta para el estado "completa" de la ficha (Req 3.6). */
  required: boolean;
}

const base = (key: string, name: string, required = false): MeasureTemplate => ({ key, name, kind: 'body', isBase: true, required });

export const BASE_MEASURES: MeasureTemplate[] = [
  base('pecho', 'Contorno de pecho', true),
  base('bajo_busto', 'Contorno de bajo busto'),
  base('cintura', 'Contorno de cintura', true),
  base('segunda_cintura', 'Contorno de segunda cintura'),
  base('cadera', 'Contorno de cadera', true),
  base('cuello', 'Contorno de cuello', true),
  base('ancho_espalda', 'Ancho de espalda', true),
  base('ancho_hombro', 'Ancho de hombro'),
  base('largo_delantero', 'Largo delantero', true),
  base('largo_trasero', 'Largo trasero', true),
  base('largo_busto', 'Largo de busto'),
  base('separacion_busto', 'Separación de busto'),
  base('largo_hombro_rodilla', 'Largo hombro-rodilla'),
  base('brazo', 'Contorno de brazo'),
  base('codo', 'Contorno de codo'),
  base('muneca', 'Contorno de muñeca'),
  base('largo_manga', 'Largo de manga'),
  base('muslo', 'Contorno de muslo'),
  base('rodilla', 'Contorno de rodilla'),
  base('pantorrilla', 'Contorno de pantorrilla'),
  base('tobillo', 'Contorno de tobillo'),
  base('largo_pantalon', 'Largo de pantalón'),
  base('largo_falda', 'Largo de falda'),
];

/** Valores que solo existen en las tablas de talles (no se miden en la bailarina). */
export const STANDARD_MEASURES: MeasureTemplate[] = [
  { key: 'altura_cadera', name: 'Altura de cadera (estándar)', kind: 'standard', isBase: false, required: false },
  { key: 'altura_tiro', name: 'Altura de tiro (estándar)', kind: 'standard', isBase: false, required: false },
];

/** Medidas que aparecen en las tablas de Baúl de Moda pero no son medidas base de la ficha. */
export const TABLE_ONLY_MEASURES: Record<string, string> = {
  altura_costado: 'Altura de costado',
  medio_pecho: 'Medio pecho',
  tiro_total: 'Tiro total',
  tiro_delantero: 'Tiro delantero',
  altura_rodilla: 'Altura de rodilla',
  botamanga: 'Botamanga',
  puno_ajustado: 'Puño ajustado',
  puno_flojo: 'Puño flojo',
  radio_mama: 'Radio de mama',
  ancho_torax: 'Ancho de tórax',
  profundidad_pinza: 'Profundidad de pinza',
  altura_axila: 'Altura de axila',
  altura_1a_cadera: 'Altura de 1ª cadera',
  altura_codo: 'Altura de codo',
};

export const ALL_MEASURES: MeasureTemplate[] = [
  ...BASE_MEASURES,
  ...STANDARD_MEASURES,
  ...Object.entries(TABLE_ONLY_MEASURES).map(([key, name]) => ({ key, name, kind: 'body' as const, isBase: false, required: false })),
];
