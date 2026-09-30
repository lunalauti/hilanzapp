import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), postBlob: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../../lib/files', async (orig) => ({ ...(await orig<typeof import('../../lib/files')>()), openPdf: files.openPdf }));

import { MaterialsListModal } from './MaterialsListModal';

const data = {
  groupName: 'Ágata', generatedAt: '2026-09-30T10:00:00Z',
  garments: [
    { moldName: 'Pantalón', dancerCount: 5, materials: [{ name: 'Lycra negra', description: 'Ancho 1,5 m', unit: 'm', perUnit: 1, total: 5, approx: true }], notes: { conos: '', observations: '' } },
    { moldName: 'Cuerpo base', dancerCount: 5, materials: [], notes: { conos: '', observations: '' } },
  ],
};
const view = (props = {}) => renderApp(<MaterialsListModal show groupId="g1" designId="" onClose={vi.fn()} {...props} />);

describe('MaterialsListModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide la vista previa y la muestra editable, sin descargar nada todavía', async () => {
    api.get.mockResolvedValue(data);
    view();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/groups/g1/materials-list'));
    expect(await screen.findByText('Pantalón')).toBeInTheDocument();
    expect(screen.getAllByText('5 bailarinas', { exact: false })).toHaveLength(2);
    expect(screen.getByText('Cargá el consumo de materiales para esta prenda.')).toBeInTheDocument();
    expect(api.postBlob).not.toHaveBeenCalled();
  });

  it('envía las cantidades y notas editadas al descargar', async () => {
    api.get.mockResolvedValue(data);
    const blob = new Blob(['%PDF-']);
    api.postBlob.mockResolvedValue(blob);
    view();
    const totalInput = await screen.findByLabelText('Lycra negra de Pantalón, total');
    await userEvent.clear(totalInput);
    await userEvent.type(totalInput, '7');
    await userEvent.type(screen.getAllByLabelText('Conos de hilo color')[0]!, 'Negro x 5');
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(api.postBlob).toHaveBeenCalledWith('/groups/g1/materials-list/pdf', {
      garments: [
        { moldName: 'Pantalón', dancerCount: 5, materials: [{ name: 'Lycra negra', description: 'Ancho 1,5 m', unit: 'm', perUnit: 1, total: 7, approx: true }], notes: { conos: 'Negro x 5', observations: '' } },
        { moldName: 'Cuerpo base', dancerCount: 5, materials: [], notes: { conos: '', observations: '' } },
      ],
    }));
    expect(files.openPdf).toHaveBeenCalledWith(blob, 'lista-materiales.pdf');
  });

  it('avisa si no se pudo cargar la vista previa', async () => {
    api.get.mockRejectedValue(new Error('caída'));
    view();
    expect(await screen.findByText('No pudimos cargar la lista de materiales.')).toBeInTheDocument();
  });
});
