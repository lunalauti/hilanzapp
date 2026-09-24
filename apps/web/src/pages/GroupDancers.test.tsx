import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { GroupDancers } from './GroupDancers';

const dancer = (over = {}) => ({
  id: 'd1', name: 'Martina López', age: 16, notes: null, groupId: 'g1', measureStatus: 'complete', requiredDone: 7, requiredTotal: 7,
  size: { label: '42', origin: 'suggested', suggested: '42', manual: null, outOfRange: false }, garments: [{ assignmentId: 'a1', moldKey: 'pantalon', moldName: 'Pantalón', designName: null, sizeLabel: '42' }], ...over,
});

const list = [
  dancer(),
  dancer({ id: 'd2', name: 'Sofía Ferreyra', measureStatus: 'partial', requiredDone: 2, size: { label: '40', origin: 'suggested', suggested: '40', manual: null, outOfRange: true }, garments: [] }),
  dancer({ id: 'd3', name: 'Valentina Ruiz', size: { label: '50', origin: 'dancer', suggested: '44', manual: '50', outOfRange: false } }),
  dancer({ id: 'd4', name: 'Lucía Gómez', measureStatus: 'none', requiredDone: 0, size: { label: null, origin: null, suggested: null, manual: null, outOfRange: false }, garments: [] }),
];

const view = () => renderApp(<GroupDancers />, { route: '/groups/g1', path: '/groups/:groupId' });

describe('GroupDancers', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(list); });

  it('muestra estado de medidas, talle sugerido, manual y sin talle', async () => {
    view();
    expect(await screen.findByRole('link', { name: 'Martina López' })).toHaveAttribute('href', '/dancers/d1');
    expect(screen.getAllByText('Completa').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Parcial · faltan 5/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin cargar').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Talle asignado a mano')).toHaveTextContent('T50');
    expect(screen.getAllByText('Sin talle')).toHaveLength(1);
    expect(screen.getByLabelText('Fuera de la tabla')).toBeInTheDocument();
  });

  it('filtra las pendientes', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Pendientes 2/ }));
    expect(screen.queryByText('Martina López')).not.toBeInTheDocument();
    expect(screen.getByText('Sofía Ferreyra')).toBeInTheDocument();
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
  });

  it('pide confirmación antes de eliminar y borra con confirm=true', async () => {
    api.delete.mockResolvedValue(undefined);
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar Martina López' })[0]!);
    expect(await screen.findByText(/Se van a eliminar sus medidas/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar bailarina' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/dancers/d1?confirm=true'));
    expect(await screen.findByText('Martina López eliminada')).toBeInTheDocument();
  });

  it('cancelar no elimina', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar Martina López' })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('valida el alta de una bailarina', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Agregar bailarina/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Camila');
    await userEvent.type(screen.getByLabelText(/Edad/), '200');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/entre 0 y 120/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText(/Edad/));
    await userEvent.type(screen.getByLabelText(/Edad/), '15');
    api.post.mockResolvedValue({ id: 'd9' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/dancers', { groupId: 'g1', name: 'Camila', age: 15 }));
  });
});
