import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), postBlob: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../lib/files', async (orig) => ({ ...(await orig<typeof import('../lib/files')>()), openPdf: files.openPdf }));

import { BatchPdfModal } from './BatchPdfModal';

const sheets = [
  { dancerId: 'd1', dancerName: 'Martina López', sheetId: 's1', sizeLabel: '42', createdAt: '2026-09-12T10:00:00Z' },
  { dancerId: 'd2', dancerName: 'Sofía Ferreyra', sheetId: null, sizeLabel: null, createdAt: null },
  { dancerId: 'd3', dancerName: 'Valentina Ruiz', sheetId: 's3', sizeLabel: '44', createdAt: '2026-09-13T10:00:00Z' },
];

function setup() {
  api.get.mockImplementation(async (p: string) => (p === '/mold-types' ? [{ id: 'm1', key: 'cuerpo', name: 'Cuerpo base', inputs: [] }] : sheets));
  const onClose = vi.fn();
  renderApp(<BatchPdfModal show groupId="g1" onClose={onClose} />);
  return { onClose };
}

describe('Hojas de molde en PDF (lote)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('al elegir un molde lista las bailarinas y deshabilita a las que no tienen hoja', async () => {
    setup();
    await screen.findByRole('option', { name: 'Cuerpo base' });
    await userEvent.selectOptions(screen.getByLabelText('Molde'), 'm1');
    expect(await screen.findByText('Bailarinas (2 de 2 con hoja guardada)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Sofía Ferreyra/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Martina López/ })).toBeChecked();
    expect(screen.getByText('sin hoja guardada')).toBeInTheDocument();
    expect(screen.getByText(/T42 · 12\/09\/2026/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/groups/g1/pattern-sheets?mold_type_id=m1');
  });

  it('exporta solo las seleccionadas, en un solo PDF', async () => {
    const blob = new Blob(['%PDF-']);
    api.postBlob.mockResolvedValue(blob);
    const { onClose } = setup();
    await screen.findByRole('option', { name: 'Cuerpo base' });
    await userEvent.selectOptions(screen.getByLabelText('Molde'), 'm1');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Valentina Ruiz/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Exportar 1 hoja' }));
    await waitFor(() => expect(api.postBlob).toHaveBeenCalledWith('/pattern-sheets/pdf', { sheetIds: ['s1'] }));
    expect(files.openPdf).toHaveBeenCalledWith(blob, 'hojas-de-molde.pdf');
    expect(onClose).toHaveBeenCalled();
  });

  it('no permite exportar sin ninguna seleccionada', async () => {
    setup();
    await screen.findByRole('option', { name: 'Cuerpo base' });
    await userEvent.selectOptions(screen.getByLabelText('Molde'), 'm1');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Martina López/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Valentina Ruiz/ }));
    expect(screen.getByRole('button', { name: /^Exportar/ })).toBeDisabled();
  });

  it('avisa cuando nadie tiene hoja guardada', async () => {
    api.get.mockImplementation(async (p: string) => (p === '/mold-types' ? [{ id: 'm1', name: 'Cuerpo base', inputs: [] }] : [sheets[1]]));
    renderApp(<BatchPdfModal show groupId="g1" onClose={vi.fn()} />);
    await screen.findByRole('option', { name: 'Cuerpo base' });
    await userEvent.selectOptions(screen.getByLabelText('Molde'), 'm1');
    expect(await screen.findByText(/Ninguna bailarina tiene una hoja guardada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Exportar/ })).toBeDisabled();
  });

  it('muestra el error de la API al exportar', async () => {
    api.postBlob.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Hoja de molde no encontrada'));
    setup();
    await screen.findByRole('option', { name: 'Cuerpo base' });
    await userEvent.selectOptions(screen.getByLabelText('Molde'), 'm1');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar 2 hojas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hoja de molde no encontrada');
  });
});
