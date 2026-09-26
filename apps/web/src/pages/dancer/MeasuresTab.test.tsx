import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { MeasuresTab } from './MeasuresTab';

const pi = (key: string, name: string, value: number | null, by: { kind: string; label: string }[]) => ({
  definitionId: `d_${key}`, key, name, sort: 0, isBase: true, requiredBy: by, value, takenOn: value === null ? null : '2026-09-12',
});
const mi = (key: string, name: string, valueCm: number | null, isBase = true) => ({ definitionId: `d_${key}`, key, name, isBase, required: false, valueCm, note: null, takenOn: null, versionId: null });

const garment = (l: string) => ({ kind: 'garment', label: l });
const plan = (items: ReturnType<typeof pi>[]) => ({ items, total: items.length, done: items.filter((i) => i.value !== null).length, missing: items.filter((i) => i.value === null).length, status: 'partial' });
const measurements = [mi('pecho', 'Contorno de pecho', 66), mi('cadera', 'Contorno de cadera', null), mi('cuello', 'Contorno de cuello', 29), mi('tiro', 'Tiro', 40, false)];

function setup(p: unknown) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/dancers/d1/measurements') return measurements;
    if (path === '/dancers/d1/measure-plan') return p;
    throw new Error(`sin mock ${path}`);
  });
  renderApp(<MeasuresTab dancerId="d1" />);
}

describe('Ficha · Medidas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('arriba dice cuántas faltan, quién las pide y ofrece "Tomar medidas"', async () => {
    setup(plan([
      pi('pecho', 'Contorno de pecho', 66, [garment('Vestido Aurora')]),
      pi('cadera', 'Contorno de cadera', null, [garment('Pantalón')]),
      pi('largo_hombro_rodilla', 'Largo hombro-rodilla', null, [{ kind: 'design', label: 'Vestido Aurora' }]),
    ]));
    expect(await screen.findByText('Te faltan 2 medidas')).toBeInTheDocument();
    expect(screen.getByText(/Las piden Pantalón y Vestido Aurora\. Sin ellas no se calcula la hoja de molde\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tomar medidas' })).toHaveAttribute('href', '/dancers/d1/medir?volver=%2Fdancers%2Fd1%3Ftab%3Dmedidas');
  });

  it('separa lo que piden las prendas, lo especial del diseño y las otras medidas', async () => {
    setup(plan([
      pi('pecho', 'Contorno de pecho', 66, [garment('Vestido Aurora')]),
      pi('cadera', 'Contorno de cadera', null, [garment('Pantalón')]),
      pi('largo_hombro_rodilla', 'Largo hombro-rodilla', null, [{ kind: 'design', label: 'Vestido Aurora' }]),
    ]));
    const req = (await screen.findByRole('heading', { name: 'Requeridas por sus prendas' })).closest('section')!;
    expect(within(req).getByRole('link', { name: 'Contorno de pecho: 66 cm' })).toBeInTheDocument();
    const falta = within(req).getByRole('link', { name: 'Contorno de cadera: falta' });
    expect(falta).toHaveAttribute('href', expect.stringContaining('/dancers/d1/medir?medida=cadera&solo=cadera'));
    const special = screen.getByRole('region', { name: 'Para Vestido Aurora' });
    expect(within(special).getByText('Medidas especiales del diseño')).toBeInTheDocument();
    expect(within(special).getByRole('link', { name: 'Largo hombro-rodilla: falta' })).toBeInTheDocument();
    const others = screen.getByRole('heading', { name: 'Otras medidas' }).closest('section')!;
    expect(within(others).getByText('Contorno de cuello')).toBeInTheDocument();
    expect(within(others).getByText('Tiro')).toBeInTheDocument();
    expect(within(others).queryByText('Contorno de pecho')).not.toBeInTheDocument();
  });

  it('una medida pedida por dos prendas aparece una sola vez con las dos', async () => {
    setup(plan([pi('cintura', 'Contorno de cintura', 58, [garment('Vestido Aurora'), garment('Pantalón')])]));
    expect(await screen.findByText('Vestido Aurora · Pantalón')).toBeInTheDocument();
    expect(screen.getAllByText('Contorno de cintura')).toHaveLength(1);
  });

  it('con todo cargado la tarjeta de faltantes desaparece', async () => {
    setup(plan([pi('pecho', 'Contorno de pecho', 66, [garment('Vestido Aurora')])]));
    expect(await screen.findByText(/Medidas completas para lo que piden sus prendas/)).toBeInTheDocument();
    expect(screen.queryByText(/Te falta/)).not.toBeInTheDocument();
  });

  it('sin prendas asignadas usa las medidas base requeridas', async () => {
    setup(plan([pi('pecho', 'Contorno de pecho', null, [{ kind: 'base', label: 'Medidas base' }])]));
    expect(await screen.findByRole('heading', { name: 'Medidas base requeridas' })).toBeInTheDocument();
    expect(screen.getByText('Te falta 1 medida')).toBeInTheDocument();
    expect(screen.getByText('Son las medidas base para completar la ficha.')).toBeInTheDocument();
  });

  it('si no hay nada requerido invita a asignar vestuario', async () => {
    setup(plan([]));
    expect(await screen.findByText(/asignale vestuario para saber cuáles hacen falta/)).toBeInTheDocument();
  });
});
