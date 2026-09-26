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
    { id: 'a', name: 'Ana Sosa', missing: 0, total: 3, status: 'complete', missingKeys: [], cells: [{ definitionId: 'd1', required: true, value: 70 }, { definitionId: 'd2', required: true, value: 80 }, { definitionId: 'd3', required: true, value: 100 }] },
    { id: 'l', name: 'Lucía Gómez', missing: 1, total: 2, status: 'partial', missingKeys: ['cadera'], cells: [{ definitionId: 'd1', required: true, value: 74 }, { definitionId: 'd2', required: true, value: null }, { definitionId: 'd3', required: false, value: null }] },
  ],
  totals: { required: 5, done: 2, percent: 40 },
};
const view = () => renderApp(<GroupMissing />, { route: '/groups/g1/faltantes', path: '/groups/:groupId/faltantes' });

describe('Faltantes del grupo', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(plan); api.put.mockResolvedValue({}); });

  it('muestra el avance, solo las bailarinas con faltantes y "no la pide" en lo que no necesitan', async () => {
    view();
    expect(await screen.findByText('2 de 5 medidas · 40 %')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/groups/g1/measure-plan');
    const table = screen.getByRole('table', { name: 'Faltantes del grupo' });
    expect(within(table).getByText('Faltan 2')).toBeInTheDocument();
    expect(within(table).getByText('Falta 1')).toBeInTheDocument();
    expect(within(table).queryByText('Ana Sosa')).not.toBeInTheDocument();
    expect(within(table).getByText('no la pide')).toBeInTheDocument();
  });

  it('el filtro "Solo con faltantes" se apaga para ver también a las completas', async () => {
    view();
    await screen.findByText('2 de 5 medidas · 40 %');
    await userEvent.click(screen.getByRole('button', { name: 'Solo con faltantes' }));
    expect(within(screen.getByRole('table')).getByText('Ana Sosa')).toBeInTheDocument();
  });

  it('se escribe la medida directamente en la celda y se guarda al salir del campo', async () => {
    view();
    const cell = await screen.findByRole('textbox', { name: 'Contorno de cadera de Emi Paz' });
    expect(cell).toHaveValue('');
    await userEvent.type(cell, '94,5');
    await userEvent.tab();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/e/measurements/d2', { valueCm: 94.5 }));
    expect(cell).toHaveValue('94,5');
  });

  it('Enter guarda y baja a la celda de abajo en la misma columna', async () => {
    view();
    const emi = await screen.findByRole('textbox', { name: 'Contorno de cadera de Emi Paz' });
    await userEvent.type(emi, '90{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/e/measurements/d2', { valueCm: 90 }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Contorno de cadera de Lucía Gómez' })).toHaveFocus());
  });

  it('un valor inválido se marca y no se guarda; una celda ya cargada se puede corregir', async () => {
    view();
    const cell = await screen.findByRole('textbox', { name: 'Contorno de cadera de Emi Paz' });
    await userEvent.type(cell, '1200');
    await userEvent.tab();
    expect(cell).toHaveAttribute('aria-invalid', 'true');
    expect(cell).toHaveAttribute('title', 'Ingresá un valor entre 0 y 1000 cm.');
    expect(api.put).not.toHaveBeenCalled();
    const loaded = screen.getByRole('textbox', { name: 'Contorno de pecho de Emi Paz' });
    expect(loaded).toHaveValue('66');
    await userEvent.clear(loaded);
    await userEvent.type(loaded, '67');
    await userEvent.tab();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dancers/e/measurements/d1', { valueCm: 67 }));
  });

  it('si falla el guardado lo indica y conserva lo escrito', async () => {
    api.put.mockRejectedValueOnce(new Error('sin señal'));
    view();
    const cell = await screen.findByRole('textbox', { name: 'Contorno de cadera de Emi Paz' });
    await userEvent.type(cell, '90');
    await userEvent.tab();
    await waitFor(() => expect(cell).toHaveAttribute('aria-invalid', 'true'));
    expect(cell).toHaveValue('90');
    expect(cell).toHaveAttribute('title', 'No se pudo guardar. Probá de nuevo.');
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
