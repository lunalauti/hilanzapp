import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));
const files = vi.hoisted(() => ({ openPdf: vi.fn() }));
vi.mock('../lib/files', async (orig) => ({ ...(await orig<typeof import('../lib/files')>()), openPdf: files.openPdf }));

import { MoldSheet } from './MoldSheet';

const placeholder = {
  id: 'm2', key: 'propia_evase', name: 'Vestido evasé', category: 'vestido', sizePriority: 'cadera', hasPattern: false,
  inputs: [
    { key: 'pecho', label: 'Contorno de pecho', source: 'measure', required: true },
    { key: 'cadera', label: 'Contorno de cadera', source: 'measure', required: true },
    { key: 'largo_falda', label: 'Largo de falda', source: 'measure', required: true },
  ],
  formulas: [],
};
const molds = [{
  id: 'm1', key: 'vestido', name: 'Vestido campana con canesú', category: 'vestido', sizePriority: 'both',
  inputs: [
    { key: 'pecho', label: 'Contorno de pecho', source: 'measure', required: true },
    { key: 'cadera', label: 'Contorno de cadera', source: 'measure', required: true },
    { key: 'largo_canesu', label: 'Largo de canesú', source: 'manual', required: true },
    { key: 'vuelo', label: 'Tipo de vuelo', source: 'choice', defaultOptionId: 'campana', options: [{ id: 'media', label: '1/2 campana', value: 3.14 }, { id: 'campana', label: 'Campana', value: 6.28 }] },
  ],
}];
const measure = (key: string, name: string, valueCm: number | null) => ({ definitionId: key, key, name, isBase: true, required: true, valueCm, note: null, takenOn: null, versionId: null });

function route(url: string) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/groups') return [{ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 1, complete: 1, partial: 0, none: 0 }];
    if (path === '/mold-types') return [...molds, placeholder];
    if (path === '/dancers/d1/sizing?mold_type_id=m2') return { effective: { label: '42', origin: 'suggested' }, priority: 'cadera' };
    if (path === '/designs') return [{ id: 'ds1', name: 'Aurora', images: [], garments: [] }];
    if (path === '/dancers/d1') return { id: 'd1', group_id: 'g1', name: 'Martina López', age: 16 };
    if (path === '/groups/g1/dancers') return [{ id: 'd1', name: 'Martina López' }];
    if (path === '/dancers/d1/measurements') return [measure('pecho', 'Contorno de pecho', 88), measure('cadera', 'Contorno de cadera', url === 'blocked' ? null : 94), measure('largo_falda', 'Largo de falda', null)];
    throw new Error(`GET inesperado ${path}`);
  });
}
const view = () => renderApp(<MoldSheet />, { route: '/moldes?dancer=d1&mold=m1', path: '/moldes' });

describe('Hoja de molde', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con medidas faltantes bloquea el cálculo, dice cuáles y ofrece tomarlas todas juntas', async () => {
    route('blocked');
    api.post.mockRejectedValue(new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan datos', { missing: [{ key: 'cadera', label: 'Contorno de cadera', source: 'measure' }] }));
    view();
    expect(await screen.findByText(/No se puede calcular todavía/)).toBeInTheDocument();
    expect(screen.getByText(/Faltan 1 de las 2 medidas que pide este molde: Contorno de cadera/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tomar la que falta' })).toHaveAttribute('href', '/dancers/d1/medir?solo=cadera&volver=%2Fmoldes%3Fdancer%3Dd1%26mold%3Dm1');
    expect(screen.getByText(/Los resultados aparecen cuando estén todas las medidas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar hoja/ })).toBeDisabled();
  });

  it('pide el dato manual y luego muestra real, fórmula y resultado', async () => {
    route('ok');
    api.post.mockImplementation(async (path: string, body: { manualInputs: Record<string, number> }) => {
      if (path !== '/calculations') throw new Error('POST inesperado');
      if (body.manualInputs.largo_canesu === undefined) throw new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan', { missing: [{ key: 'largo_canesu', label: 'Largo de canesú', source: 'manual' }] });
      return {
        dancer: { id: 'd1', name: 'Martina López', age: 16 }, mold: { id: 'm1', key: 'vestido', name: 'Vestido', sizePriority: 'both' }, table: null,
        size: { label: '42', origin: 'suggested', suggested: '42' }, inputs: [], manualInputs: body.manualInputs, choices: {},
        rows: [{ key: 'cuarto_pecho', label: '1/4 pecho', section: 'Canesú', realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 4', result: 22, display: '22' }],
      };
    });
    view();
    expect(await screen.findByText(/Completá los datos de arriba/)).toBeInTheDocument();
    expect(screen.queryByText(/No se puede calcular todavía/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Largo de canesú'), '12');
    expect(await screen.findByText('1/4 pecho')).toBeInTheDocument();
    expect(screen.getByText('÷ 4')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('Canesú')).toBeInTheDocument();
    expect(screen.getByTitle('Talle sugerido')).toHaveTextContent('T42');
    expect(api.post).toHaveBeenLastCalledWith('/calculations', { dancerId: 'd1', moldTypeId: 'm1', manualInputs: { largo_canesu: 12 }, choices: { vuelo: 'campana' } });
  });

  it('un valor manual inválido no llama a la API', async () => {
    route('ok');
    api.post.mockRejectedValue(new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan', { missing: [{ key: 'largo_canesu', label: 'Largo de canesú', source: 'manual' }] }));
    view();
    await screen.findByText(/Completá los datos de arriba/);
    const callsBefore = api.post.mock.calls.length;
    await userEvent.type(screen.getByLabelText('Largo de canesú'), 'doce');
    expect(await screen.findByText('Ingresá un número.')).toBeInTheDocument();
    expect(api.post.mock.calls.length).toBe(callsBefore);
  });

  it('cambiar el vuelo recalcula con la opción elegida y se puede guardar la hoja', async () => {
    route('ok');
    api.post.mockImplementation(async (path: string, body: { choices: Record<string, string> }) => {
      if (path === '/pattern-sheets') return { id: 's1' };
      return {
        dancer: { id: 'd1', name: 'Martina', age: 16 }, mold: { id: 'm1', key: 'v', name: 'V', sizePriority: 'both' }, table: null, size: { label: '42', origin: 'suggested', suggested: '42' },
        inputs: [], manualInputs: {}, choices: body.choices,
        rows: [{ key: 'r', label: 'Radio', section: null, realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 3,14', result: 28, display: '28' }],
      };
    });
    view();
    await userEvent.type(await screen.findByLabelText('Largo de canesú'), '12');
    await userEvent.click(screen.getByRole('button', { name: '1/2 campana' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/calculations', expect.objectContaining({ choices: { vuelo: 'media' } })));
    await userEvent.click(await screen.findByRole('button', { name: /Guardar hoja/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pattern-sheets', expect.objectContaining({ dancerId: 'd1', moldTypeId: 'm1' })));
    expect(await screen.findByText('Hoja de molde guardada')).toBeInTheDocument();
  });

  it('exportar PDF guarda la hoja, pide el PDF y lo abre', async () => {
    route('ok');
    const calcResponse = {
      dancer: { id: 'd1', name: 'Martina López', age: 16 }, mold: { id: 'm1', key: 'v', name: 'V', sizePriority: 'both' }, table: null, size: { label: '42', origin: 'suggested', suggested: '42' },
      inputs: [], manualInputs: {}, choices: {}, rows: [{ key: 'r', label: 'Radio', section: null, realLabel: 'Pecho', realValue: 88, formula: '÷ 4', result: 22, display: '22' }],
    };
    api.post.mockImplementation(async (path: string) => (path === '/pattern-sheets' ? { id: 's1' } : calcResponse));
    const blob = new Blob(['%PDF-'], { type: 'application/pdf' });
    api.getBlob.mockResolvedValue(blob);
    view();
    await userEvent.type(await screen.findByLabelText('Largo de canesú'), '12');
    await userEvent.click(await screen.findByRole('button', { name: /Exportar PDF/ }));
    await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/pattern-sheets/s1/pdf'));
    expect(files.openPdf).toHaveBeenCalledWith(blob, expect.stringContaining('.pdf'));
    expect(await screen.findByText('Hoja guardada y PDF generado')).toBeInTheDocument();
  });

  it('con un diseño elegido, el cálculo y la hoja lo incluyen', async () => {
    route('ok');
    api.post.mockResolvedValue({ dancer: { id: 'd1', name: 'M', age: 1 }, mold: { id: 'm1', key: 'v', name: 'V', sizePriority: 'both' }, table: null, size: { label: '42', origin: 'suggested', suggested: '42' }, inputs: [], manualInputs: {}, choices: {}, rows: [] });
    renderApp(<MoldSheet />, { route: '/moldes?dancer=d1&mold=m1&design=ds1', path: '/moldes' });
    await userEvent.type(await screen.findByLabelText('Largo de canesú'), '12');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/calculations', expect.objectContaining({ designId: 'ds1' })));
    expect(screen.getByLabelText('Diseño (opcional)')).toHaveValue('ds1');
  });

  it('al volver del flujo de medidas avisa que la hoja quedó calculada', async () => {
    route('ok');
    api.post.mockResolvedValue({
      dancer: { id: 'd1', name: 'Martina López', age: 16 }, mold: { id: 'm1', key: 'vestido', name: 'Vestido', sizePriority: 'both' }, table: null,
      size: { label: '42', origin: 'suggested', suggested: '42' }, inputs: [], rows: [{ key: 'a', label: 'Pieza', section: null, realLabel: 'Cadera', realValue: 94, formula: '÷ 4', result: 23.5, display: '23,5' }], manualInputs: {}, choices: {},
    });
    renderApp(<MoldSheet />, { route: '/moldes?dancer=d1&mold=m1&medidas=nuevas', path: '/moldes' });
    expect(await screen.findByText(/Hoja calculada con las medidas nuevas/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    await waitFor(() => expect(screen.queryByText(/Hoja calculada con las medidas nuevas/)).not.toBeInTheDocument());
  });

  describe('prenda sin molde', () => {
    const viewPlaceholder = () => renderApp(<MoldSheet />, { route: '/moldes?dancer=d1&mold=m2&design=ds1', path: '/moldes' });

    it('explica que no tiene molde y muestra las medidas para trazar a mano', async () => {
      route('ok');
      viewPlaceholder();
      expect(await screen.findByRole('heading', { name: 'Esta prenda todavía no tiene molde' })).toBeInTheDocument();
      expect(screen.getByText('Igual podés tomar medidas, asignar talles y planificar la producción.')).toBeInTheDocument();
      const section = screen.getByRole('region', { name: 'Para trazar a mano' });
      expect(section).toHaveTextContent('Contorno de pecho');
      await waitFor(() => expect(section).toHaveTextContent('88 cm'));
      expect(section).toHaveTextContent('Largo de falda');
      expect(section).toHaveTextContent('Falta');
      expect(section).toHaveTextContent('SIN MOLDE');
      expect(await screen.findByText('Talle según cadera')).toBeInTheDocument();
      expect(screen.queryByText('No se puede calcular todavía')).not.toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalledWith('/calculations', expect.anything());
    });

    it('ofrece tomar solo lo que falta, crear el molde, vincular y exportar', async () => {
      route('ok');
      api.getBlob.mockResolvedValue(new Blob(['%PDF']));
      viewPlaceholder();
      const take = await screen.findByRole('link', { name: /Tomar medidas \(1 falta\)/ });
      expect(take).toHaveAttribute('href', expect.stringContaining('/dancers/d1/medir?solo=largo_falda&volver='));
      expect(screen.getByRole('link', { name: 'Crear molde con esta prenda' })).toHaveAttribute('href', '/formulas?mold=m2');
      await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
      await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/dancers/d1/garment-sheet/pdf?mold_type_id=m2&design_id=ds1'));
      expect(files.openPdf).toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Vincular a un molde existente' }));
      expect(await screen.findByRole('heading', { name: /Vincular “Vestido evasé”/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Vestido campana con canesú/ })).toBeInTheDocument();
    });

    it('en el selector, las prendas sin molde van al final y se marcan', async () => {
      route('ok');
      renderApp(<MoldSheet />, { route: '/moldes?dancer=d1', path: '/moldes' });
      const select = await screen.findByLabelText('Molde');
      await waitFor(() => expect(select).toHaveTextContent('Vestido evasé · sin molde'));
    });
  });
});
