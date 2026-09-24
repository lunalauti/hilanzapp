import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { SizeTab } from './SizeTab';

const sizing = (manual: string | null) => ({
  table: { id: 't1', name: 'Mujeres — Baúl de Moda', ageRange: 'mujer', forced: false }, mold: null, priority: 'pecho',
  perMeasure: [
    { measureKey: 'pecho', value: 88, sizeLabel: '42', outOfRange: null },
    { measureKey: 'cintura', value: 70, sizeLabel: '44', outOfRange: null },
    { measureKey: 'cadera', value: 100, sizeLabel: '46', outOfRange: null },
  ],
  components: { pecho: '42', cadera: '46' }, suggested: '42', needsReview: false, outOfRange: false, missing: [],
  manual: { assignment: null, dancer: manual }, effective: manual ? { label: manual, origin: 'dancer' } : { label: '42', origin: 'suggested' },
  availableSizes: ['40', '42', '44', '46'],
});

function mockApi(manual: string | null = null) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/dancers/d1/sizing') return sizing(manual);
    if (path === '/dancers/d1/assignments') return [{ id: 'a1', moldTypeId: 'm1', moldKey: 'pantalon', moldName: 'Pantalón', designId: null, designName: null, manualSizeLabel: null, suggested: '46', effective: { label: '46', origin: 'suggested' }, needsReview: false }];
    if (path === '/mold-types') return [{ id: 'm1', key: 'pantalon', name: 'Pantalón' }, { id: 'm2', key: 'manga', name: 'Manga' }];
    throw new Error(`GET inesperado ${path}`);
  });
}
const view = () => renderApp(<SizeTab dancerId="d1" />);

describe('Panel de talle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra qué talle da cada medida y el sugerido', async () => {
    mockApi();
    view();
    const breakdown = await screen.findByLabelText('Talle que da cada medida');
    expect(within(breakdown).getByText('Pecho')).toBeInTheDocument();
    expect(within(breakdown).getByText('T42')).toBeInTheDocument();
    expect(within(breakdown).getByText('T44')).toBeInTheDocument();
    expect(within(breakdown).getByText('T46')).toBeInTheDocument();
    expect(screen.getByText('SUGERIDO').previousElementSibling).toHaveTextContent('T42');
    expect(screen.getByText('Sin talle a mano: se usa el sugerido.')).toBeInTheDocument();
  });

  it('el talle a mano se guarda y el sugerido se sigue mostrando', async () => {
    mockApi('44');
    api.put.mockResolvedValue({});
    view();
    expect(await screen.findByText(/Talle a mano: T44\. El sugerido \(T42\) se conserva/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'T44' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'T46' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/d1/size', { manualSizeLabel: '46' }));
    await userEvent.click(screen.getByRole('button', { name: 'Usar sugerido' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/d1/size', { manualSizeLabel: null }));
  });

  it('permite un talle propio por prenda y agregar otra prenda', async () => {
    mockApi();
    api.patch.mockResolvedValue({});
    api.post.mockResolvedValue({});
    view();
    const select = await screen.findByLabelText('Talle de Pantalón');
    await userEvent.selectOptions(select, '44');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/assignments/a1', { manualSizeLabel: '44' }));

    const add = screen.getByLabelText('Prenda a agregar');
    expect(screen.getByRole('button', { name: /Agregar prenda/ })).toBeDisabled();
    expect(within(add).queryByRole('option', { name: 'Pantalón' })).not.toBeInTheDocument();
    expect(within(add).getByRole('option', { name: 'Manga' })).toBeInTheDocument();
    await userEvent.selectOptions(add, 'm2');
    await userEvent.click(screen.getByRole('button', { name: /Agregar prenda/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', { dancerId: 'd1', moldTypeId: 'm2' }));
  });

  it('muestra el error de la API cuando el talle no existe', async () => {
    mockApi();
    const { ApiError } = await import('../../lib/api');
    api.put.mockRejectedValue(new ApiError(422, 'UNKNOWN_SIZE', 'El talle 99 no existe en la tabla'));
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'T40' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El talle 99 no existe');
  });
});
