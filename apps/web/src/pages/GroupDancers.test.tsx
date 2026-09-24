import { screen, waitFor, within } from '@testing-library/react';
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
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (p: string) => {
      if (p === '/designs') return [{ id: 'ds1', name: 'Vestido Aurora', images: [], garments: [{ id: 'g1', moldTypeId: 'mv', moldName: 'Vestido', laborCost: null }, { id: 'g2', moldTypeId: 'mp', moldName: 'Pantalón', laborCost: null }] }, { id: 'ds2', name: 'Vacío', images: [], garments: [] }];
      if (p.endsWith('/impact')) return { measures: 7, versions: 14, assignments: 2, sheets: 0 };
      return list;
    });
  });

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
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Borrar a Martina López?');
    expect(dialog).toHaveTextContent('Esto no se puede deshacer. Se pierden:');
    expect(await within(dialog).findByText('7 medidas')).toBeInTheDocument();
    expect(within(dialog).getByText('14 tomas de historial')).toBeInTheDocument();
    expect(within(dialog).getByText('2 prendas asignadas')).toBeInTheDocument();
    expect(within(dialog).queryByText(/hojas? de molde guardadas?/)).not.toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar para siempre' }));
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
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Camila');
    await userEvent.type(screen.getByLabelText('Edad'), '200');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/entre 0 y 120/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Edad'));
    await userEvent.type(screen.getByLabelText('Edad'), '15');
    api.post.mockResolvedValue({ id: 'd9' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/dancers', { groupId: 'g1', name: 'Camila', age: 15, contact: null }));
  });

  it('avisa si ya hay una bailarina con ese nombre en el grupo (sin distinguir tildes ni mayúsculas)', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Agregar bailarina/ }));
    await userEvent.type(await screen.findByLabelText('Nombre y apellido'), '  martina  lopez ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Ya hay una martina lopez en este grupo\. Sumá un segundo apellido o apodo\./)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('al editar, su propio nombre no cuenta como repetido', async () => {
    api.patch.mockResolvedValue({});
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar Martina López' })[0]!);
    const name = await screen.findByLabelText('Nombre y apellido');
    expect(name).toHaveValue('Martina López');
    await userEvent.type(screen.getByLabelText(/Contacto/), '11 5555-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/dancers/d1', { name: 'Martina López', age: 16, contact: '11 5555-1234' }));
    expect(screen.queryByText('Vestuario asignado')).not.toBeInTheDocument();
  });

  it('al crear se puede asignar vestuario: se agregan todas las prendas del diseño', async () => {
    api.post.mockImplementation(async (p: string) => (p === '/dancers' ? { id: 'd9' } : {}));
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Agregar bailarina/ }));
    await userEvent.type(await screen.findByLabelText('Nombre y apellido'), 'Camila Benítez');
    expect(await screen.findByRole('button', { name: 'Vestido Aurora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vacío' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Vestido Aurora' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', { dancerId: 'd9', moldTypeId: 'mv', designId: 'ds1' }));
    expect(api.post).toHaveBeenCalledWith('/assignments', { dancerId: 'd9', moldTypeId: 'mp', designId: 'ds1' });
    expect(await screen.findByText('Camila Benítez guardada')).toBeInTheDocument();
  });

  it('el encabezado del alta dice a qué grupo se agrega', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Agregar bailarina/ }));
    expect(await screen.findByRole('heading', { name: /Nueva bailarina/ })).toBeInTheDocument();
    expect(screen.getByText(/Las medidas se cargan después, en su ficha\./)).toBeInTheDocument();
  });
});
