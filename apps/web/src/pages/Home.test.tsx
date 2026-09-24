import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { Home } from './Home';

const group = (over = {}) => ({ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 12, complete: 9, partial: 1, none: 2, ...over });

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista los grupos con conteos y avance', async () => {
    api.get.mockResolvedValue([group(), group({ id: 'g2', name: 'Jade', dancerCount: 14, complete: 14, partial: 0, none: 0 })]);
    renderApp(<Home />);
    expect(await screen.findByText('Ágata')).toBeInTheDocument();
    expect(screen.getByText('Jade')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('con medidas pendientes')).toBeInTheDocument();
    expect(screen.getByText('75 %')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ágata/ })).toHaveAttribute('href', '/groups/g1');
  });

  it('muestra el estado vacío del primer uso', async () => {
    api.get.mockResolvedValue([]);
    renderApp(<Home />);
    expect(await screen.findByText('Todavía no tenés grupos')).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    api.get.mockRejectedValueOnce(new Error('caída')).mockResolvedValueOnce([group()]);
    renderApp(<Home />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ágata')).toBeInTheDocument();
  });

  it('filtra por nombre', async () => {
    api.get.mockResolvedValue([group(), group({ id: 'g2', name: 'Jade' })]);
    renderApp(<Home />);
    await screen.findByText('Jade');
    fireEvent.change(screen.getByLabelText('Buscar grupo'), { target: { value: 'jad' } });
    expect(screen.queryByText('Ágata')).not.toBeInTheDocument();
    expect(screen.getByText('Jade')).toBeInTheDocument();
  });

  it('el nuevo grupo exige nombre y luego lo crea', async () => {
    api.get.mockResolvedValue([group()]);
    api.post.mockResolvedValue({ id: 'g3', name: 'Turmalina' });
    renderApp(<Home />);
    await screen.findByText('Ágata');
    await userEvent.click(screen.getByRole('button', { name: /Nuevo grupo/ }));

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Nombre del grupo'), 'Turmalina');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/groups', { name: 'Turmalina' }));
    expect(await screen.findByText('Grupo Turmalina creado')).toBeInTheDocument();
  });
});
