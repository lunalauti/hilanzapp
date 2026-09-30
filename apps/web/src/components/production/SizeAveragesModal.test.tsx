import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { SizeAveragesModal } from './SizeAveragesModal';

const view = (props: Partial<Parameters<typeof SizeAveragesModal>[0]> = {}) =>
  renderApp(<SizeAveragesModal show groupId="g1" moldTypeId="m1" moldName="Pantalón" sizeLabel="8" onClose={vi.fn()} {...props} />);

describe('SizeAveragesModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide el promedio del talle y muestra la tabla de referencia', async () => {
    api.get.mockResolvedValue({ sizes: [{ label: '8', tableName: 'Niños — Baúl de Moda', ageRange: 'nino', measures: [
      { key: 'cadera', name: 'Contorno de cadera', value: 68.5, source: 'real', dancerCount: 3 },
      { key: 'cintura', name: 'Contorno de cintura', value: 60, source: 'table', dancerCount: 0 },
    ] }] });
    view();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/groups/g1/production/size-averages?mold_type_id=m1&sizes=8'));
    expect(await screen.findByText('Tabla de referencia: Niños — Baúl de Moda')).toBeInTheDocument();
    expect(screen.getByText('68,5 cm')).toBeInTheDocument();
    expect(screen.getByText('promedio de 3 bailarinas')).toBeInTheDocument();
    expect(screen.getByText('60 cm')).toBeInTheDocument();
    expect(screen.getByText('de la tabla de talles')).toBeInTheDocument();
  });

  it('sin medidas de cuerpo lo avisa', async () => {
    api.get.mockResolvedValue({ sizes: [{ label: '8', tableName: null, ageRange: null, measures: [] }] });
    view();
    expect(await screen.findByText('Este molde no pide medidas del cuerpo.')).toBeInTheDocument();
  });

  it('avisa si no se pudo cargar', async () => {
    api.get.mockRejectedValue(new Error('caída'));
    view();
    expect(await screen.findByText('No pudimos cargar las medidas.')).toBeInTheDocument();
  });
});
