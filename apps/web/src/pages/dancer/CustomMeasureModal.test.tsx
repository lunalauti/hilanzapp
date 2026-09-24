import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { CustomMeasureModal } from './CustomMeasureModal';

describe('Medida personalizada', () => {
  beforeEach(() => vi.clearAllMocks());
  const view = (onSaved = vi.fn()) => { renderApp(<CustomMeasureModal show dancerId="d1" onClose={vi.fn()} onSaved={onSaved} />); return onSaved; };

  it('exige nombre y un valor numérico', async () => {
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Poné un nombre para la medida.')).toBeInTheDocument();
    expect(screen.getAllByText('Cargá un valor entre 1 y 250 cm.').length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('crea la definición y carga el valor con su observación', async () => {
    api.post.mockResolvedValue({ id: 'def9' });
    api.put.mockResolvedValue({});
    const onSaved = view();
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Largo falda trasera');
    await userEvent.type(screen.getByLabelText('Valor (cm)'), '68,5');
    await userEvent.type(screen.getByLabelText(/Observación/), 'Desde segunda cintura');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/measure-definitions', { name: 'Largo falda trasera' }));
    expect(api.put).toHaveBeenCalledWith('/dancers/d1/measurements/def9', { valueCm: 68.5, note: 'Desde segunda cintura' });
    expect(onSaved).toHaveBeenCalledWith('Largo falda trasera');
  });

  it('rechaza valores fuera de 1 a 250 cm', async () => {
    view();
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Contorno de rodilla');
    for (const v of ['0', '251', '-4']) {
      await userEvent.clear(screen.getByLabelText('Valor (cm)'));
      await userEvent.type(screen.getByLabelText('Valor (cm)'), v);
      await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));
      expect(screen.getAllByText('Cargá un valor entre 1 y 250 cm.').length).toBeGreaterThan(0);
    }
    expect(api.post).not.toHaveBeenCalled();
  });
});
