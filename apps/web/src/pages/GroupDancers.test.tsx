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

const rowAction = async (dancerName: string, action: string) => {
  await userEvent.click(screen.getByRole('button', { name: `Acciones de ${dancerName}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
};
const view = () => renderApp(<GroupDancers />, { route: '/groups/g1', path: '/groups/:groupId' });

describe('GroupDancers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (p: string) => {
      if (p === '/designs') return [{ id: 'ds1', name: 'Vestido Aurora', images: [], garments: [{ id: 'g1', moldTypeId: 'mv', moldName: 'Vestido', laborCost: null }, { id: 'g2', moldTypeId: 'mp', moldName: 'Pantalón', laborCost: null }] }, { id: 'ds2', name: 'Vacío', images: [], garments: [] }];
      if (p === '/dancers/d9/measure-plan') return { items: [{ definitionId: 'a', key: 'pecho', name: 'Contorno de pecho', sort: 1, isBase: true, requiredBy: [{ kind: 'garment', label: 'Vestido' }], value: null, takenOn: null }, { definitionId: 'b', key: 'cintura', name: 'Contorno de cintura', sort: 2, isBase: true, requiredBy: [{ kind: 'garment', label: 'Vestido' }], value: null, takenOn: null }, { definitionId: 'c', key: 'hr', name: 'Largo hombro-rodilla', sort: 3, isBase: true, requiredBy: [{ kind: 'design', label: 'Vestido Aurora' }], value: null, takenOn: null }], total: 3, done: 0, missing: 3, status: 'none' };
      if (p.endsWith('/impact')) return { measures: 7, versions: 14, assignments: 2, sheets: 0 };
      return list;
    });
  });

  it('muestra estado de medidas, talle sugerido, manual y sin talle', async () => {
    view();
    expect(await screen.findByRole('link', { name: 'Martina López' })).toHaveAttribute('href', '/dancers/d1');
    expect(screen.getAllByText('Completas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Faltan 5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Faltan 7').length).toBeGreaterThan(0); // sin nada cargado
    expect(screen.getByTitle('Talle asignado a mano')).toHaveTextContent('T50');
    expect(screen.queryByText('Sin talle')).not.toBeInTheDocument(); // sin talle es un guion, no un recuadro
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
    await rowAction('Martina López', 'Eliminar');
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
    await rowAction('Martina López', 'Eliminar');
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
    await rowAction('Martina López', 'Editar');
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
    expect(await screen.findByText('Para este vestuario vas a necesitar:')).toBeInTheDocument();
    expect(await screen.findByText('Contorno de pecho, cintura, largo hombro-rodilla*')).toBeInTheDocument();
    expect(screen.getByText('* Medida especial de Vestido Aurora.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tomar medidas ahora/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Después' })).toBeInTheDocument();
  });

  it('el encabezado del alta dice a qué grupo se agrega', async () => {
    view();
    await screen.findByText('Martina López');
    await userEvent.click(screen.getByRole('button', { name: /Agregar bailarina/ }));
    expect(await screen.findByRole('heading', { name: /Nueva bailarina/ })).toBeInTheDocument();
    expect(screen.getByText(/Las medidas se cargan después, en su ficha\./)).toBeInTheDocument();
  });

  describe('una pantalla más calma', () => {
    it('un solo aviso de siguiente paso, con tomar medidas del grupo y ver faltantes', async () => {
      view();
      const aviso = await screen.findByRole('region', { name: 'Siguiente paso' });
      expect(aviso).toHaveTextContent('2 bailarinas con medidas pendientes');
      expect(within(aviso).getByRole('link', { name: 'Tomar medidas del grupo' })).toHaveAttribute('href', '/groups/g1/medir');
      expect(within(aviso).getByRole('link', { name: 'Ver faltantes' })).toHaveAttribute('href', '/groups/g1/faltantes');
      expect(screen.queryByRole('button', { name: /Hojas de molde en PDF/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Agregar bailarina/ })).toHaveLength(1);
    });

    it('sin pendientes el aviso desaparece', async () => {
      api.get.mockImplementation(async () => [dancer(), dancer({ id: 'd5', name: 'Ana Sosa' })]);
      view();
      await screen.findByText('Martina López');
      expect(screen.queryByRole('region', { name: 'Siguiente paso' })).not.toBeInTheDocument();
    });

    it('cada fila tiene un solo menú con tomar medidas, editar y eliminar', async () => {
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Sofía Ferreyra' }));
      const items = await screen.findAllByRole('menuitem');
      expect(items.map((i) => i.textContent)).toEqual(['Tomar medidas', 'Editar', 'Eliminar']);
      expect(screen.getByRole('menuitem', { name: 'Tomar medidas' })).toHaveAttribute('href', '/dancers/d2/medir?volver=%2Fgroups%2Fg1');
      expect(screen.queryByRole('button', { name: 'Editar Sofía Ferreyra' })).not.toBeInTheDocument();
    });

    it('las columnas de talle y vestuario aparecen solo cuando hay algo que mostrar', async () => {
      const bare = (id: string, name: string) => dancer({ id, name, garments: [], size: { label: null, origin: null, suggested: null, manual: null, outOfRange: false }, measureStatus: 'none', requiredDone: 0 });
      api.get.mockImplementation(async () => [bare('x1', 'Amira'), bare('x2', 'Camila')]);
      view();
      await screen.findByText('Amira');
      expect(screen.queryByText('Vestuario')).not.toBeInTheDocument();
      expect(screen.queryByText('Talle')).not.toBeInTheDocument();
      expect(screen.getByText('Medidas')).toBeInTheDocument();
    });

    it('permite filtrar por prenda cuando hay vestuario asignado', async () => {
      view();
      await screen.findByText('Martina López');
      const chip = screen.getByRole('button', { name: /^Pantalón \d/ });
      await userEvent.click(chip);
      expect(chip).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByText('Sofía Ferreyra')).not.toBeInTheDocument();
      expect(screen.getByText('Martina López')).toBeInTheDocument();
    });
  });
});
