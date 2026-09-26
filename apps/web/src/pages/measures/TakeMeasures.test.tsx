import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { TakeMeasures } from './TakeMeasures';

const item = (key: string, name: string, value: number | null, sort: number, by = 'Pantalón', kind = 'garment') => ({
  definitionId: `d_${key}`, key, name, sort, isBase: true, requiredBy: [{ kind, label: by }], value, takenOn: value === null ? null : '2026-09-12',
});
const plan = (items = [
  item('pecho', 'Contorno de pecho', 88, 3, 'Vestido Aurora'),
  item('cintura', 'Contorno de cintura', 70, 14, 'Vestido Aurora'),
  item('cadera', 'Contorno de cadera', null, 16),
  item('largo_pantalon', 'Largo de pantalón', null, 21),
  item('largo_hombro_rodilla', 'Largo hombro-rodilla', null, 9, 'Vestido Aurora', 'design'),
]) => ({ items, total: items.length, done: items.filter((i) => i.value !== null).length, missing: items.filter((i) => i.value === null).length, status: 'partial' });
const defs = [
  { id: 'd_pecho', key: 'pecho', name: 'Contorno de pecho', kind: 'body', isBase: true, required: true, sort: 3, help: 'Por la parte más saliente.' },
  { id: 'd_cadera', key: 'cadera', name: 'Contorno de cadera', kind: 'body', isBase: true, required: true, sort: 16, help: 'En la parte más ancha de la cola, con los pies juntos.' },
  { id: 'd_largo_pantalon', key: 'largo_pantalon', name: 'Largo de pantalón', kind: 'body', isBase: true, required: false, sort: 21, help: null },
  { id: 'd_muslo', key: 'muslo', name: 'Contorno de muslo', kind: 'body', isBase: true, required: false, sort: 17, help: null },
  { id: 'd_manga', key: 'largo_manga', name: 'Largo de manga', kind: 'body', isBase: true, required: false, sort: 13, help: null },
  { id: 'd_estandar', key: 'altura_tiro', name: 'Altura de tiro', kind: 'standard', isBase: false, required: false, sort: 501, help: null },
];

function setup(over: { plan?: unknown; props?: Partial<Parameters<typeof TakeMeasures>[0]> } = {}) {
  api.get.mockImplementation((path: string) => {
    if (path === '/dancers/dn1') return Promise.resolve({ id: 'dn1', group_id: 'g1', name: 'Emi Paz', age: 9 });
    if (path === '/dancers/dn1/measure-plan') return Promise.resolve(over.plan ?? plan());
    if (path === '/measure-definitions') return Promise.resolve(defs);
    return Promise.reject(new Error(`sin mock: ${path}`));
  });
  const onExit = vi.fn();
  const onOpenSheet = vi.fn();
  renderApp(<TakeMeasures dancerId="dn1" onExit={onExit} onOpenSheet={onOpenSheet} {...over.props} />);
  return { onExit, onOpenSheet };
}
const field = () => screen.findByLabelText('Valor medido');

describe('Tomar medidas', () => {
  beforeEach(() => { vi.clearAllMocks(); api.put.mockResolvedValue({}); });

  it('arranca en la primera medida que falta, con quién la pide y el progreso', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Contorno de cadera' })).toBeInTheDocument();
    expect(screen.getByText('3 de 5')).toBeInTheDocument();
    expect(screen.getByText('Pedida por Pantalón')).toBeInTheDocument();
    expect(screen.getByText('Pedido por: Vestido Aurora · Pantalón')).toBeInTheDocument();
    expect(screen.getByText('Emi Paz')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Medidas cargadas' })).toHaveAttribute('aria-valuenow', '2');
  });

  it('muestra la ayuda "¿Cómo se toma?" solo cuando se pide', async () => {
    setup();
    await field();
    expect(screen.queryByText(/parte más ancha de la cola/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /¿Cómo se toma\?/ }));
    expect(screen.getByText(/parte más ancha de la cola/)).toBeInTheDocument();
  });

  it('guarda con Enter (coma decimal) y pasa a la siguiente medida', async () => {
    setup();
    await userEvent.type(await field(), '94,5{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/dn1/measurements/d_cadera', { valueCm: 94.5 }));
    expect(await screen.findByRole('heading', { name: 'Largo de pantalón' })).toBeInTheDocument();
    expect(screen.getByText('4 de 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contorno de cadera: hecha' })).toBeInTheDocument();
  });

  it('valida el campo vacío y el rango sin guardar', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Cargá un valor o tocá Saltar.')).toBeInTheDocument();
    await userEvent.type(await field(), '1200');
    expect(await screen.findByText('Ingresá un valor entre 0 y 1000 cm.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('si falla el guardado conserva el valor y permite reintentar', async () => {
    api.put.mockRejectedValueOnce(new Error('sin señal')).mockResolvedValueOnce({});
    setup();
    await userEvent.type(await field(), '94');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByLabelText('Valor medido')).toHaveValue('94');
    expect(screen.getByRole('heading', { name: 'Contorno de cadera' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Largo de pantalón' })).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(2);
  });

  it('Saltar deja la medida pendiente; el resumen la ofrece para cargar ahora y muestra las cargadas', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }));
    await userEvent.type(await field(), '66{Enter}');
    await userEvent.type(await field(), '112{Enter}');
    expect(await screen.findByRole('heading', { name: /Listo, cargaste 4 medidas/ })).toBeInTheDocument();
    expect(screen.getByText('Contorno de cadera · saltada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar ahora' }));
    expect(await screen.findByRole('heading', { name: 'Contorno de cadera' })).toBeInTheDocument();
  });

  it('una medida ya cargada ofrece repetirla sin pisar el historial', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Contorno de pecho: hecha' }));
    expect(await screen.findByText(/Ya cargada · 12 sep/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Repetir medición' }));
    expect(screen.getByText(/Antes: 88 cm · 12 sep/)).toBeInTheDocument();
    await userEvent.type(await field(), '89{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/dn1/measurements/d_pecho', { valueCm: 89 }));
  });

  it('marca las medidas especiales del diseño', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Largo hombro-rodilla: pendiente' }));
    expect(await screen.findByText('MEDIDA ESPECIAL')).toBeInTheDocument();
  });

  it('agrega medidas extra buscando sin tildes ni mayúsculas y las suma a la cola', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar más medidas' }));
    const sheet = await screen.findByRole('dialog', { name: 'Agregar medidas' });
    await userEvent.type(within(sheet).getByLabelText('Buscar medida'), 'MANGA');
    expect(within(sheet).getByRole('checkbox', { name: /Largo de manga/ })).toBeInTheDocument();
    expect(within(sheet).queryByRole('checkbox', { name: /Contorno de muslo/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('checkbox', { name: /Altura de tiro/ })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Largo de manga/ }));
    expect(within(sheet).getByText('1 elegida')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Agregar a la toma' }));
    expect(screen.queryByRole('dialog', { name: 'Agregar medidas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Largo de manga: pendiente' })).toBeInTheDocument();
    expect(screen.getByText('EXTRA')).toBeInTheDocument();
  });

  it('se puede limitar a algunas medidas y cerrar con Escape', async () => {
    const { onExit } = setup({ props: { only: ['cadera', 'largo_pantalon'] } });
    expect(await screen.findByText('1 de 2')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalled();
  });

  it('si no hay nada que tomar lo dice y permite agregar medidas', async () => {
    setup({ plan: { items: [], total: 0, done: 0, missing: 0, status: 'complete' } });
    expect(await screen.findByRole('heading', { name: 'Nada que tomar' })).toBeInTheDocument();
    expect(screen.getByText('Esta bailarina tiene todas las medidas que piden sus prendas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar medidas' })).toBeInTheDocument();
  });

  it('desde el resumen se puede ir a la hoja de molde', async () => {
    const { onOpenSheet } = setup({ plan: plan([item('cadera', 'Contorno de cadera', null, 16)]) });
    await userEvent.type(await field(), '90{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver hoja de molde' }));
    expect(onOpenSheet).toHaveBeenCalled();
  });

  it('en el recorrido del grupo muestra la pantalla intermedia con la siguiente bailarina', async () => {
    const chain = { position: 1, total: 5, next: { name: 'Lucía', missing: 4 }, onNext: vi.fn(), onSkipDancer: vi.fn(), onFinish: vi.fn() };
    setup({ plan: plan([item('cadera', 'Contorno de cadera', null, 16)]), props: { chain } });
    expect(await screen.findByText('Toma del grupo · 1 de 5')).toBeInTheDocument();
    await userEvent.type(await field(), '90{Enter}');
    expect(await screen.findByRole('heading', { name: 'Emi Paz terminada ✓' })).toBeInTheDocument();
    expect(screen.getByText('Lucía')).toBeInTheDocument();
    expect(screen.getByText('4 faltan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(chain.onNext).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Saltar bailarina' }));
    expect(chain.onSkipDancer).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(chain.onFinish).toHaveBeenCalled();
  });
});
