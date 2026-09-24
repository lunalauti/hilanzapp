import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { SizeTables } from './SizeTables';

const summary = [
  { id: 't1', name: 'Mujeres — Baúl de Moda', ageRange: 'mujer', source: 'Baúl de Moda', isActive: true, baseTableId: null, templateKey: 'mujeres', sizeCount: 2 },
  { id: 't2', name: 'Mi tabla', ageRange: 'mujer', source: null, isActive: false, baseTableId: 't1', templateKey: null, sizeCount: 1 },
];
const measures = [{ definitionId: 'a', key: 'pecho', name: 'Pecho' }, { definitionId: 'b', key: 'cintura', name: 'Cintura' }, { definitionId: 'c', key: 'cadera', name: 'Cadera' }, { definitionId: 'd', key: 'altura_tiro', name: 'Altura de tiro' }];
const grid = (over = {}) => ({
  ...summary[0], measures,
  sizes: [
    { id: 's40', label: '40', descriptor: null, sort: 0, values: { pecho: { value: 86, origin: 'source' }, cintura: { value: 64, origin: 'source' }, cadera: { value: 90, origin: 'source' }, altura_tiro: { value: 25.6, origin: 'extrapolated' } } },
    { id: 's42', label: '42', descriptor: 'M', sort: 1, values: { pecho: { value: 88.5, origin: 'user' }, cintura: { value: 68, origin: 'interpolated' }, cadera: { value: 94, origin: 'source' } } },
  ],
  ...over,
});
const own = () => ({ ...summary[1], measures: measures.slice(0, 3), sizes: [{ id: 'o1', label: 'S', descriptor: null, sort: 0, values: { pecho: { value: 84, origin: 'user' } } }] });

function setup(route = '/tablas', tables: Record<string, unknown> = { t1: grid(), t2: own() }) {
  api.get.mockImplementation(async (p: string) => {
    if (p === '/size-tables') return summary;
    if (p.startsWith('/size-tables/')) return tables[p.split('/')[2]!];
    if (p === '/measure-definitions') return [...measures.map((m, n) => ({ id: `x${n}`, key: m.key, name: m.name, kind: 'body', isBase: n < 3, required: false })), { id: 'x8', key: 'brazo', name: 'Contorno de brazo', kind: 'body', isBase: true, required: false }];
    throw new Error(`GET inesperado ${p}`);
  });
  api.patch.mockResolvedValue({});
  return renderApp(<SizeTables />, { route, path: '/tablas' });
}

describe('Editor de tablas de talles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra la tabla activa con la grilla completa talle × medida', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Mujeres — Baúl de Moda' })).toBeInTheDocument();
    expect(screen.getByText(/Tabla activa · Adultas/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Talle', 'Pecho', 'Cintura', 'Cadera', 'Altura de tiro', '']);
    expect(within(table).getByRole('button', { name: 'Pecho del talle 40: 86' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Altura de tiro del talle 42: sin valor' })).toHaveTextContent('—');
  });

  it('marca el origen de cada celda: fuente, interpolado, extrapolado y editado', async () => {
    setup();
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Pecho del talle 40: 86' })).toHaveClass('source');
    expect(screen.getByRole('button', { name: 'Cintura del talle 42: 68' })).toHaveClass('interpolated');
    expect(screen.getByRole('button', { name: 'Cintura del talle 42: 68' })).toHaveTextContent('≈68');
    expect(screen.getByRole('button', { name: 'Altura de tiro del talle 40: 25,6' })).toHaveClass('extrapolated');
    expect(screen.getByRole('button', { name: 'Pecho del talle 42: 88,5' })).toHaveClass('user');
    expect(screen.getByRole('button', { name: 'Altura de tiro del talle 40: 25,6' })).toHaveAttribute('title', 'Extrapolado: revisalo');
    const legend = screen.getByLabelText('Referencias');
    for (const t of ['Fuente', 'Interpolado', 'Extrapolado', 'Editado a mano']) expect(legend).toHaveTextContent(t);
  });

  it('editar una celda con coma decimal guarda el cambio', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Pecho del talle 40: 86' }));
    const input = screen.getByLabelText('Pecho del talle 40');
    expect(input).toHaveValue('86');
    await userEvent.clear(input);
    await userEvent.type(input, '87,5{Enter}');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/size-tables/t1/values', { changes: [{ sizeLabel: '40', measureKey: 'pecho', value: 87.5 }] }));
  });

  it('rechaza valores inválidos sin llamar a la API y Escape cancela', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Pecho del talle 40: 86' }));
    const input = screen.getByLabelText('Pecho del talle 40');
    await userEvent.clear(input);
    await userEvent.type(input, 'mucho{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un número entre 0 y 1000');
    expect(api.patch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Pecho del talle 40: 86' })).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('dejar una celda igual no guarda, y vaciarla borra el valor', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Pecho del talle 40: 86' }));
    await userEvent.keyboard('{Enter}');
    expect(api.patch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cintura del talle 40: 64' }));
    await userEvent.clear(screen.getByLabelText('Cintura del talle 40'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/size-tables/t1/values', { changes: [{ sizeLabel: '40', measureKey: 'cintura', value: null }] }));
  });

  it('una tabla precargada se puede duplicar y restaurar, pero no eliminar ni quitarle talles', async () => {
    api.post.mockResolvedValue({ id: 't1' });
    setup();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /Eliminar tabla/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar el talle/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Duplicar/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/size-tables/t1/duplicate', {}));
    await userEvent.click(screen.getByRole('button', { name: /Restaurar/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/size-tables/t1/restore'));
  });

  it('una tabla propia inactiva se puede activar, quitarle talles y eliminar', async () => {
    api.post.mockResolvedValue({});
    api.delete.mockResolvedValue(undefined);
    setup('/tablas?tabla=t2');
    expect(await screen.findByRole('heading', { name: 'Mi tabla' })).toBeInTheDocument();
    expect(screen.getByText(/Tabla inactiva/)).toBeInTheDocument();
    expect(screen.getByText(/Esta tabla no está activa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Activar/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/size-tables/t2/activate'));

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el talle S' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Quitar talle' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/size-tables/t2/sizes/o1'));

    await userEvent.click(screen.getByRole('button', { name: /Eliminar tabla/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar tabla' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/size-tables/t2'));
  });

  it('agrega un talle nuevo y valida el nombre', async () => {
    api.post.mockResolvedValue({});
    setup('/tablas?tabla=t2');
    await userEvent.click(await screen.findByRole('button', { name: /^Talle$/ }));
    expect(await screen.findByText('El talle necesita un nombre.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre del talle'), '60');
    await userEvent.type(screen.getByLabelText('Descripción del talle'), 'XL');
    await userEvent.click(screen.getByRole('button', { name: /^Talle$/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/size-tables/t2/sizes', { label: '60', descriptor: 'XL' }));
  });

  it('agrega una columna de medida vacía para cargar valores', async () => {
    setup('/tablas?tabla=t2');
    await screen.findByRole('table');
    expect(screen.queryByRole('columnheader', { name: 'Contorno de brazo' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Medida a agregar'), 'brazo');
    expect(screen.getByRole('columnheader', { name: 'Contorno de brazo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contorno de brazo del talle S: sin valor' })).toBeInTheDocument();
  });

  it('crea una tabla nueva y cambia de tabla desde el selector', async () => {
    api.post.mockResolvedValue({ id: 't9' });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Nueva tabla/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Infantil 2026');
    await userEvent.selectOptions(screen.getByLabelText('Rango etario'), 'nino');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/size-tables', { name: 'Infantil 2026', ageRange: 'nino', source: null }));
  });
});
