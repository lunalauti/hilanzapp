import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../lib/files', async (orig) => ({ ...(await orig<typeof import('../lib/files')>()), openPdf: files.openPdf }));

import { Production } from './Production';

const data = {
  dancerCount: 12, totalUnits: 10,
  byGarment: [{ moldKey: 'pantalon', moldName: 'Pantalón', total: 10, sizes: [
    { label: '8', count: 3, dancers: ['Ana', 'Bea', 'Cami'] },
    { label: '10', count: 4, dancers: ['Dani', 'Eli', 'Flor', 'Gala'] },
    { label: '12', count: 2, dancers: ['Hebe', 'Ines'] },
    { label: '14', count: 1, dancers: ['Juli'] },
  ] }],
  pending: [
    { dancerId: 'p1', name: 'Lucía Gómez', reason: 'no_assignment', moldNames: [] },
    { dancerId: 'p2', name: 'Sofía Ferreyra', reason: 'no_size', moldNames: ['Pantalón'] },
  ],
};
const view = () => renderApp(<Production />, { route: '/groups/g1/production', path: '/groups/:groupId/production' });

describe('Producción', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(data); });

  it('muestra cantidades por prenda y talle (ejemplo del Req 7)', async () => {
    view();
    expect(await screen.findByRole('heading', { name: 'Pantalón' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /talle 8: 3 prendas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /talle 10: 4 prendas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /talle 14: 1 prenda$/ })).toBeInTheDocument();
    expect(screen.getByText('10 prendas')).toBeInTheDocument();
  });

  it('al tocar un talle lista quiénes son, y al volver a tocarlo se cierra', async () => {
    view();
    const btn = await screen.findByRole('button', { name: /talle 10: 4 prendas/ });
    await userEvent.click(btn);
    const region = screen.getByRole('region', { name: 'Pantalón talle 10' });
    expect(region).toHaveTextContent('Dani');
    expect(region).toHaveTextContent('Gala');
    await userEvent.click(screen.getByRole('button', { name: /talle 8: 3 prendas/ }));
    expect(screen.queryByRole('region', { name: 'Pantalón talle 10' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pantalón talle 8' })).toHaveTextContent('Ana');
    await userEvent.click(screen.getByRole('button', { name: /talle 8: 3 prendas/ }));
    expect(screen.queryByRole('region', { name: 'Pantalón talle 8' })).not.toBeInTheDocument();
  });

  it('destaca a las pendientes y explica por qué no entran', async () => {
    view();
    expect(await screen.findByText(/2 pendientes, no entran en el conteo/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lucía Gómez/ })).toHaveTextContent('sin prendas asignadas');
    expect(screen.getByRole('link', { name: /Sofía Ferreyra/ })).toHaveTextContent('sin talle (Pantalón)');
    expect(screen.getByRole('link', { name: /Lucía Gómez/ })).toHaveAttribute('href', '/dancers/p1');
  });

  it('sin datos muestra el estado vacío', async () => {
    api.get.mockResolvedValue({ dancerCount: 0, totalUnits: 0, byGarment: [], pending: [] });
    view();
    expect(await screen.findByText('Todavía no hay nada para producir')).toBeInTheDocument();
  });

  it('exporta el resumen a PDF', async () => {
    const blob = new Blob(['%PDF-']);
    api.getBlob.mockResolvedValue(blob);
    view();
    await userEvent.click(await screen.findByRole('button', { name: /Exportar PDF/ }));
    await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/groups/g1/production/pdf'));
    expect(files.openPdf).toHaveBeenCalledWith(blob, 'produccion.pdf');
  });

  it('avisa si no se pudo generar el PDF', async () => {
    api.getBlob.mockRejectedValue(new Error('caída'));
    view();
    await userEvent.click(await screen.findByRole('button', { name: /Exportar PDF/ }));
    expect(await screen.findByText('No pudimos generar el PDF')).toBeInTheDocument();
  });

  it('sin prendas el botón de PDF está deshabilitado', async () => {
    api.get.mockResolvedValue({ dancerCount: 0, totalUnits: 0, byGarment: [], pending: [] });
    view();
    expect(await screen.findByRole('button', { name: /Exportar PDF/ })).toBeDisabled();
  });
});
