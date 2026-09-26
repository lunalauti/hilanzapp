import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../../lib/files', async (orig) => ({ ...(await orig<typeof import('../../lib/files')>()), openPdf: files.openPdf }));

import { GroupMissing } from './GroupMissing';

const measures = [
  { definitionId: 'd1', key: 'pecho', name: 'Contorno de pecho' },
  { definitionId: 'd2', key: 'cadera', name: 'Contorno de cadera' },
  { definitionId: 'd3', key: 'largo_hombro_rodilla', name: 'Largo hombro-rodilla' },
];
const plan = {
  measures,
  dancers: [
    { id: 'e', name: 'Emi Paz', missing: 2, total: 3, status: 'partial', missingKeys: ['cadera', 'largo_hombro_rodilla'], cells: [{ definitionId: 'd1', required: true, value: 66 }, { definitionId: 'd2', required: true, value: null }, { definitionId: 'd3', required: true, value: null }] },
    { id: 'l', name: 'Lucía Gómez', missing: 1, total: 2, status: 'partial', missingKeys: ['cadera'], cells: [{ definitionId: 'd1', required: true, value: 74 }, { definitionId: 'd2', required: true, value: null }, { definitionId: 'd3', required: false, value: null }] },
  ],
  totals: { required: 5, done: 2, percent: 40 },
};
const view = () => renderApp(<GroupMissing />, { route: '/groups/g1/faltantes', path: '/groups/:groupId/faltantes' });

describe('Faltantes del grupo', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(plan); });

  it('muestra el avance del grupo y la tabla con "no la pide" y celdas por cargar', async () => {
    view();
    expect(await screen.findByText('2 de 5 medidas · 40 %')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/groups/g1/measure-plan?solo_faltantes=1');
    const table = screen.getByRole('table', { name: 'Faltantes del grupo' });
    expect(within(table).getByText('Faltan 2')).toBeInTheDocument();
    expect(within(table).getByText('Falta 1')).toBeInTheDocument();
    expect(within(table).getByText('no la pide')).toBeInTheDocument();
    const cell = within(table).getByRole('link', { name: 'Cargar Contorno de cadera de Emi Paz' });
    expect(cell).toHaveAttribute('href', '/dancers/e/medir?medida=cadera&solo=cadera&volver=%2Fgroups%2Fg1%2Ffaltantes');
  });

  it('el filtro "Solo con faltantes" se puede apagar para ver a todas', async () => {
    view();
    await screen.findByText('2 de 5 medidas · 40 %');
    await userEvent.click(screen.getByRole('button', { name: 'Solo con faltantes' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/groups/g1/measure-plan'));
  });

  it('ofrece tomar las medidas del grupo e imprimir la lista', async () => {
    api.getBlob.mockResolvedValue(new Blob(['%PDF']));
    view();
    expect(await screen.findByRole('link', { name: /Tomar medidas del grupo/ })).toHaveAttribute('href', '/groups/g1/medir');
    await userEvent.click(screen.getByRole('button', { name: /Imprimir lista/ }));
    await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/groups/g1/measure-plan/pdf'));
    expect(files.openPdf).toHaveBeenCalled();
  });

  it('si no falta nada lo dice', async () => {
    api.get.mockResolvedValue({ measures, dancers: [], totals: { required: 6, done: 6, percent: 100 } });
    view();
    expect(await screen.findByText('No falta nada')).toBeInTheDocument();
    expect(screen.getByText('Grupo completo: 6 de 6 medidas cargadas.')).toBeInTheDocument();
  });

  it('si falla muestra el error y permite reintentar', async () => {
    api.get.mockRejectedValueOnce(new Error('caída')).mockResolvedValueOnce(plan);
    view();
    expect(await screen.findByText('No se pudo armar la lista.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('2 de 5 medidas · 40 %')).toBeInTheDocument();
  });
});
