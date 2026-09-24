import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { MoldSheet } from './MoldSheet';

const molds = [{
  id: 'm1', key: 'vestido', name: 'Vestido campana con canesú', category: 'vestido', sizePriority: 'both',
  inputs: [
    { key: 'pecho', label: 'Contorno de pecho', source: 'measure', required: true },
    { key: 'cadera', label: 'Contorno de cadera', source: 'measure', required: true },
    { key: 'largo_canesu', label: 'Largo de canesú', source: 'manual', required: true },
    { key: 'vuelo', label: 'Tipo de vuelo', source: 'choice', defaultOptionId: 'campana', options: [{ id: 'media', label: '1/2 campana', value: 3.14 }, { id: 'campana', label: 'Campana', value: 6.28 }] },
  ],
}];
const measure = (key: string, name: string, valueCm: number | null) => ({ definitionId: key, key, name, isBase: true, required: true, valueCm, note: null, takenOn: null, versionId: null });

function route(url: string) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/groups') return [{ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 1, complete: 1, partial: 0, none: 0 }];
    if (path === '/mold-types') return molds;
    if (path === '/dancers/d1') return { id: 'd1', group_id: 'g1', name: 'Martina López', age: 16 };
    if (path === '/groups/g1/dancers') return [{ id: 'd1', name: 'Martina López' }];
    if (path === '/dancers/d1/measurements') return [measure('pecho', 'Contorno de pecho', 88), measure('cadera', 'Contorno de cadera', url === 'blocked' ? null : 94)];
    throw new Error(`GET inesperado ${path}`);
  });
}
const view = () => renderApp(<MoldSheet />, { route: '/moldes?dancer=d1&mold=m1', path: '/moldes' });

describe('Hoja de molde', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con medidas faltantes bloquea el cálculo, dice cuáles y enlaza a la ficha', async () => {
    route('blocked');
    api.post.mockRejectedValue(new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan datos', { missing: [{ key: 'cadera', label: 'Contorno de cadera', source: 'measure' }] }));
    view();
    expect(await screen.findByText(/No se puede calcular todavía/)).toBeInTheDocument();
    expect(screen.getByText(/Faltan 1 de las 2 medidas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contorno de cadera/ })).toHaveAttribute('href', '/dancers/d1?tab=medidas');
    expect(screen.getByText(/Los resultados aparecen cuando estén todas las medidas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar hoja/ })).toBeDisabled();
  });

  it('pide el dato manual y luego muestra real, fórmula y resultado', async () => {
    route('ok');
    api.post.mockImplementation(async (path: string, body: { manualInputs: Record<string, number> }) => {
      if (path !== '/calculations') throw new Error('POST inesperado');
      if (body.manualInputs.largo_canesu === undefined) throw new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan', { missing: [{ key: 'largo_canesu', label: 'Largo de canesú', source: 'manual' }] });
      return {
        dancer: { id: 'd1', name: 'Martina López', age: 16 }, mold: { id: 'm1', key: 'vestido', name: 'Vestido', sizePriority: 'both' }, table: null,
        size: { label: '42', origin: 'suggested', suggested: '42' }, inputs: [], manualInputs: body.manualInputs, choices: {},
        rows: [{ key: 'cuarto_pecho', label: '1/4 pecho', section: 'Canesú', realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 4', result: 22, display: '22' }],
      };
    });
    view();
    expect(await screen.findByText(/Completá los datos de arriba/)).toBeInTheDocument();
    expect(screen.queryByText(/No se puede calcular todavía/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Largo de canesú'), '12');
    expect(await screen.findByText('1/4 pecho')).toBeInTheDocument();
    expect(screen.getByText('÷ 4')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('Canesú')).toBeInTheDocument();
    expect(screen.getByTitle('Talle sugerido')).toHaveTextContent('T42');
    expect(api.post).toHaveBeenLastCalledWith('/calculations', { dancerId: 'd1', moldTypeId: 'm1', manualInputs: { largo_canesu: 12 }, choices: { vuelo: 'campana' } });
  });

  it('un valor manual inválido no llama a la API', async () => {
    route('ok');
    api.post.mockRejectedValue(new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan', { missing: [{ key: 'largo_canesu', label: 'Largo de canesú', source: 'manual' }] }));
    view();
    await screen.findByText(/Completá los datos de arriba/);
    const callsBefore = api.post.mock.calls.length;
    await userEvent.type(screen.getByLabelText('Largo de canesú'), 'doce');
    expect(await screen.findByText('Ingresá un número.')).toBeInTheDocument();
    expect(api.post.mock.calls.length).toBe(callsBefore);
  });

  it('cambiar el vuelo recalcula con la opción elegida y se puede guardar la hoja', async () => {
    route('ok');
    api.post.mockImplementation(async (path: string, body: { choices: Record<string, string> }) => {
      if (path === '/pattern-sheets') return { id: 's1' };
      return {
        dancer: { id: 'd1', name: 'Martina', age: 16 }, mold: { id: 'm1', key: 'v', name: 'V', sizePriority: 'both' }, table: null, size: { label: '42', origin: 'suggested', suggested: '42' },
        inputs: [], manualInputs: {}, choices: body.choices,
        rows: [{ key: 'r', label: 'Radio', section: null, realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 3,14', result: 28, display: '28' }],
      };
    });
    view();
    await userEvent.type(await screen.findByLabelText('Largo de canesú'), '12');
    await userEvent.click(screen.getByRole('button', { name: '1/2 campana' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/calculations', expect.objectContaining({ choices: { vuelo: 'media' } })));
    await userEvent.click(await screen.findByRole('button', { name: /Guardar hoja/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pattern-sheets', expect.objectContaining({ dancerId: 'd1', moldTypeId: 'm1' })));
    expect(await screen.findByText('Hoja de molde guardada')).toBeInTheDocument();
  });
});
