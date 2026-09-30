import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../lib/files', async (orig) => ({ ...(await orig<typeof import('../lib/files')>()), openPdf: files.openPdf }));

import { Production } from './Production';

const unit = (assignmentId: string, dancerId: string, dancerName: string, sewn = false) => ({ assignmentId, dancerId, dancerName, sewn });
const data = {
  dancerCount: 12, totalUnits: 10,
  byGarment: [{ moldKey: 'pantalon', moldName: 'Pantalón', total: 10, sizes: [
    { label: '8', count: 3, dancers: ['Ana', 'Bea', 'Cami'], moldTypeId: 'm1', patternDone: false, sewnCount: 0, sewnTotal: 3, units: [unit('a1', 'd1', 'Ana'), unit('a2', 'd2', 'Bea'), unit('a3', 'd3', 'Cami')] },
    { label: '10', count: 4, dancers: ['Dani', 'Eli', 'Flor', 'Gala'], moldTypeId: 'm1', patternDone: true, sewnCount: 4, sewnTotal: 4, units: [unit('a4', 'd4', 'Dani', true), unit('a5', 'd5', 'Eli', true), unit('a6', 'd6', 'Flor', true), unit('a7', 'd7', 'Gala', true)] },
    { label: '12', count: 2, dancers: ['Hebe', 'Ines'], moldTypeId: 'm1', patternDone: false, sewnCount: 0, sewnTotal: 2, units: [unit('a8', 'd8', 'Hebe'), unit('a9', 'd9', 'Ines')] },
    { label: '14', count: 1, dancers: ['Juli'], moldTypeId: 'm1', patternDone: false, sewnCount: 0, sewnTotal: 1, units: [unit('a10', 'd10', 'Juli')] },
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
    expect(screen.getByText(/4 de 10 confeccionadas/)).toBeInTheDocument();
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

  it('marca el patrón de un talle como listo', async () => {
    api.put.mockResolvedValue({ ...data, byGarment: [{ ...data.byGarment[0], sizes: data.byGarment[0]!.sizes.map((s) => s.label === '8' ? { ...s, patternDone: true } : s) }] });
    view();
    const check = await screen.findByRole('checkbox', { name: 'Patrón listo: Pantalón talle 8' });
    expect(check).not.toBeChecked();
    await userEvent.click(check);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/groups/g1/production/pattern', { moldTypeId: 'm1', sizeLabel: '8', done: true }));
  });

  it('el talle 10 ya viene con el patrón listo marcado', async () => {
    view();
    expect(await screen.findByRole('checkbox', { name: 'Patrón listo: Pantalón talle 10' })).toBeChecked();
  });

  it('la cantidad de un talle totalmente confeccionado aparece tachada', async () => {
    view();
    expect(await screen.findByRole('button', { name: /talle 10: 4 prendas/ })).toHaveTextContent('4');
    const q10 = (await screen.findByRole('button', { name: /talle 10: 4 prendas/ })).querySelector('.q');
    expect(q10).toHaveClass('hz-sewn-complete');
    const q8 = (await screen.findByRole('button', { name: /talle 8: 3 prendas/ })).querySelector('.q');
    expect(q8).not.toHaveClass('hz-sewn-complete');
  });

  it('abre las medidas del talle y pide el promedio a la API', async () => {
    api.get.mockImplementation(async (p: string) => (p.includes('size-averages') ? { sizes: [{ label: '8', tableName: 'Niños — Baúl de Moda', ageRange: 'nino', measures: [{ key: 'cadera', name: 'Contorno de cadera', value: 68, source: 'real', dancerCount: 3 }] }] } : data));
    view();
    const buttons = await screen.findAllByRole('button', { name: 'Ver medidas del talle' });
    await userEvent.click(buttons[0]!);
    expect(await screen.findByRole('heading', { name: 'Pantalón · Talle 8' })).toBeInTheDocument();
    expect(await screen.findByText('Contorno de cadera')).toBeInTheDocument();
    expect(screen.getByText('68 cm')).toBeInTheDocument();
    expect(screen.getByText('promedio de 3 bailarinas')).toBeInTheDocument();
  });

  it('marca la confección de una bailarina como lista', async () => {
    api.put.mockResolvedValue({ ...data, byGarment: [{ ...data.byGarment[0], sizes: data.byGarment[0]!.sizes.map((s) => s.label === '8' ? { ...s, sewnCount: 1, units: s.units.map((u) => u.assignmentId === 'a1' ? { ...u, sewn: true } : u) } : s) }] });
    view();
    await userEvent.click(await screen.findByRole('button', { name: /talle 8: 3 prendas/ }));
    const check = screen.getByRole('checkbox', { name: 'Confección lista: Ana' });
    expect(check).not.toBeChecked();
    await userEvent.click(check);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/assignments/a1/sewn', { done: true }));
  });
});
