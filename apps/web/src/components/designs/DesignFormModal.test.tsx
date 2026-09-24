import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { DesignFormModal } from './DesignFormModal';

const catalog = [
  { id: 'n1', category: 'neckline', label: 'Corazón', isCustom: false }, { id: 'n2', category: 'neckline', label: 'Halter', isCustom: false },
  { id: 's1', category: 'sleeve', label: 'Corta', isCustom: false }, { id: 'k1', category: 'skirt', label: 'Campana', isCustom: false },
  { id: 'k2', category: 'skirt', label: 'Falda con godets', isCustom: true },
];
const molds = [{ id: 'm1', key: 'pantalon', name: 'Pantalón', inputs: [] }, { id: 'm2', key: 'vestido', name: 'Vestido', inputs: [] }];
const defs = [{ id: 'd1', key: 'brazo', name: 'Contorno de brazo', kind: 'body', isBase: true, required: false }, { id: 'd2', key: 'altura_tiro', name: 'Altura de tiro', kind: 'standard', isBase: false, required: false }];

const design = {
  id: 'ds1', name: 'Aurora', notes: 'Hombro descubierto', constructionDetails: 'Cierre invisible', neckline: { id: 'n1', label: 'Corazón', isCustom: false }, sleeve: null, skirt: { id: 'k1', label: 'Campana', isCustom: false },
  hasRuffle: true, isAsymmetric: false, createdAt: '', images: [],
  garments: [{ id: 'g1', moldTypeId: 'm2', moldKey: 'vestido', moldName: 'Vestido', laborCost: 15000 }], specialMeasures: [{ definitionId: 'd1', key: 'brazo', name: 'Contorno de brazo' }],
};

function setup(props: { design?: typeof design } = {}) {
  const onSaved = vi.fn(); const onClose = vi.fn();
  renderApp(<DesignFormModal show design={props.design as never} onClose={onClose} onSaved={onSaved} />);
  return { onSaved, onClose };
}

describe('Formulario de diseño', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (p: string) => (p === '/catalog-options' ? catalog : p === '/mold-types' ? molds : p === '/measure-definitions' ? defs : []));
  });

  it('ofrece los catálogos, las prendas y solo las medidas corporales', async () => {
    setup();
    const neck = await screen.findByLabelText('Escote');
    await waitFor(() => expect(neck).toHaveTextContent('Corazón'));
    expect(neck).toHaveTextContent('Otro…');
    expect(screen.getByLabelText('Falda')).toHaveTextContent('Falda con godets (propio)');
    expect(await screen.findByRole('checkbox', { name: 'Pantalón' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Contorno de brazo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Altura de tiro' })).not.toBeInTheDocument();
  });

  it('exige el nombre antes de guardar', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText('El nombre del diseño es obligatorio.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('"Otro" pide el valor, lo guarda en el catálogo y lo usa en el diseño', async () => {
    api.post.mockImplementation(async (p: string) => (p === '/catalog-options' ? { id: 'nuevo', label: 'Barco' } : { ...design, id: 'ds9' }));
    const { onSaved } = setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'Nuevo');
    await userEvent.selectOptions(screen.getByLabelText('Escote'), '__other__');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText('Escribí cuál es el escote.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Otro escote'), 'Barco');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/catalog-options', { category: 'neckline', label: 'Barco' }));
    expect(api.post).toHaveBeenCalledWith('/designs', expect.objectContaining({ name: 'Nuevo', necklineId: 'nuevo', sleeveId: null, skirtId: null, garments: [], specialMeasureIds: [] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('ds9'));
  });

  it('valida el monto de mano de obra y envía prendas y medidas especiales', async () => {
    api.post.mockResolvedValue({ id: 'ds9' });
    setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'Con prendas');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vestido' }));
    await userEvent.type(screen.getByLabelText('Mano de obra de Vestido'), 'mucho');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText(/Ingresá un monto/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Mano de obra de Vestido'));
    await userEvent.type(screen.getByLabelText('Mano de obra de Vestido'), '15000,5');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pantalón' }));
    await userEvent.click(screen.getByRole('button', { name: 'Contorno de brazo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Tiene volado/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/designs', expect.objectContaining({
      hasRuffle: true, isAsymmetric: false, specialMeasureIds: ['d1'],
      garments: expect.arrayContaining([{ moldTypeId: 'm2', laborCost: 15000.5 }, { moldTypeId: 'm1', laborCost: null }]),
    })));
  });

  it('al editar carga los datos actuales y guarda con PATCH', async () => {
    api.patch.mockResolvedValue({ id: 'ds1' });
    setup({ design });
    expect(await screen.findByDisplayValue('Aurora')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Escote')).toHaveValue('n1'));
    expect(screen.getByRole('checkbox', { name: /Tiene volado/ })).toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Vestido' })).toBeChecked();
    expect(screen.getByLabelText('Mano de obra de Vestido')).toHaveValue('15000');
    expect(await screen.findByRole('button', { name: 'Contorno de brazo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.clear(screen.getByLabelText('Nombre del diseño'));
    await userEvent.type(screen.getByLabelText('Nombre del diseño'), 'Aurora II');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/designs/ds1', expect.objectContaining({ name: 'Aurora II', necklineId: 'n1', hasRuffle: true })));
  });

  it('muestra el error de la API', async () => {
    const { ApiError } = await import('../../lib/api');
    api.post.mockRejectedValue(new ApiError(409, 'INVALID_REFERENCE', 'Una de las prendas ya no existe'));
    setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Una de las prendas ya no existe');
  });
});
