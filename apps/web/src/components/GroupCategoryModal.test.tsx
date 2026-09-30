import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { GroupCategoryModal } from './GroupCategoryModal';

describe('Categorías de grupo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista las categorías existentes y permite crear una nueva', async () => {
    api.get.mockResolvedValue([{ id: 'c1', name: 'Temporada 2026', sort: 0 }]);
    api.post.mockResolvedValue({ id: 'c2', name: 'Temporada 2027' });
    const onClose = vi.fn();
    renderApp(<GroupCategoryModal show onClose={onClose} />);
    expect(await screen.findByText('Temporada 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(await screen.findByText('Poné un nombre para la categoría.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Temporada 2027');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/group-categories', { name: 'Temporada 2027' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('permite renombrar una categoría', async () => {
    api.get.mockResolvedValue([{ id: 'c1', name: 'Temporada 2026', sort: 0 }]);
    api.patch.mockResolvedValue({});
    renderApp(<GroupCategoryModal show onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar Temporada 2026' }));
    const input = screen.getByLabelText('Renombrar Temporada 2026');
    await userEvent.clear(input);
    await userEvent.type(input, 'Temporada 2026-2027');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/group-categories/c1', { name: 'Temporada 2026-2027' }));
  });

  it('borrar una categoría avisa que los grupos quedan sin categoría', async () => {
    api.get.mockResolvedValue([{ id: 'c1', name: 'Temporada 2026', sort: 0 }]);
    api.delete.mockResolvedValue(undefined);
    renderApp(<GroupCategoryModal show onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Temporada 2026' }));
    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1]!;
    expect(within(dialog).getByText('¿Eliminar Temporada 2026?')).toBeInTheDocument();
    expect(within(dialog).getByText(/quedan sin categoría/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar categoría' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/group-categories/c1'));
    expect(await screen.findByText('Categoría Temporada 2026 eliminada. Los grupos quedaron sin categoría.')).toBeInTheDocument();
  });
});
