import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { HistoryTab } from './HistoryTab';

const measures = [
  { definitionId: 'dp', key: 'pecho', name: 'Contorno de pecho', isBase: true, required: true, valueCm: 88, note: null, takenOn: '2026-09-12', versionId: 'v3' },
  { definitionId: 'dc', key: 'cintura', name: 'Contorno de cintura', isBase: true, required: true, valueCm: null, note: null, takenOn: null, versionId: null },
];
const versions = [
  { id: 'v3', definitionId: 'dp', valueCm: 88, note: null, takenOn: '2026-09-12', isCurrent: true, createdAt: '3' },
  { id: 'v2', definitionId: 'dp', valueCm: 86, note: 'con malla', takenOn: '2026-06-03', isCurrent: false, createdAt: '2' },
  { id: 'v1', definitionId: 'dp', valueCm: 84.5, note: null, takenOn: '2026-03-14', isCurrent: false, createdAt: '1' },
];

describe('Historial de medidas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (path: string) => {
      if (path === '/dancers/d1/measurements') return measures;
      if (path === '/dancers/d1/measurements/dp/history') return versions;
      if (path.startsWith('/dancers/d1/measurements/compare')) return [{ definitionId: 'dp', key: 'pecho', name: 'Contorno de pecho', from: 86, to: 88, diff: 2 }];
      throw new Error(`GET inesperado ${path}`);
    });
  });

  it('lista las versiones de la más nueva a la más vieja y marca la vigente', async () => {
    renderApp(<HistoryTab dancerId="d1" />);
    expect(await screen.findByText(/12\/09\/2026/)).toHaveTextContent('vigente');
    expect(screen.getByText(/03\/06\/2026/)).toHaveTextContent('con malla');
    expect(screen.getByText('84,5')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Restaurar' })).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'Contorno de cintura' })).not.toBeInTheDocument();
  });

  it('restaurar una versión llama a la API', async () => {
    api.post.mockResolvedValue({});
    renderApp(<HistoryTab dancerId="d1" />);
    await screen.findByText(/12\/09\/2026/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Restaurar' })[0]!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/dancers/d1/measurements/dp/restore', { versionId: 'v2' }));
    expect(await screen.findByText('Versión restaurada como valor vigente')).toBeInTheDocument();
  });

  it('compara dos tomas mostrando la diferencia', async () => {
    renderApp(<HistoryTab dancerId="d1" />);
    await screen.findByText(/12\/09\/2026/);
    await userEvent.type(screen.getByLabelText('Desde'), '2026-06-30');
    expect(await screen.findByText('+2')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/compare\?from=2026-06-30&to=/));
  });

  it('sin medidas cargadas muestra el estado vacío', async () => {
    api.get.mockImplementation(async () => [measures[1]]);
    renderApp(<HistoryTab dancerId="d1" />);
    expect(await screen.findByText('Sin historial todavía')).toBeInTheDocument();
  });
});
