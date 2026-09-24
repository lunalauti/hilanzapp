import { useCallback, useState } from 'react';
import { getCookie, setCookie } from './cookies';
import { useDesigns, useGroups, useMaterials, useStats } from './queries';

export const SETUP_COOKIE = 'hz_setup_done';
export const SETUP_DISMISS_COOKIE = 'hz_setup_dismissed';

export type SetupPhase = 'taller' | 'grupo' | 'produccion';

export interface SetupStep {
  id: string;
  phase: SetupPhase;
  title: string;
  why: string;
  to: string;
  action: string;
  /** Sin dato que lo detecte: la modista lo marca a mano. */
  manual: boolean;
  done: boolean;
}

export const PHASES: { id: SetupPhase; title: string; note: string }[] = [
  { id: 'taller', title: 'Armá tu taller', note: 'Se hace una sola vez.' },
  { id: 'grupo', title: 'Tu primer grupo', note: 'Bailarinas, medidas y talle.' },
  { id: 'produccion', title: 'A producir', note: 'De la hoja de molde al costo.' },
];

const readDone = (): string[] => (getCookie(SETUP_COOKIE) ?? '').split(',').filter(Boolean);

/** Pasos guiados; lo que se puede detectar con datos se tilda solo, el resto se marca a mano. */
export function useSetup() {
  const groups = useGroups();
  const materials = useMaterials();
  const designs = useDesigns();
  const stats = useStats();
  const [marked, setMarked] = useState<string[]>(readDone);

  const toggle = useCallback((id: string) => {
    setMarked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setCookie(SETUP_COOKIE, next.join(','), 365);
      return next;
    });
  }, []);

  const auto = (id: string, detected: boolean | undefined) => Boolean(detected) || marked.includes(id);

  const steps: SetupStep[] = [
    { id: 'tablas', phase: 'taller', manual: true, title: 'Revisá las tablas de talles', why: 'Vienen cargadas (Bebés, Niños, Adolescentes, Mujeres). Confirmá que sean las que usás; podés duplicar una antes de cambiarla.', to: '/tablas', action: 'Ver tablas', done: marked.includes('tablas') },
    { id: 'formulas', phase: 'taller', manual: true, title: 'Mirá las fórmulas de los moldes', why: 'Ya están los 11 moldes. Solo entrá si querés cambiar un divisor o un ajuste en cm; siempre hay “Restaurar original”.', to: '/formulas', action: 'Ver fórmulas', done: marked.includes('formulas') },
    { id: 'materiales', phase: 'taller', manual: false, title: 'Cargá tus materiales', why: 'Telas, tul, lentejuelas, elástico… con unidad, costo y stock inicial.', to: '/inventario', action: 'Ir a Inventario', done: auto('materiales', (materials.data?.length ?? 0) > 0) },
    { id: 'diseno', phase: 'taller', manual: false, title: 'Creá un diseño', why: 'Junta las prendas, el escote, la manga, la falda, los detalles y las fotos de referencia.', to: '/disenos', action: 'Ir a Diseños', done: auto('diseno', (designs.data?.length ?? 0) > 0) },
    { id: 'consumo', phase: 'taller', manual: true, title: 'Indicá cuánto material lleva cada prenda', why: 'En Inventario, elegí el diseño y cargá el consumo por prenda (puede variar por talle). Con eso se calculan costos y faltantes.', to: '/inventario', action: 'Cargar consumo', done: marked.includes('consumo') },
    { id: 'grupo', phase: 'grupo', manual: false, title: 'Creá un grupo', why: 'Reúne a las bailarinas que comparten vestuario, por ejemplo Ágata o Jade.', to: '/', action: 'Ir a Grupos', done: auto('grupo', (groups.data?.length ?? 0) > 0) },
    { id: 'bailarinas', phase: 'grupo', manual: false, title: 'Agregá a las bailarinas', why: 'Nombre y apellido, edad (define la tabla de talles) y contacto.', to: '/', action: 'Abrir un grupo', done: auto('bailarinas', (stats.data?.dancers ?? 0) > 0) },
    { id: 'medidas', phase: 'grupo', manual: false, title: 'Cargá las medidas reales', why: 'En la ficha de cada bailarina, en centímetros. Cada cambio queda en el historial.', to: '/', action: 'Abrir un grupo', done: auto('medidas', (stats.data?.dancersBySize.length ?? 0) > 0) },
    { id: 'talle', phase: 'grupo', manual: true, title: 'Revisá el talle sugerido', why: 'En la pestaña Talle ves qué sugiere la app. Si no te convence, elegí otro a mano: siempre manda el tuyo.', to: '/', action: 'Abrir un grupo', done: marked.includes('talle') },
    { id: 'asignar', phase: 'produccion', manual: true, title: 'Asigná el diseño al grupo', why: 'Desde el diseño, “Asignar a grupo”: cada bailarina recibe las prendas que necesita.', to: '/disenos', action: 'Ir a Diseños', done: marked.includes('asignar') },
    { id: 'hoja', phase: 'produccion', manual: true, title: 'Generá una hoja de molde', why: 'Elegí bailarina y molde: ves medida real, fórmula y resultado. Guardala, imprimila o exportala a PDF.', to: '/moldes', action: 'Ir a Hojas de molde', done: marked.includes('hoja') },
    { id: 'produccion', phase: 'produccion', manual: true, title: 'Mirá la producción y los costos', why: 'En el grupo, pestaña Producción, ves cuántas prendas cortar por talle. En Inventario, qué falta comprar y cuánto cuesta.', to: '/inventario', action: 'Ver costos', done: marked.includes('produccion') },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const loading = groups.isLoading || materials.isLoading || designs.isLoading || stats.isLoading;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length, loading, toggle };
}

export const isSetupDismissed = () => getCookie(SETUP_DISMISS_COOKIE) === '1';
export const dismissSetup = () => setCookie(SETUP_DISMISS_COOKIE, '1', 365);
