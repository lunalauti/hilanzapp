import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { GroupLayout } from './GroupLayout';

const group = (over: Record<string, unknown> = {}) => ({ id: 'g1', name: 'Ágata', created_at: '', category_id: null, archived_at: null, dancerCount: 3, complete: 2, partial: 1, none: 0, ...over });

function setup(over: Record<string, unknown> = {}) {
  api.get.mockImplementation(async (p: string) => (p === '/group-categories' ? [] : [group(over)]));
  return renderApp(<GroupLayout />, { route: '/groups/g1', path: '/groups/:groupId' });
}

describe('GroupLayout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archiva el grupo desde el menú y avisa', async () => {
    api.patch.mockResolvedValue({});
    setup();
    await screen.findByRole('heading', { name: 'Ágata' });
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del grupo' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archivar grupo' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/groups/g1', { archived: true }));
    expect(await screen.findByText('Ágata archivado')).toBeInTheDocument();
  });

  it('un grupo archivado muestra la etiqueta y ofrece desarchivar', async () => {
    api.patch.mockResolvedValue({});
    setup({ archived_at: '2026-01-01' });
    expect(await screen.findByText('Archivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones del grupo' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Desarchivar grupo' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/groups/g1', { archived: false }));
    expect(await screen.findByText('Ágata volvió a estar activo')).toBeInTheDocument();
  });
});
