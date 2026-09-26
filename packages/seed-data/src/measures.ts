export interface MeasureTemplate {
  key: string;
  name: string;
  kind: 'body' | 'standard';
  isBase: boolean;
  /** Cuenta para el estado "completa" de la ficha (Req 3.6). */
  required: boolean;
}

const base = (key: string, name: string, required = false): MeasureTemplate => ({ key, name, kind: 'body', isBase: true, required });

/** En orden corporal de toma (de arriba hacia abajo): la modista mide siempre en esta secuencia. */
export const BASE_MEASURES: MeasureTemplate[] = [
  base('cuello', 'Contorno de cuello', true),
  base('ancho_hombro', 'Ancho de hombro'),
  base('ancho_espalda', 'Ancho de espalda', true),
  base('pecho', 'Contorno de pecho', true),
  base('bajo_busto', 'Contorno de bajo busto'),
  base('largo_busto', 'Largo de busto'),
  base('separacion_busto', 'Separación de busto'),
  base('largo_delantero', 'Largo delantero', true),
  base('largo_trasero', 'Largo trasero', true),
  base('largo_hombro_rodilla', 'Largo hombro-rodilla'),
  base('brazo', 'Contorno de brazo'),
  base('codo', 'Contorno de codo'),
  base('muneca', 'Contorno de muñeca'),
  base('largo_manga', 'Largo de manga'),
  base('cintura', 'Contorno de cintura', true),
  base('segunda_cintura', 'Contorno de segunda cintura'),
  base('cadera', 'Contorno de cadera', true),
  base('muslo', 'Contorno de muslo'),
  base('rodilla', 'Contorno de rodilla'),
  base('pantorrilla', 'Contorno de pantorrilla'),
  base('tobillo', 'Contorno de tobillo'),
  base('largo_pantalon', 'Largo de pantalón'),
  base('largo_falda', 'Largo de falda'),
];

/** Cómo se toma cada medida base (texto corto para el flujo "Tomar medidas"). */
export const MEASURE_HELP: Record<string, string> = {
  cuello: 'Alrededor de la base del cuello, sin apretar.',
  ancho_hombro: 'Del cuello a la punta del hombro, por encima.',
  ancho_espalda: 'De axila a axila por la espalda, a la altura de los omóplatos.',
  pecho: 'Alrededor de la parte más llena del pecho, con la cinta paralela al piso.',
  bajo_busto: 'Alrededor del cuerpo, justo debajo del busto.',
  largo_busto: 'De la base del cuello a la punta del busto.',
  separacion_busto: 'Distancia entre las dos puntas del busto.',
  largo_delantero: 'De la base del cuello a la cintura por el frente.',
  largo_trasero: 'De la base del cuello (vértebra alta) a la cintura por la espalda.',
  largo_hombro_rodilla: 'Del hombro a la rodilla, pasando por el busto.',
  brazo: 'Alrededor de la parte más ancha del brazo, relajado.',
  codo: 'Alrededor del codo con el brazo apenas doblado.',
  muneca: 'Alrededor de la muñeca, sobre el hueso.',
  largo_manga: 'De la punta del hombro a la muñeca, con el brazo apenas doblado.',
  cintura: 'Alrededor de la parte más angosta del torso.',
  segunda_cintura: 'Alrededor del cuerpo, a mitad de camino entre la cintura y la cadera.',
  cadera: 'En la parte más ancha de la cola, con los pies juntos.',
  muslo: 'Alrededor de la parte más ancha del muslo.',
  rodilla: 'Alrededor de la rodilla, sobre el hueso.',
  pantorrilla: 'Alrededor de la parte más ancha de la pantorrilla.',
  tobillo: 'Alrededor del tobillo, sobre el hueso.',
  largo_pantalon: 'De la cintura al tobillo por el costado, con los pies juntos.',
  largo_falda: 'De la cintura al largo deseado por el costado.',
};

/** Posición en el orden corporal de toma; las medidas que no son base quedan después (500+). */
export function measureOrder(key: string, customSort = 0): number {
  const i = BASE_MEASURES.findIndex((m) => m.key === key);
  return i >= 0 ? i : 500 + customSort;
}

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
