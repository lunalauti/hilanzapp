import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));
vi.mock('../../lib/supabase', () => ({ getSupabase: () => null }));

import { DesignPage } from './DesignPage';
import { DesignsList } from './DesignsList';

const design = {
  id: 'ds1', name: 'Vestido Aurora', notes: 'Hombro izquierdo descubierto', constructionDetails: 'Forro de lycra en corpiño\n\nCierre invisible en espalda, 35 cm',
  neckline: { id: 'n1', label: 'Corazón', isCustom: false }, sleeve: { id: 's1', label: 'Corta', isCustom: false }, skirt: { id: 'k1', label: 'Campana', isCustom: false },
  hasRuffle: true, isAsymmetric: false, createdAt: '',
  garments: [{ id: 'g1', moldTypeId: 'm1', moldKey: 'vestido', moldName: 'Vestido campana con canesú', laborCost: 15000 }],
  specialMeasures: [{ definitionId: 'd1', key: 'hombro_rodilla', name: 'Hombro a rodilla' }],
  images: [{ id: 'i1', filename: 'frente.png', mime: 'image/png', sizeBytes: 1024, url: 'https://files.test/1.png' }],
};

function mockGets() {
  api.get.mockImplementation(async (p: string) => {
    if (p === '/designs/ds1') return design;
    if (p === '/designs') return [design, { ...design, id: 'ds2', name: 'Sin fotos', images: [], garments: [] }];
    if (p === '/groups') return [{ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 12, complete: 9, partial: 1, none: 2 }];
    if (p === '/catalog-options') return [];
    if (p === '/mold-types') return [];
    if (p === '/measure-definitions') return [];
    throw new Error(`GET inesperado ${p}`);
  });
}
const view = () => renderApp(<DesignPage />, { route: '/disenos/ds1', path: '/disenos/:designId' });

describe('Ficha del diseño', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGets(); });

  it('muestra la ficha técnica, los detalles como lista y las medidas especiales', async () => {
    view();
    expect(await screen.findByRole('heading', { name: 'Vestido Aurora' })).toBeInTheDocument();
    const ficha = screen.getByRole('region', { name: 'Ficha técnica' });
    expect(ficha).toHaveTextContent('EscoteCorazón');
    expect(ficha).toHaveTextContent('VoladoSí');
    expect(ficha).toHaveTextContent('AsimetríaNo');
    expect(ficha).toHaveTextContent('Hombro izquierdo descubierto');
    const detalles = screen.getByRole('region', { name: 'Detalles de confección' });
    expect(detalles.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Medidas especiales' })).toHaveTextContent('Hombro a rodilla');
    expect(screen.getByRole('img', { name: 'frente.png' })).toBeInTheDocument();
  });

  it('asigna el diseño a un grupo', async () => {
    api.post.mockResolvedValue({ created: 24, existing: 0 });
    view();
    await userEvent.click(await screen.findByRole('button', { name: /Asignar a grupo/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar' }));
    expect(await screen.findByText('Elegí un grupo.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Grupo'), 'g1');
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/groups/g1/design-assignment', { designId: 'ds1' }));
    expect(await screen.findByText(/asignado a Ágata: 24 prendas nuevas/)).toBeInTheDocument();
  });

  it('pide confirmación antes de eliminar', async () => {
    api.delete.mockResolvedValue(undefined);
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar diseño' }));
    expect(await screen.findByText(/las prendas que se asignaron/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar diseño' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/designs/ds1?confirm=true'));
  });
});

describe('Lista de diseños', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGets(); });

  it('muestra tarjetas con prendas e imágenes', async () => {
    renderApp(<DesignsList />, { route: '/disenos', path: '/disenos' });
    expect(await screen.findByRole('link', { name: /Vestido Aurora/ })).toHaveAttribute('href', '/disenos/ds1');
    expect(screen.getByText(/1 imagen · con volado/)).toBeInTheDocument();
    expect(screen.getByText('Sin prendas')).toBeInTheDocument();
  });

  it('sin diseños muestra el estado vacío', async () => {
    api.get.mockImplementation(async (p: string) => (p === '/designs' ? [] : []));
    renderApp(<DesignsList />, { route: '/disenos', path: '/disenos' });
    expect(await screen.findByText('Todavía no hay diseños')).toBeInTheDocument();
  });
});
